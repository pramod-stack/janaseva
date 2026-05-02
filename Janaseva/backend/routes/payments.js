// routes/payments.js
// Razorpay payment gateway integration
// Handles order creation, payment verification, webhook, and wallet top-up

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { createNotification, auditLog } = require('../utils/helpers');

// ─────────────────────────────────────────────────────
// Helper: load Razorpay lazily (avoid crash if not installed)
// ─────────────────────────────────────────────────────
function getRazorpay() {
  try {
    const Razorpay = require('razorpay');
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch {
    throw new Error('Razorpay package not installed. Run: npm install razorpay');
  }
}

// ─────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order for an application
// ─────────────────────────────────────────────────────
router.post('/create-order', authenticate, [
  body('application_id').notEmpty().withMessage('Application ID required'),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { application_id } = req.body;

    const app = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?')
      .get(application_id, req.user.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
    if (app.payment_status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });
    if (app.fees === 0) return res.status(400).json({ success: false, message: 'This service has no fee' });

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(app.fees * 100), // paise
      currency: 'INR',
      receipt: app.ref_number,
      notes: { application_id, user_id: req.user.id, service: app.service_name },
    });

    // Store payment record
    db.prepare(`
      INSERT INTO payments (id, application_id, user_id, order_id, amount, status)
      VALUES (?, ?, ?, ?, ?, 'created')
    `).run(uuidv4(), application_id, req.user.id, order.id, app.fees);

    auditLog(req.user.id, 'CREATE_PAYMENT_ORDER', 'payments', order.id, req, { application_id, amount: app.fees });

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
        application_ref: app.ref_number,
        service_name: app.service_name,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.mobile,
        },
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/payments/verify
// Verifies Razorpay payment signature and marks application as paid
// ─────────────────────────────────────────────────────
router.post('/verify', authenticate, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  body('application_id').notEmpty(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, application_id } = req.body;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment signature mismatch. Possible fraud.' });
    }

    // Update payment record
    db.prepare(`
      UPDATE payments SET payment_id=?, status='paid', updated_at=datetime('now')
      WHERE order_id=?
    `).run(razorpay_payment_id, razorpay_order_id);

    // Mark application as paid and move to processing
    db.prepare(`
      UPDATE applications
      SET payment_status='paid', payment_ref=?, payment_method='razorpay',
          status='processing', step=2, updated_at=datetime('now')
      WHERE id=? AND user_id=?
    `).run(razorpay_payment_id, application_id, req.user.id);

    const app = db.prepare('SELECT * FROM applications WHERE id=?').get(application_id);

    // Wallet transaction debit record
    const user = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(req.user.id);
    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id, status)
      VALUES (?, ?, 'debit', 'main', ?, ?, ?, ?, 'completed')
    `).run(uuidv4(), req.user.id, app.fees, user.wallet_balance, `Payment for ${app.service_name}`, razorpay_payment_id);

    createNotification(req.user.id,
      '💳 Payment Successful',
      `₹${app.fees} paid for ${app.service_name} (${app.ref_number}). Processing started.`,
      'success');

    auditLog(req.user.id, 'PAYMENT_VERIFIED', 'payments', razorpay_payment_id, req, { application_id, amount: app.fees });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { ref_number: app.ref_number, service_name: app.service_name, status: 'processing' }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/payments/webhook
// Razorpay webhook handler (set in Razorpay dashboard)
// ─────────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSig) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body);
    const db = getDb();

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      db.prepare(`UPDATE payments SET status='paid', updated_at=datetime('now') WHERE order_id=?`).run(payment.order_id);
      console.log(`[WEBHOOK] Payment captured: ${payment.id} – ₹${payment.amount / 100}`);
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      db.prepare(`UPDATE payments SET status='failed', updated_at=datetime('now') WHERE order_id=?`).run(payment.order_id);
      console.log(`[WEBHOOK] Payment failed: ${payment.id}`);
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/payments/wallet-topup
// Top-up wallet balance (via Razorpay order)
// ─────────────────────────────────────────────────────
router.post('/wallet-topup', authenticate, [
  body('amount').isFloat({ min: 10, max: 50000 }).withMessage('Amount must be 10–50000'),
  body('wallet').optional().isIn(['main', 'pan']).withMessage('Invalid wallet type'),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { amount, wallet = 'main' } = req.body;
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `WALLET-${Date.now()}`,
      notes: { type: 'wallet_topup', user_id: req.user.id, wallet },
    });

    db.prepare(`INSERT INTO payments (id, user_id, order_id, amount, status) VALUES (?, ?, ?, ?, 'created')`)
      .run(uuidv4(), req.user.id, order.id, amount);

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: 'INR',
        key_id: process.env.RAZORPAY_KEY_ID,
        wallet,
        prefill: { name: req.user.name, email: req.user.email, contact: req.user.mobile },
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/payments/wallet-topup/verify
// Confirm wallet top-up after Razorpay success
// ─────────────────────────────────────────────────────
router.post('/wallet-topup/verify', authenticate, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  body('amount').isFloat({ min: 10 }),
  body('wallet').optional().isIn(['main', 'pan']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, wallet = 'main' } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature mismatch' });
    }

    // Credit wallet
    const walletCol = wallet === 'pan' ? 'pan_wallet' : 'wallet_balance';
    db.prepare(`UPDATE users SET ${walletCol} = ${walletCol} + ?, updated_at=datetime('now') WHERE id=?`)
      .run(amount, req.user.id);

    const user = db.prepare(`SELECT ${walletCol} as bal FROM users WHERE id=?`).get(req.user.id);

    db.prepare(`UPDATE payments SET payment_id=?, status='paid', updated_at=datetime('now') WHERE order_id=?`)
      .run(razorpay_payment_id, razorpay_order_id);

    db.prepare(`
      INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id)
      VALUES (?, ?, 'credit', ?, ?, ?, 'Wallet Top-up', ?)
    `).run(uuidv4(), req.user.id, wallet, amount, user.bal, razorpay_payment_id);

    createNotification(req.user.id, '💰 Wallet Credited', `₹${amount} added to your ${wallet === 'pan' ? 'PAN' : 'Cards'} wallet.`, 'success');

    res.json({ success: true, message: `Wallet credited ₹${amount}`, new_balance: user.bal });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/payments/history
// Logged-in user's payment history
// ─────────────────────────────────────────────────────
router.get('/history', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const payments = db.prepare(`
      SELECT p.*, a.ref_number, a.service_name
      FROM payments p
      LEFT JOIN applications a ON a.id = p.application_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset);

    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});

module.exports = router;
