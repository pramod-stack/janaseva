// routes/applications.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, query, param } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const upload = require('../middleware/upload');
const { generateRefNumber, calculateFees, createNotification, auditLog } = require('../utils/helpers');

const VALID_SERVICE_TYPES = [
  'pan_new','pan_correction','pan_missing','aadhaar_update','pvc_aadhaar',
  'passport_fresh','passport_renewal','passport_tatkal',
  'driving_licence','dl_renewal','learners_licence',
  'gst_new','gst_amendment','gst_composition',
  'msme_udyam','caste_cert','income_cert','domicile','birth_death',
  'dsc','abha','eshram','pmsym',
  'recharge','electricity','bbps',
  'pvc_card','savings_account','eaadhaar_print','rc_print','epan_print',
];

// ─────────────────────────────────────────────────────
// POST /api/applications/submit
// Submit a new service application
// ─────────────────────────────────────────────────────
router.post('/submit',
  authenticate,
  upload.array('documents', 6),
  [
    body('service_type').isIn(VALID_SERVICE_TYPES).withMessage('Invalid service type'),
    body('form_data').notEmpty().withMessage('Form data required'),
  ],
  validateRequest,
  (req, res, next) => {
    try {
      const db = getDb();
      const { service_type, form_data } = req.body;

      // Parse form data
      let parsedData;
      try { parsedData = JSON.parse(form_data); } catch { parsedData = req.body; }

      // Get service fee
      const feeRow = db.prepare('SELECT * FROM service_fees WHERE service_type = ?').get(service_type);
      const fees = calculateFees(service_type);

      // Create application
      const appId = uuidv4();
      const refNumber = generateRefNumber(service_type);
      const serviceName = feeRow?.service_name || service_type.replace(/_/g, ' ').toUpperCase();

      db.prepare(`
        INSERT INTO applications (id, ref_number, user_id, service_type, service_name, form_data, fees, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(appId, refNumber, req.user.id, service_type, serviceName,
        JSON.stringify(parsedData), fees.total,
        fees.total === 0 ? 'not_required' : 'pending');

      // Save uploaded documents
      if (req.files && req.files.length > 0) {
        const insertDoc = db.prepare(`
          INSERT INTO documents (id, application_id, user_id, doc_type, file_name, file_path, file_size, mime_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        req.files.forEach(file => {
          insertDoc.run(uuidv4(), appId, req.user.id,
            file.fieldname || 'doc', file.originalname, file.path, file.size, file.mimetype);
        });
      }

      // Notification
      createNotification(req.user.id,
        `Application Submitted – ${serviceName}`,
        `Your application ${refNumber} has been submitted successfully. Track status using this reference number.`,
        'success', `/track/${refNumber}`);

      auditLog(req.user.id, 'SUBMIT_APPLICATION', 'applications', appId, req, { service_type, refNumber });

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: {
          application_id: appId,
          ref_number: refNumber,
          service_name: serviceName,
          status: 'submitted',
          fees,
          payment_required: fees.total > 0,
          submitted_at: new Date().toISOString(),
        }
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────
// GET /api/applications/track/:refNumber
// Track application by reference number (public)
// ─────────────────────────────────────────────────────
router.get('/track/:refNumber', [
  param('refNumber').notEmpty(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const app = db.prepare(`
      SELECT a.id, a.ref_number, a.service_name, a.service_type, a.status, a.step,
             a.payment_status, a.fees, a.submitted_at, a.updated_at, a.completed_at,
             a.certificate_url, a.rejection_reason,
             u.name as applicant_name
      FROM applications a
      JOIN users u ON u.id = a.user_id
      WHERE a.ref_number = ?
    `).get(req.params.refNumber.toUpperCase());

    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    const STATUS_STEPS = {
      submitted:    1, processing: 2, under_review: 3,
      approved:     4, dispatched: 5, completed:    5, rejected: 0,
    };

    res.json({
      success: true,
      data: {
        ...app,
        step_number: STATUS_STEPS[app.status] || 1,
        steps: ['Submitted', 'Processing', 'Under Review', 'Approved', 'Completed'],
      }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/applications/my
// Get authenticated user's applications
// ─────────────────────────────────────────────────────
router.get('/my', authenticate, [
  query('status').optional().isIn(['submitted','processing','under_review','approved','rejected','completed']),
  query('service_type').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { status, service_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (service_type) { where += ' AND service_type = ?'; params.push(service_type); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM applications ${where}`).get(...params)?.c || 0;
    const apps = db.prepare(`
      SELECT id, ref_number, service_name, service_type, status, step, fees, payment_status,
             submitted_at, updated_at, certificate_url
      FROM applications ${where}
      ORDER BY submitted_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({
      success: true,
      data: apps,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/applications/:id
// Get single application details (owner or officer/admin)
// ─────────────────────────────────────────────────────
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Not found' });

    const isOwner = app.user_id === req.user.id;
    const isOfficer = ['officer', 'admin'].includes(req.user.role);
    if (!isOwner && !isOfficer) return res.status(403).json({ success: false, message: 'Forbidden' });

    const docs = db.prepare('SELECT id, doc_type, file_name, uploaded_at, verified FROM documents WHERE application_id = ?').all(app.id);
    res.json({ success: true, data: { ...app, form_data: JSON.parse(app.form_data || '{}'), documents: docs } });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// PUT /api/applications/:id/status  [Officer/Admin]
// Update application status
// ─────────────────────────────────────────────────────
router.put('/:id/status', authenticate, authorize('officer', 'admin'), [
  body('status').isIn(['processing','under_review','approved','rejected','dispatched','completed']),
  body('notes').optional().trim(),
  body('rejection_reason').optional().trim(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { status, notes, rejection_reason, certificate_url } = req.body;

    const STATUS_STEPS = { processing:2, under_review:3, approved:4, dispatched:5, completed:5, rejected:0 };

    db.prepare(`
      UPDATE applications
      SET status=?, step=?, officer_id=?, officer_notes=?, rejection_reason=?,
          certificate_url=?, updated_at=datetime('now'),
          completed_at = CASE WHEN ? IN ('completed','approved') THEN datetime('now') ELSE completed_at END
      WHERE id=?
    `).run(status, STATUS_STEPS[status], req.user.id, notes||null, rejection_reason||null,
       certificate_url||null, status, req.params.id);

    const app = db.prepare('SELECT user_id, service_name, ref_number FROM applications WHERE id=?').get(req.params.id);
    if (app) {
      const msgs = {
        approved: `✅ Your application ${app.ref_number} (${app.service_name}) has been approved!`,
        rejected: `❌ Application ${app.ref_number} was rejected. Reason: ${rejection_reason || 'See portal'}`,
        processing: `⚙️ Application ${app.ref_number} is now being processed.`,
        completed: `🎉 Application ${app.ref_number} is complete. Download your certificate now.`,
      };
      if (msgs[status]) createNotification(app.user_id, `Application ${status.toUpperCase()}`, msgs[status], status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info');
    }

    auditLog(req.user.id, 'UPDATE_APP_STATUS', 'applications', req.params.id, req, { status });
    res.json({ success: true, message: `Application status updated to ${status}` });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────
// GET /api/applications  [Admin/Officer – all applications]
// ─────────────────────────────────────────────────────
router.get('/', authenticate, authorize('officer', 'admin'), [
  query('status').optional(),
  query('service_type').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { status, service_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND a.status = ?'; params.push(status); }
    if (service_type) { where += ' AND a.service_type = ?'; params.push(service_type); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM applications a ${where}`).get(...params)?.c || 0;
    const apps = db.prepare(`
      SELECT a.id, a.ref_number, a.service_name, a.status, a.fees, a.payment_status, a.submitted_at,
             u.name as applicant_name, u.mobile as applicant_mobile
      FROM applications a JOIN users u ON u.id = a.user_id
      ${where} ORDER BY a.submitted_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ success: true, data: apps, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

module.exports = router;
