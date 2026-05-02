// routes/retailers.js
// Retailer registration, agent management, commission tracking

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { createNotification, auditLog } = require('../utils/helpers');

// ─────────────────────────────────────────────────────
// POST /api/retailers/register
// Register current user as a retailer
// ─────────────────────────────────────────────────────
router.post('/register', authenticate, [
  body('shop_name').notEmpty().withMessage('Shop name required'),
  body('shop_address').notEmpty(),
  body('district').notEmpty(),
  body('state').notEmpty(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM retailers WHERE user_id=?').get(req.user.id);
    if (existing) return res.status(409).json({ success: false, message: 'Already registered as retailer' });

    const { shop_name, shop_address, district, state, distributor_code } = req.body;

    // Find distributor if code given
    let distributorId = null;
    if (distributor_code) {
      const dist = db.prepare('SELECT id FROM retailers WHERE retailer_code=?').get(distributor_code);
      if (!dist) return res.status(400).json({ success: false, message: 'Invalid distributor code' });
      distributorId = dist.id;
    }

    // Generate unique retailer code
    const code = `SVA-RET-${Date.now().toString().slice(-5)}`;
    const retailerId = uuidv4();

    db.prepare(`
      INSERT INTO retailers (id, user_id, retailer_code, distributor_id, shop_name, shop_address, district, state, commission_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5.0)
    `).run(retailerId, req.user.id, code, distributorId, shop_name, shop_address, district, state);

    // Upgrade user role
    db.prepare("UPDATE users SET role='retailer', updated_at=datetime('now') WHERE id=?").run(req.user.id);

    createNotification(req.user.id, '🏪 Retailer Registered!', `Your retailer code is ${code}. Share with customers to earn commissions.`, 'success');
    auditLog(req.user.id, 'RETAILER_REGISTER', 'retailers', retailerId, req, { shop_name, code });

    res.status(201).json({ success: true, message: 'Registered as retailer', data: { retailer_id: retailerId, retailer_code: code } });
  } catch (err) { next(err); }
});

// GET /api/retailers/my  — My retailer profile + stats
router.get('/my', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const retailer = db.prepare(`
      SELECT r.*, u.name, u.email, u.mobile, u.wallet_balance,
             (SELECT COUNT(*) FROM retailers WHERE distributor_id=r.id) as agent_count,
             (SELECT COUNT(*) FROM applications WHERE user_id=r.user_id) as total_apps,
             (SELECT COALESCE(SUM(fees),0) FROM applications WHERE user_id=r.user_id AND payment_status='paid') as total_billed
      FROM retailers r JOIN users u ON u.id=r.user_id
      WHERE r.user_id=?
    `).get(req.user.id);

    if (!retailer) return res.status(404).json({ success: false, message: 'Not a registered retailer' });

    // Agents under this retailer
    const agents = db.prepare(`
      SELECT r2.retailer_code, r2.shop_name, u.name, u.mobile, r2.total_transactions, r2.is_active
      FROM retailers r2 JOIN users u ON u.id=r2.user_id
      WHERE r2.distributor_id=?
    `).all(retailer.id);

    res.json({ success: true, data: { ...retailer, agents } });
  } catch (err) { next(err); }
});

// GET /api/retailers/commission-history
router.get('/commission-history', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const txns = db.prepare(`
      SELECT * FROM wallet_transactions
      WHERE user_id=? AND description LIKE '%commission%'
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset);

    const total = db.prepare(`
      SELECT COALESCE(SUM(amount),0) as total FROM wallet_transactions
      WHERE user_id=? AND type='credit' AND description LIKE '%commission%'
    `).get(req.user.id)?.total || 0;

    res.json({ success: true, data: txns, total_earned: total });
  } catch (err) { next(err); }
});

// GET /api/retailers  [Admin — list all retailers]
router.get('/', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const { state, district, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];
    if (state)    { where += ' AND r.state=?';    params.push(state); }
    if (district) { where += ' AND r.district=?'; params.push(district); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM retailers r ${where}`).get(...params)?.c || 0;
    const retailers = db.prepare(`
      SELECT r.retailer_code, r.shop_name, r.district, r.state, r.commission_rate,
             r.total_transactions, r.is_active, r.created_at,
             u.name, u.email, u.mobile, u.wallet_balance,
             (SELECT COUNT(*) FROM retailers WHERE distributor_id=r.id) as agents
      FROM retailers r JOIN users u ON u.id=r.user_id
      ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ success: true, data: retailers, pagination: { total, page: parseInt(page) } });
  } catch (err) { next(err); }
});

module.exports = router;
