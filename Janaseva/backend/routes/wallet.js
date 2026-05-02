// routes/wallet.js
// Wallet balance, transaction history, and internal transfers

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, query } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { createNotification, auditLog } = require('../utils/helpers');

// ─────────────────────────────────────────────────────
// GET /api/wallet/balance
// ─────────────────────────────────────────────────────
router.get('/balance', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT wallet_balance, pan_wallet FROM users WHERE id = ?').get(req.user.id);
    res.json({
      success: true,
      data: {
        cards_wallet: user.wallet_balance,
        pan_wallet: user.pan_wallet,
        total: user.wallet_balance + user.pan_wallet,
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/wallet/transactions
// ─────────────────────────────────────────────────────
router.get('/transactions', authenticate, [
  query('wallet').optional().isIn(['main', 'pan']),
  query('type').optional().isIn(['credit', 'debit']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { wallet, type, page = 1, limit = 20, from, to } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (wallet) { where += ' AND wallet = ?'; params.push(wallet); }
    if (type)   { where += ' AND type = ?';   params.push(type); }
    if (from)   { where += ' AND created_at >= ?'; params.push(from); }
    if (to)     { where += ' AND created_at <= ?'; params.push(to); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM wallet_transactions ${where}`).get(...params)?.c || 0;
    const txns = db.prepare(`
      SELECT * FROM wallet_transactions ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Aggregate stats
    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) as total_credit,
        SUM(CASE WHEN type='debit'  THEN amount ELSE 0 END) as total_debit
      FROM wallet_transactions ${where}
    `).get(...params);

    res.json({
      success: true,
      data: txns,
      stats,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/wallet/deduct
// Internal: deduct from wallet to pay for a service
// ─────────────────────────────────────────────────────
router.post('/deduct', authenticate, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
  body('application_id').notEmpty(),
  body('wallet').optional().isIn(['main', 'pan']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { amount, application_id, wallet = 'main' } = req.body;

    const walletCol = wallet === 'pan' ? 'pan_wallet' : 'wallet_balance';
    const user = db.prepare(`SELECT id, ${walletCol} as balance FROM users WHERE id = ?`).get(req.user.id);

    if (user.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance. Please add money.' });
    }

    const app = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(application_id, req.user.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    // Deduct wallet
    db.prepare(`UPDATE users SET ${walletCol} = ${walletCol} - ?, updated_at=datetime('now') WHERE id=?`)
      .run(amount, req.user.id);

    const newBalance = user.balance - amount;

    // Record transaction
    const txId = uuidv4();
    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id)
      VALUES (?, ?, 'debit', ?, ?, ?, ?, ?)
    `).run(txId, req.user.id, wallet, amount, newBalance, `Payment for ${app.service_name} (${app.ref_number})`, application_id);

    // Mark application paid
    db.prepare(`
      UPDATE applications
      SET payment_status='paid', payment_ref=?, payment_method='wallet',
          status='processing', step=2, updated_at=datetime('now')
      WHERE id=?
    `).run(txId, application_id);

    createNotification(req.user.id, '✅ Payment Done',
      `₹${amount} deducted from wallet for ${app.service_name}. Reference: ${app.ref_number}`, 'success');

    auditLog(req.user.id, 'WALLET_DEDUCT', 'wallet_transactions', txId, req, { amount, application_id });

    res.json({
      success: true,
      message: 'Payment successful via wallet',
      data: { new_balance: newBalance, ref_number: app.ref_number, transaction_id: txId }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/wallet/credit  [Admin only]
// Manually credit a user's wallet
// ─────────────────────────────────────────────────────
router.post('/credit', authenticate, authorize('admin'), [
  body('user_id').notEmpty(),
  body('amount').isFloat({ min: 1 }),
  body('description').notEmpty(),
  body('wallet').optional().isIn(['main', 'pan']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { user_id, amount, description, wallet = 'main' } = req.body;

    const walletCol = wallet === 'pan' ? 'pan_wallet' : 'wallet_balance';
    db.prepare(`UPDATE users SET ${walletCol} = ${walletCol} + ?, updated_at=datetime('now') WHERE id=?`)
      .run(amount, user_id);

    const user = db.prepare(`SELECT ${walletCol} as bal FROM users WHERE id=?`).get(user_id);

    const txId = uuidv4();
    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id)
      VALUES (?, ?, 'credit', ?, ?, ?, ?, ?)
    `).run(txId, user_id, wallet, amount, user.bal, description, `ADMIN-${req.user.id}`);

    createNotification(user_id, '💰 Wallet Credited', `₹${amount} credited by admin. ${description}`, 'success');
    auditLog(req.user.id, 'ADMIN_WALLET_CREDIT', 'users', user_id, req, { amount, description });

    res.json({ success: true, message: `₹${amount} credited to user wallet`, new_balance: user.bal });
  } catch (err) { next(err); }
});

module.exports = router;
