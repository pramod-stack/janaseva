// routes/admin.js
// Admin & Officer panel: stats, user management, application review

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, query } = require('express-validator');
const bcrypt = require('bcryptjs');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { createNotification, auditLog } = require('../utils/helpers');

// All routes here require authentication + admin/officer role
router.use(authenticate);

// ─────────────────────────────────────────────────────
// GET /api/admin/dashboard
// Summary stats for admin dashboard
// ─────────────────────────────────────────────────────
router.get('/dashboard', authorize('admin', 'officer'), (req, res, next) => {
  try {
    const db = getDb();

    const totalUsers        = db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get()?.c || 0;
    const totalRetailers    = db.prepare("SELECT COUNT(*) as c FROM retailers").get()?.c || 0;
    const totalApps         = db.prepare("SELECT COUNT(*) as c FROM applications").get()?.c || 0;
    const pendingApps       = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status IN ('submitted','processing','under_review')").get()?.c || 0;
    const approvedApps      = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'approved'").get()?.c || 0;
    const completedApps     = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'completed'").get()?.c || 0;
    const todayApps         = db.prepare("SELECT COUNT(*) as c FROM applications WHERE DATE(submitted_at) = DATE('now')").get()?.c || 0;
    const totalRevenue      = db.prepare("SELECT COALESCE(SUM(fees),0) as s FROM applications WHERE payment_status='paid'").get()?.s || 0;
    const todayRevenue      = db.prepare("SELECT COALESCE(SUM(fees),0) as s FROM applications WHERE payment_status='paid' AND DATE(submitted_at)=DATE('now')").get()?.s || 0;
    const monthRevenue      = db.prepare("SELECT COALESCE(SUM(fees),0) as s FROM applications WHERE payment_status='paid' AND strftime('%Y-%m',submitted_at)=strftime('%Y-%m','now')").get()?.s || 0;

    // Service-wise breakdown
    const serviceBreakdown = db.prepare(`
      SELECT service_type, service_name, COUNT(*) as count,
             SUM(CASE WHEN status='completed' OR status='approved' THEN 1 ELSE 0 END) as completed,
             COALESCE(SUM(CASE WHEN payment_status='paid' THEN fees ELSE 0 END),0) as revenue
      FROM applications GROUP BY service_type ORDER BY count DESC LIMIT 10
    `).all();

    // Daily app trend (last 7 days)
    const trend = db.prepare(`
      SELECT DATE(submitted_at) as date, COUNT(*) as count
      FROM applications
      WHERE submitted_at >= DATE('now', '-7 days')
      GROUP BY DATE(submitted_at) ORDER BY date
    `).all();

    // Recent applications
    const recentApps = db.prepare(`
      SELECT a.ref_number, a.service_name, a.status, a.fees, a.submitted_at,
             u.name as applicant_name, u.mobile
      FROM applications a JOIN users u ON u.id = a.user_id
      ORDER BY a.submitted_at DESC LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        users:    { total: totalUsers, retailers: totalRetailers },
        apps:     { total: totalApps, pending: pendingApps, approved: approvedApps, completed: completedApps, today: todayApps },
        revenue:  { total: totalRevenue, today: todayRevenue, month: monthRevenue },
        service_breakdown: serviceBreakdown,
        trend,
        recent_applications: recentApps,
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/admin/users
// List all users with filters
// ─────────────────────────────────────────────────────
router.get('/users', authorize('admin'), [
  query('role').optional().isIn(['citizen','retailer','distributor','officer','admin']),
  query('kyc_status').optional().isIn(['pending','verified','rejected']),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { role, kyc_status, search, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE u.role != 'admin'";
    const params = [];
    if (role)       { where += ' AND u.role = ?'; params.push(role); }
    if (kyc_status) { where += ' AND u.kyc_status = ?'; params.push(kyc_status); }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params)?.c || 0;
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.mobile, u.role, u.kyc_status, u.is_active,
             u.wallet_balance, u.pan_wallet, u.created_at,
             r.retailer_code, r.shop_name,
             (SELECT COUNT(*) FROM applications WHERE user_id = u.id) as app_count
      FROM users u LEFT JOIN retailers r ON r.user_id = u.id
      ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ success: true, data: users, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// PUT /api/admin/users/:id/kyc
// Approve or reject KYC
// ─────────────────────────────────────────────────────
router.put('/users/:id/kyc', authorize('admin'), [
  body('kyc_status').isIn(['verified', 'rejected']),
  body('reason').optional().trim(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { kyc_status, reason } = req.body;
    db.prepare('UPDATE users SET kyc_status=?, updated_at=datetime("now") WHERE id=?').run(kyc_status, req.params.id);

    const msg = kyc_status === 'verified'
      ? 'Your KYC has been verified. You now have full access to all services.'
      : `KYC rejected. Reason: ${reason || 'Documents unclear'}. Please re-upload.`;
    createNotification(req.params.id, `KYC ${kyc_status.toUpperCase()}`, msg, kyc_status === 'verified' ? 'success' : 'error');

    auditLog(req.user.id, 'KYC_UPDATE', 'users', req.params.id, req, { kyc_status });
    res.json({ success: true, message: `KYC ${kyc_status}` });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// PUT /api/admin/users/:id/toggle-active
// Activate or deactivate a user
// ─────────────────────────────────────────────────────
router.put('/users/:id/toggle-active', authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET is_active = 1 - is_active, updated_at=datetime("now") WHERE id=?').run(req.params.id);
    const user = db.prepare('SELECT is_active FROM users WHERE id=?').get(req.params.id);
    auditLog(req.user.id, user.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'users', req.params.id, req);
    res.json({ success: true, message: `User ${user.is_active ? 'activated' : 'deactivated'}`, is_active: user.is_active });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// POST /api/admin/users/create-officer
// Create an officer account
// ─────────────────────────────────────────────────────
router.post('/users/create-officer', authorize('admin'), [
  body('name').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('mobile').matches(/^[6-9]\d{9}$/),
  body('password').isLength({ min: 8 }),
  body('department').optional().trim(),
], validateRequest, async (req, res, next) => {
  try {
    const db = getDb();
    const { name, email, mobile, password, department } = req.body;

    const exists = db.prepare('SELECT id FROM users WHERE email=? OR mobile=?').get(email, mobile);
    if (exists) return res.status(409).json({ success: false, message: 'Email or mobile already exists' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, mobile, password, role, kyc_status, address) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, name, email, mobile, hash, 'officer', 'verified', department || null);

    auditLog(req.user.id, 'CREATE_OFFICER', 'users', id, req, { email });
    res.status(201).json({ success: true, message: 'Officer account created', data: { id, name, email, role: 'officer' } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/admin/audit-log
// ─────────────────────────────────────────────────────
router.get('/audit-log', authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 50, user_id, action } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];
    if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
    if (action)  { where += ' AND al.action LIKE ?'; params.push(`%${action}%`); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM audit_log al ${where}`).get(...params)?.c || 0;
    const logs = db.prepare(`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
      ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ success: true, data: logs, pagination: { total, page: parseInt(page) } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// PUT /api/admin/service-fees/:serviceType
// Update a service fee
// ─────────────────────────────────────────────────────
router.put('/service-fees/:serviceType', authorize('admin'), [
  body('govt_fee').optional().isFloat({ min: 0 }),
  body('platform_fee').optional().isFloat({ min: 0 }),
  body('gst_percent').optional().isFloat({ min: 0, max: 28 }),
  body('is_active').optional().isBoolean(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { govt_fee, platform_fee, gst_percent, is_active } = req.body;
    const current = db.prepare('SELECT * FROM service_fees WHERE service_type=?').get(req.params.serviceType);
    if (!current) return res.status(404).json({ success: false, message: 'Service fee not found' });

    db.prepare(`
      UPDATE service_fees SET
        govt_fee=?, platform_fee=?, gst_percent=?, is_active=?, updated_at=datetime('now')
      WHERE service_type=?
    `).run(
      govt_fee ?? current.govt_fee,
      platform_fee ?? current.platform_fee,
      gst_percent ?? current.gst_percent,
      is_active !== undefined ? (is_active ? 1 : 0) : current.is_active,
      req.params.serviceType
    );

    auditLog(req.user.id, 'UPDATE_SERVICE_FEE', 'service_fees', req.params.serviceType, req, req.body);
    res.json({ success: true, message: 'Service fee updated' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/admin/revenue-report
// Revenue breakdown by period and service
// ─────────────────────────────────────────────────────
router.get('/revenue-report', authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const { period = 'month' } = req.query; // day | week | month | year

    const groupBy = {
      day:   "strftime('%H:00', submitted_at)",
      week:  "strftime('%w', submitted_at)",
      month: "DATE(submitted_at)",
      year:  "strftime('%Y-%m', submitted_at)",
    }[period] || "DATE(submitted_at)";

    const revenue = db.prepare(`
      SELECT ${groupBy} as period, COUNT(*) as applications,
             COALESCE(SUM(fees),0) as revenue
      FROM applications
      WHERE payment_status='paid'
      AND submitted_at >= CASE
        WHEN '${period}'='day'   THEN DATE('now')
        WHEN '${period}'='week'  THEN DATE('now','-7 days')
        WHEN '${period}'='month' THEN DATE('now','-30 days')
        ELSE DATE('now','-365 days')
      END
      GROUP BY ${groupBy} ORDER BY period
    `).all();

    const byService = db.prepare(`
      SELECT service_name, COUNT(*) as count, COALESCE(SUM(fees),0) as revenue
      FROM applications WHERE payment_status='paid'
      GROUP BY service_type ORDER BY revenue DESC
    `).all();

    res.json({ success: true, data: { timeline: revenue, by_service: byService } });
  } catch (err) { next(err); }
});

module.exports = router;
