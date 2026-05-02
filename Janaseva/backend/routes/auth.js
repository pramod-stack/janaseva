// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { getDb } = require('../config/db');
const { validateRequest } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const {
  generateTokens, generateOTP, storeOTP, verifyOTP,
  createNotification, auditLog
} = require('../utils/helpers');

// ─────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit Indian mobile required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must include upper, lower & number'),
  body('role').optional().isIn(['citizen', 'retailer']).withMessage('Invalid role'),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { name, email, mobile, password, role = 'citizen', state, address } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR mobile = ?').get(email, mobile);
    if (existing) return res.status(409).json({ success: false, message: 'Email or mobile already registered' });

    const hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, mobile, password, role, state, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, email, mobile, hash, role, state || null, address || null);

    const { accessToken, refreshToken } = generateTokens(userId);
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), userId, refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString());

    createNotification(userId, 'Welcome to JanaSeva!', `Hello ${name}, your account has been created. Complete KYC to access all services.`, 'success');
    auditLog(userId, 'REGISTER', 'users', userId, req, { email, role });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { id: userId, name, email, mobile, role },
      accessToken,
      refreshToken,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────
router.post('/login', [
  body('email').optional().isEmail().normalizeEmail(),
  body('mobile').optional().matches(/^[6-9]\d{9}$/),
  body('password').notEmpty().withMessage('Password required'),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { email, mobile, password } = req.body;

    const user = email
      ? db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      : db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Account deactivated. Contact support.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user.id);
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), user.id, refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString());

    auditLog(user.id, 'LOGIN', 'users', user.id, req);

    res.json({
      success: true,
      message: 'Login successful',
      data: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role, kyc_status: user.kyc_status, wallet_balance: user.wallet_balance },
      accessToken,
      refreshToken,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/auth/send-otp
// ─────────────────────────────────────────────────────
router.post('/send-otp', [
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Valid mobile required'),
  body('purpose').isIn(['login', 'register', 'reset']).withMessage('Invalid purpose'),
], validateRequest, (req, res, next) => {
  try {
    const { mobile, purpose } = req.body;
    const otp = generateOTP();
    storeOTP(mobile, otp, purpose);

    // In production: send via SMS API (Msg91 / Fast2SMS)
    console.log(`[OTP] Mobile: ${mobile} | OTP: ${otp} | Purpose: ${purpose}`);

    res.json({ success: true, message: 'OTP sent successfully', ...(process.env.NODE_ENV === 'development' && { otp }) });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────
router.post('/verify-otp', [
  body('mobile').matches(/^[6-9]\d{9}$/),
  body('otp').isLength({ min: 6, max: 6 }),
  body('purpose').isIn(['login', 'register', 'reset']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { mobile, otp, purpose } = req.body;
    const valid = verifyOTP(mobile, otp, purpose);
    if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

    let user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    let accessToken, refreshToken;

    if (user) {
      ({ accessToken, refreshToken } = generateTokens(user.id));
      db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), user.id, refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString());
    }

    res.json({ success: true, message: 'OTP verified', user: user || null, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────
router.post('/refresh', (req, res, next) => {
  try {
    const db = getDb();
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const record = db.prepare(`
      SELECT rt.*, u.id as uid FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token = ? AND rt.expires_at > datetime('now')
    `).get(refreshToken);

    if (!record) return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });

    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    const tokens = generateTokens(record.uid);
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), record.uid, tokens.refreshToken, new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString());

    res.json({ success: true, ...tokens });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { refreshToken } = req.body;
    if (refreshToken) db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);
    auditLog(req.user.id, 'LOGOUT', 'users', req.user.id, req);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.mobile, u.role, u.kyc_status,
           u.wallet_balance, u.pan_wallet, u.state, u.address, u.created_at,
           r.retailer_code, r.shop_name, r.commission_rate
    FROM users u
    LEFT JOIN retailers r ON r.user_id = u.id
    WHERE u.id = ?
  `).get(req.user.id);
  res.json({ success: true, data: user });
});

// ─────────────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────────────
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('address').optional().trim(),
  body('state').optional().trim(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { name, address, state } = req.body;
    db.prepare('UPDATE users SET name=?, address=?, state=?, updated_at=datetime("now") WHERE id=?')
      .run(name || req.user.name, address || null, state || null, req.user.id);
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) { next(err); }
});

module.exports = router;
