// middleware/errorHandler.js
const { getDb } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Central error handler. Always returns JSON.
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Log to audit table if db is available
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, entity, ip_address, metadata, created_at)
      VALUES (?, ?, 'ERROR', 'server', ?, ?, datetime('now'))
    `).run(uuidv4(), req.user?.id || null, req.ip, JSON.stringify({ path: req.path, error: err.message }));
  } catch (_) { /* silent */ }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler for unmatched routes.
 */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
}

/**
 * Validate express-validator results.
 */
const { validationResult } = require('express-validator');
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
}

module.exports = { errorHandler, notFound, validateRequest };
