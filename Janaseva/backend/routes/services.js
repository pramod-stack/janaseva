// routes/services.js
// Public service catalogue, fee lookup, and utility service handlers
// (Recharge, Electricity, BBPS — wraps external provider APIs)

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, param } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { generateRefNumber, calculateFees, createNotification, auditLog } = require('../utils/helpers');

// ─────────────────────────────────────────────────────
// GET /api/services/catalogue
// All active services with fees
// ─────────────────────────────────────────────────────
router.get('/catalogue', (req, res, next) => {
  try {
    const db = getDb();
    const fees = db.prepare('SELECT * FROM service_fees WHERE is_active = 1 ORDER BY service_name').all();
    const catalogue = fees.map(f => {
      const gst = (f.platform_fee * f.gst_percent) / 100;
      return {
        service_type: f.service_type,
        service_name: f.service_name,
        govt_fee:     f.govt_fee,
        platform_fee: f.platform_fee,
        gst_amount:   Math.round(gst * 100) / 100,
        total:        Math.round((f.govt_fee + f.platform_fee + gst) * 100) / 100,
        is_free:      f.govt_fee === 0 && f.platform_fee === 0,
      };
    });
    res.json({ success: true, data: catalogue });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/services/fees/:serviceType
// ─────────────────────────────────────────────────────
router.get('/fees/:serviceType', (req, res, next) => {
  try {
    const fees = calculateFees(req.params.serviceType);
    res.json({ success: true, data: fees });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/services/recharge
// Mobile recharge via provider API (Bharat API / RechargeMart)
// ─────────────────────────────────────────────────────
router.post('/recharge', authenticate, [
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit mobile required'),
  body('operator').isIn(['jio','airtel','vi','bsnl','mtnl']).withMessage('Invalid operator'),
  body('circle').notEmpty().withMessage('Circle required'),
  body('amount').isFloat({ min: 10, max: 5000 }).withMessage('Amount must be 10–5000'),
  body('plan_desc').optional().trim(),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { mobile, operator, circle, amount, plan_desc } = req.body;

    const fee = calculateFees('recharge');
    const total = amount + fee.platform_fee;

    // Wallet check
    const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(req.user.id);
    if (user.wallet_balance < total) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Need ₹${total}, have ₹${user.wallet_balance}` });
    }

    const refNumber = generateRefNumber('recharge');
    const appId = uuidv4();

    // Create application record
    db.prepare(`
      INSERT INTO applications (id, ref_number, user_id, service_type, service_name, form_data, fees, payment_status, status, step)
      VALUES (?, ?, ?, 'recharge', 'Mobile Recharge', ?, ?, 'paid', 'processing', 2)
    `).run(appId, refNumber, req.user.id, JSON.stringify({ mobile, operator, circle, amount, plan_desc }), total);

    // Deduct wallet
    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ?, updated_at=datetime("now") WHERE id=?').run(total, req.user.id);
    const newBal = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(req.user.id).wallet_balance;
    db.prepare(`INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id) VALUES (?,?,'debit','main',?,?,?,?)`)
      .run(uuidv4(), req.user.id, total, newBal, `Mobile Recharge – ${mobile} (${operator.toUpperCase()})`, refNumber);

    // --- External API call stub ---
    // In production: call your recharge API provider (Bharat API, RechargeIt, etc.)
    // const result = await callRechargeAPI({ mobile, operator, circle, amount });
    // if (result.status !== 'SUCCESS') throw new Error(result.message);
    const simulatedOperatorRef = `OP-${Date.now().toString().slice(-8)}`;

    // Mark completed
    db.prepare(`UPDATE applications SET status='completed', step=5, officer_notes=?, completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
      .run(`Operator ref: ${simulatedOperatorRef}`, appId);

    createNotification(req.user.id, '📱 Recharge Successful',
      `₹${amount} recharge for ${mobile} (${operator.toUpperCase()}) successful. Ref: ${refNumber}`, 'success');

    auditLog(req.user.id, 'RECHARGE', 'applications', appId, req, { mobile, operator, amount });

    res.json({
      success: true,
      message: 'Recharge successful',
      data: { ref_number: refNumber, mobile, operator, amount, operator_ref: simulatedOperatorRef, new_wallet_balance: newBal }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/services/fetch-bill
// Fetch utility bill from provider (BBPS / BESCOM etc.)
// ─────────────────────────────────────────────────────
router.post('/fetch-bill', authenticate, [
  body('provider').notEmpty(),
  body('consumer_number').notEmpty(),
  body('service_type').isIn(['electricity','water','gas','dth','broadband','landline']),
], validateRequest, async (req, res, next) => {
  try {
    // In production: call BBPS API or provider-specific API
    // Simulating a realistic response:
    const { provider, consumer_number, service_type } = req.body;
    const dueDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const simulatedBills = {
      electricity: { amount: 1245.00, units: '248 kWh', period: 'Feb 2026', consumer_name: 'Arjun N' },
      water:       { amount: 540.00,  units: '18 KL',   period: 'Feb 2026', consumer_name: 'Arjun N' },
      gas:         { amount: 875.00,  units: '12 SCM',  period: 'Feb 2026', consumer_name: 'Arjun N' },
      dth:         { amount: 399.00,  units: 'Monthly', period: 'Mar 2026', consumer_name: 'Arjun N' },
      broadband:   { amount: 799.00,  units: 'Monthly', period: 'Mar 2026', consumer_name: 'Arjun N' },
      landline:    { amount: 299.00,  units: 'Monthly', period: 'Feb 2026', consumer_name: 'Arjun N' },
    };

    const bill = simulatedBills[service_type] || { amount: 500.00, units: 'N/A', period: 'Feb 2026', consumer_name: 'Customer' };

    res.json({
      success: true,
      data: {
        provider,
        consumer_number,
        consumer_name: bill.consumer_name,
        bill_amount: bill.amount,
        due_date: dueDate,
        units_consumed: bill.units,
        bill_period: bill.period,
        service_type,
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/services/pay-bill
// Pay utility bill via wallet or Razorpay
// ─────────────────────────────────────────────────────
router.post('/pay-bill', authenticate, [
  body('provider').notEmpty(),
  body('consumer_number').notEmpty(),
  body('amount').isFloat({ min: 1 }),
  body('service_type').isIn(['electricity','water','gas','dth','broadband','landline','insurance','loan_emi','lpg']),
  body('payment_method').isIn(['wallet','razorpay']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { provider, consumer_number, amount, service_type, payment_method } = req.body;

    const refNumber = generateRefNumber('bbps');
    const appId = uuidv4();
    const platformFee = 5;
    const total = amount + platformFee;

    if (payment_method === 'wallet') {
      const user = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(req.user.id);
      if (user.wallet_balance < total) {
        return res.status(400).json({ success: false, message: `Insufficient balance. Need ₹${total}` });
      }
      db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id=?').run(total, req.user.id);
      const newBal = db.prepare('SELECT wallet_balance FROM users WHERE id=?').get(req.user.id).wallet_balance;
      db.prepare(`INSERT INTO wallet_transactions (id, user_id, type, wallet, amount, balance_after, description, ref_id) VALUES (?,?,'debit','main',?,?,?,?)`)
        .run(uuidv4(), req.user.id, total, newBal, `${service_type} Bill – ${provider} (${consumer_number})`, refNumber);
    }

    db.prepare(`
      INSERT INTO applications (id, ref_number, user_id, service_type, service_name, form_data, fees, payment_status, status, step, completed_at)
      VALUES (?, ?, ?, 'bbps', ?, ?, ?, 'paid', 'completed', 5, datetime('now'))
    `).run(appId, refNumber, req.user.id,
      `${service_type.replace(/_/g,' ')} Bill – ${provider}`,
      JSON.stringify({ provider, consumer_number, service_type }), total);

    createNotification(req.user.id, '✅ Bill Paid',
      `₹${amount} paid for ${provider} (${consumer_number}). Ref: ${refNumber}`, 'success');

    res.json({ success: true, message: 'Bill paid successfully', data: { ref_number: refNumber, amount_paid: amount, total_charged: total } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/services/operators
// Recharge operators and plans (static catalogue)
// ─────────────────────────────────────────────────────
router.get('/operators', (req, res) => {
  res.json({
    success: true,
    data: {
      mobile: ['Jio', 'Airtel', 'Vi (Vodafone Idea)', 'BSNL', 'MTNL'],
      dth: ['Tata Sky (Tata Play)', 'Dish TV', 'Sun Direct', 'Airtel Digital TV', 'DD Free Dish'],
      electricity: [
        'BESCOM (Karnataka)', 'MSEDCL (Maharashtra)', 'TANGEDCO (Tamil Nadu)',
        'TSSPDCL (Telangana)', 'KSEB (Kerala)', 'BSES Rajdhani (Delhi)', 'DVVNL (UP)',
      ],
      water: ['BWSSB (Bengaluru)', 'BMC (Mumbai)', 'CMWSSB (Chennai)', 'DJB (Delhi)'],
    }
  });
});

module.exports = router;
