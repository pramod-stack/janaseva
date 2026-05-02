// routes/notifications.js

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');

// GET /api/notifications  — user's notifications
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { page = 1, limit = 30, unread_only } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (unread_only === 'true') { where += ' AND read = 0'; }

    const total = db.prepare(`SELECT COUNT(*) as c FROM notifications ${where}`).get(...params)?.c || 0;
    const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id)?.c || 0;
    const items = db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, parseInt(limit), offset);

    res.json({ success: true, data: items, unread_count: unread, pagination: { total, page: parseInt(page) } });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read  — mark one as read
router.put('/:id/read', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all  — mark all as read
router.put('/read-all', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
});

// POST /api/notifications/broadcast  [Admin only]
router.post('/broadcast', authenticate, authorize('admin'), [
  body('title').notEmpty(),
  body('message').notEmpty(),
  body('type').optional().isIn(['info', 'success', 'warning', 'error']),
  body('roles').optional().isArray(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { title, message, type = 'info', roles } = req.body;

    let query = 'SELECT id FROM users WHERE is_active = 1';
    const params = [];
    if (roles && roles.length > 0) {
      query += ` AND role IN (${roles.map(() => '?').join(',')})`;
      params.push(...roles);
    }

    const users = db.prepare(query).all(...params);
    const insert = db.prepare('INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)');
    const insertMany = db.transaction((users) => {
      users.forEach(u => insert.run(uuidv4(), u.id, title, message, type));
    });
    insertMany(users);

    res.json({ success: true, message: `Broadcast sent to ${users.length} users` });
  } catch (err) { next(err); }
});

module.exports = router;
