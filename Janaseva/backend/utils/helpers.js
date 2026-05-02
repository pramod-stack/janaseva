// utils/helpers.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/db');

// ─── Reference Number Generator ─────────────────────
const SERVICE_PREFIXES = {
  pan_new:          'PAN',
  pan_correction:   'PANC',
  pan_missing:      'PANM',
  aadhaar_update:   'AADH',
  pvc_aadhaar:      'PVCA',
  passport_fresh:   'PASS',
  passport_renewal: 'PREN',
  passport_tatkal:  'PTAT',
  driving_licence:  'DL',
  dl_renewal:       'DLR',
  learners_licence: 'LL',
  gst_new:          'GST',
  gst_amendment:    'GSTA',
  msme_udyam:       'MSME',
  caste_cert:       'CAST',
  income_cert:      'INC',
  domicile:         'DOM',
  birth_death:      'BDC',
  dsc:              'DSC',
  abha:             'ABHA',
  eshram:           'ESHR',
  pmsym:            'PMSYM',
  recharge:         'RCH',
  electricity:      'EBILL',
  bbps:             'BBPS',
  pvc_card:         'PVC',
  savings_account:  'BANK',
  eaadhaar_print:   'EADH',
  rc_print:         'RC',
  epan_print:       'EPAN',
};

function generateRefNumber(serviceType) {
  const prefix = SERVICE_PREFIXES[serviceType] || 'SVC';
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${ts}-${rand}`;
}

// ─── Fee Calculator ──────────────────────────────────
function calculateFees(serviceType) {
  const db = getDb();
  const fee = db.prepare('SELECT * FROM service_fees WHERE service_type = ?').get(serviceType);
  if (!fee) return { govt_fee: 0, platform_fee: 0, gst_amount: 0, total: 0 };
  const gst = (fee.platform_fee * fee.gst_percent) / 100;
  return {
    govt_fee:     fee.govt_fee,
    platform_fee: fee.platform_fee,
    gst_percent:  fee.gst_percent,
    gst_amount:   Math.round(gst * 100) / 100,
    total:        Math.round((fee.govt_fee + fee.platform_fee + gst) * 100) / 100,
  };
}

// ─── JWT Helpers ─────────────────────────────────────
function generateTokens(userId) {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'sevaone_fallback_secret_key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
}

// ─── OTP Generator ───────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(mobile, otp, purpose = 'login') {
  const db = getDb();
  // Invalidate old OTPs for this mobile + purpose
  db.prepare("UPDATE otp_store SET used = 1 WHERE mobile = ? AND purpose = ? AND used = 0").run(mobile, purpose);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
  db.prepare(`
    INSERT INTO otp_store (id, mobile, otp, purpose, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), mobile, otp, purpose, expiresAt);
}

function verifyOTP(mobile, otp, purpose = 'login') {
  const db = getDb();
  const record = db.prepare(`
    SELECT * FROM otp_store 
    WHERE mobile = ? AND otp = ? AND purpose = ? AND used = 0
    AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(mobile, otp, purpose);
  if (!record) return false;
  db.prepare('UPDATE otp_store SET used = 1 WHERE id = ?').run(record.id);
  return true;
}

// ─── Notification Creator ────────────────────────────
function createNotification(userId, title, message, type = 'info', actionUrl = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, action_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), userId, title, message, type, actionUrl);
}

// ─── Audit Logger ────────────────────────────────────
function auditLog(userId, action, entity, entityId, req, metadata = {}) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, entity, entity_id, ip_address, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, action, entity, entityId,
      req?.ip || null, req?.headers?.['user-agent'] || null, JSON.stringify(metadata));
  } catch (_) {}
}

// ─── Pagination Helper ────────────────────────────────
function paginate(query, params, page = 1, limit = 20) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const total = db.prepare(`SELECT COUNT(*) as count FROM (${query})`).get(...params)?.count || 0;
  const data = db.prepare(`${query} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

module.exports = { generateRefNumber, calculateFees, generateTokens, generateOTP, storeOTP, verifyOTP, createNotification, auditLog, paginate };
