// routes/admin_services.js
// Full CRUD: service categories, services, form fields, documents, settings, announcements

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body, param } = require('express-validator');
const { getDb } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errorHandler');
const { auditLog } = require('../utils/helpers');

router.use(authenticate, authorize('admin'));

// ════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════

// GET /api/admin/services/categories
router.get('/categories', (req, res, next) => {
  try {
    const db = getDb();
    const cats = db.prepare(`
      SELECT c.*, COUNT(s.id) as service_count
      FROM service_categories c
      LEFT JOIN services s ON s.category_id = c.id
      GROUP BY c.id ORDER BY c.sort_order
    `).all();
    res.json({ success: true, data: cats });
  } catch (err) { next(err); }
});

// POST /api/admin/services/categories
router.post('/categories', [
  body('name').trim().notEmpty(),
  body('icon').optional().trim(),
  body('color').optional().isIn(['red','blue','green','orange','purple','teal','pink','gray']),
  body('description').optional().trim(),
  body('sort_order').optional().isInt({ min: 0 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { name, icon='📋', color='blue', description='', sort_order=0 } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const existing = db.prepare('SELECT id FROM service_categories WHERE name=? OR slug=?').get(name, slug);
    if (existing) return res.status(409).json({ success: false, message: 'Category already exists' });
    const id = uuidv4();
    db.prepare('INSERT INTO service_categories (id,name,slug,icon,color,description,sort_order) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, slug, icon, color, description, sort_order);
    auditLog(req.user.id, 'CREATE_CATEGORY', 'service_categories', id, req, { name });
    res.status(201).json({ success: true, message: 'Category created', data: { id, name, slug, icon, color } });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/categories/:id
router.put('/categories/:id', [
  body('name').optional().trim().notEmpty(),
  body('icon').optional().trim(),
  body('color').optional(),
  body('description').optional().trim(),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const curr = db.prepare('SELECT * FROM service_categories WHERE id=?').get(req.params.id);
    if (!curr) return res.status(404).json({ success: false, message: 'Category not found' });
    const { name=curr.name, icon=curr.icon, color=curr.color, description=curr.description, sort_order=curr.sort_order, is_active } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    db.prepare('UPDATE service_categories SET name=?,slug=?,icon=?,color=?,description=?,sort_order=?,is_active=?,updated_at=datetime("now") WHERE id=?')
      .run(name, slug, icon, color, description, sort_order, is_active !== undefined ? (is_active?1:0) : curr.is_active, req.params.id);
    auditLog(req.user.id, 'UPDATE_CATEGORY', 'service_categories', req.params.id, req, req.body);
    res.json({ success: true, message: 'Category updated' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/services/categories/:id
router.delete('/categories/:id', (req, res, next) => {
  try {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM services WHERE category_id=?').get(req.params.id)?.c || 0;
    if (count > 0) return res.status(400).json({ success: false, message: `Cannot delete – ${count} services use this category` });
    db.prepare('DELETE FROM service_categories WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  SERVICES
// ════════════════════════════════════════════════════

// GET /api/admin/services/list
router.get('/list', (req, res, next) => {
  try {
    const db = getDb();
    const { category_id, is_active, search } = req.query;
    let where = 'WHERE 1=1'; const params = [];
    if (category_id) { where += ' AND s.category_id=?'; params.push(category_id); }
    if (is_active !== undefined) { where += ' AND s.is_active=?'; params.push(is_active==='true'?1:0); }
    if (search) { where += ' AND (s.name LIKE ? OR s.service_type LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }

    const svcs = db.prepare(`
      SELECT s.*, c.name as category_name, c.icon as cat_icon,
        (SELECT COUNT(*) FROM service_form_fields WHERE service_id=s.id AND is_active=1) as field_count,
        (SELECT COUNT(*) FROM service_documents WHERE service_id=s.id AND is_active=1) as doc_count,
        (SELECT COUNT(*) FROM applications WHERE service_type=s.service_type) as total_applications,
        ROUND(s.govt_fee + s.platform_fee + (s.platform_fee * s.gst_percent / 100), 2) as total_fee
      FROM services s LEFT JOIN service_categories c ON c.id=s.category_id
      ${where} ORDER BY c.sort_order, s.sort_order
    `).all(...params);
    res.json({ success: true, data: svcs });
  } catch (err) { next(err); }
});

// GET /api/admin/services/:id  – full service detail
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const svc = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
    if (!svc) return res.status(404).json({ success: false, message: 'Service not found' });
    const fields = db.prepare('SELECT * FROM service_form_fields WHERE service_id=? ORDER BY sort_order').all(svc.id);
    const docs   = db.prepare('SELECT * FROM service_documents WHERE service_id=? ORDER BY sort_order').all(svc.id);
    const history = db.prepare(`
      SELECT h.*, u.name as changed_by_name FROM service_fee_history h
      LEFT JOIN users u ON u.id=h.changed_by WHERE h.service_id=? ORDER BY h.changed_at DESC LIMIT 10
    `).all(svc.id);
    const stats = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='completed' OR status='approved' THEN 1 ELSE 0 END) as approved,
        COALESCE(SUM(CASE WHEN payment_status='paid' THEN fees ELSE 0 END),0) as revenue
      FROM applications WHERE service_type=?
    `).get(svc.service_type);
    res.json({ success: true, data: { ...svc, fields, documents: docs, fee_history: history, stats } });
  } catch (err) { next(err); }
});

// POST /api/admin/services  – create service
router.post('/', [
  body('service_type').trim().notEmpty().matches(/^[a-z0-9_]+$/).withMessage('Use lowercase letters, numbers and underscores'),
  body('name').trim().notEmpty(),
  body('short_name').trim().notEmpty(),
  body('category_id').notEmpty(),
  body('govt_fee').isFloat({ min: 0 }),
  body('platform_fee').isFloat({ min: 0 }),
  body('gst_percent').isFloat({ min: 0, max: 28 }),
  body('processing_days').isInt({ min: 0 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { service_type, name, short_name, category_id, description='', eligibility='',
      processing_days=7, govt_fee=0, platform_fee=0, gst_percent=18,
      icon='📋', color='blue', is_free=0, requires_kyc=0, show_on_home=1, sort_order=0, help_text='' } = req.body;

    const exists = db.prepare('SELECT id FROM services WHERE service_type=?').get(service_type);
    if (exists) return res.status(409).json({ success: false, message: 'Service type already exists' });

    const catExists = db.prepare('SELECT id FROM service_categories WHERE id=?').get(category_id);
    if (!catExists) return res.status(400).json({ success: false, message: 'Category not found' });

    const id = uuidv4();
    db.prepare(`INSERT INTO services (id,service_type,name,short_name,category_id,description,eligibility,processing_days,govt_fee,platform_fee,gst_percent,icon,color,is_free,requires_kyc,show_on_home,sort_order,help_text,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, service_type, name, short_name, category_id, description, eligibility, processing_days, govt_fee, platform_fee, gst_percent, icon, color, is_free?1:0, requires_kyc?1:0, show_on_home?1:0, sort_order, help_text, req.user.id);

    auditLog(req.user.id, 'CREATE_SERVICE', 'services', id, req, { service_type, name });
    res.status(201).json({ success: true, message: 'Service created', data: { id, service_type, name } });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/:id  – update service
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('govt_fee').optional().isFloat({ min: 0 }),
  body('platform_fee').optional().isFloat({ min: 0 }),
  body('gst_percent').optional().isFloat({ min: 0, max: 28 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const curr = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id);
    if (!curr) return res.status(404).json({ success: false, message: 'Service not found' });

    const feeChanged = (req.body.govt_fee !== undefined && req.body.govt_fee !== curr.govt_fee) ||
                       (req.body.platform_fee !== undefined && req.body.platform_fee !== curr.platform_fee) ||
                       (req.body.gst_percent !== undefined && req.body.gst_percent !== curr.gst_percent);

    if (feeChanged) {
      db.prepare(`INSERT INTO service_fee_history (id,service_id,old_govt_fee,old_platform_fee,old_gst_percent,new_govt_fee,new_platform_fee,new_gst_percent,reason,changed_by) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(uuidv4(), curr.id, curr.govt_fee, curr.platform_fee, curr.gst_percent,
          req.body.govt_fee ?? curr.govt_fee, req.body.platform_fee ?? curr.platform_fee,
          req.body.gst_percent ?? curr.gst_percent, req.body.fee_change_reason || null, req.user.id);
    }

    const fields = ['name','short_name','category_id','description','eligibility','processing_days',
      'govt_fee','platform_fee','gst_percent','icon','color','is_active','is_free','requires_kyc',
      'show_on_home','sort_order','help_text','external_url'];
    const updates = []; const vals = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=?`); vals.push(req.body[f]); } });
    if (!updates.length) return res.json({ success: true, message: 'Nothing to update' });
    updates.push('updated_at=datetime("now")','updated_by=?'); vals.push(req.user.id, req.params.id);
    db.prepare(`UPDATE services SET ${updates.join(',')} WHERE id=?`).run(...vals);

    auditLog(req.user.id, 'UPDATE_SERVICE', 'services', req.params.id, req, req.body);
    res.json({ success: true, message: 'Service updated' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/services/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const svc = db.prepare('SELECT service_type FROM services WHERE id=?').get(req.params.id);
    if (!svc) return res.status(404).json({ success: false, message: 'Service not found' });
    const appCount = db.prepare('SELECT COUNT(*) as c FROM applications WHERE service_type=?').get(svc.service_type)?.c || 0;
    if (appCount > 0) return res.status(400).json({ success: false, message: `Cannot delete – ${appCount} applications exist. Deactivate instead.` });
    db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);
    auditLog(req.user.id, 'DELETE_SERVICE', 'services', req.params.id, req);
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  FORM FIELDS
// ════════════════════════════════════════════════════

// GET /api/admin/services/:id/fields
router.get('/:id/fields', (req, res, next) => {
  try {
    const db = getDb();
    const fields = db.prepare('SELECT * FROM service_form_fields WHERE service_id=? ORDER BY sort_order').all(req.params.id);
    res.json({ success: true, data: fields });
  } catch (err) { next(err); }
});

// POST /api/admin/services/:id/fields
router.post('/:id/fields', [
  body('field_name').trim().notEmpty().matches(/^[a-z0-9_]+$/).withMessage('Use lowercase, numbers, underscores'),
  body('field_label').trim().notEmpty(),
  body('field_type').isIn(['text','number','email','tel','date','select','textarea','radio','checkbox']),
  body('section').optional().trim(),
  body('grid_cols').optional().isInt({ min: 1, max: 2 }),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const svc = db.prepare('SELECT id FROM services WHERE id=?').get(req.params.id);
    if (!svc) return res.status(404).json({ success: false, message: 'Service not found' });

    const { field_name, field_label, field_type, placeholder='', options, validation='{"required":true}',
      help_text='', sort_order=0, is_required=1, section='Personal Details', grid_cols=1 } = req.body;

    const exists = db.prepare('SELECT id FROM service_form_fields WHERE service_id=? AND field_name=?').get(req.params.id, field_name);
    if (exists) return res.status(409).json({ success: false, message: 'Field name already exists in this service' });

    const id = uuidv4();
    db.prepare(`INSERT INTO service_form_fields (id,service_id,field_name,field_label,field_type,placeholder,options,validation,help_text,sort_order,is_required,section,grid_cols) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.params.id, field_name, field_label, field_type, placeholder,
        options ? JSON.stringify(options) : null, validation, help_text, sort_order, is_required?1:0, section, grid_cols);

    auditLog(req.user.id, 'ADD_FORM_FIELD', 'service_form_fields', id, req, { field_name, service_id: req.params.id });
    res.status(201).json({ success: true, message: 'Field added', data: { id, field_name, field_label, field_type } });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/fields/:fieldId
router.put('/fields/:fieldId', [
  body('field_label').optional().trim().notEmpty(),
  body('field_type').optional().isIn(['text','number','email','tel','date','select','textarea','radio','checkbox']),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const field = db.prepare('SELECT * FROM service_form_fields WHERE id=?').get(req.params.fieldId);
    if (!field) return res.status(404).json({ success: false, message: 'Field not found' });

    const allowed = ['field_label','field_type','placeholder','options','validation','help_text','sort_order','is_required','is_active','section','grid_cols'];
    const updates = []; const vals = [];
    allowed.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f}=?`);
        vals.push(f === 'options' && Array.isArray(req.body[f]) ? JSON.stringify(req.body[f]) : req.body[f]);
      }
    });
    if (!updates.length) return res.json({ success: true, message: 'Nothing to update' });
    updates.push('updated_at=datetime("now")'); vals.push(req.params.fieldId);
    db.prepare(`UPDATE service_form_fields SET ${updates.join(',')} WHERE id=?`).run(...vals);
    res.json({ success: true, message: 'Field updated' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/services/fields/:fieldId
router.delete('/fields/:fieldId', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM service_form_fields WHERE id=?').run(req.params.fieldId);
    res.json({ success: true, message: 'Field deleted' });
  } catch (err) { next(err); }
});

// POST /api/admin/services/:id/fields/reorder  – bulk reorder
router.post('/:id/fields/reorder', [
  body('order').isArray().withMessage('order must be array of {id, sort_order}'),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const update = db.prepare('UPDATE service_form_fields SET sort_order=? WHERE id=? AND service_id=?');
    db.transaction(() => { req.body.order.forEach(item => update.run(item.sort_order, item.id, req.params.id)); })();
    res.json({ success: true, message: 'Fields reordered' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  DOCUMENTS
// ════════════════════════════════════════════════════

// GET /api/admin/services/:id/documents
router.get('/:id/documents', (req, res, next) => {
  try {
    const db = getDb();
    const docs = db.prepare('SELECT * FROM service_documents WHERE service_id=? ORDER BY sort_order').all(req.params.id);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// POST /api/admin/services/:id/documents
router.post('/:id/documents', [
  body('doc_name').trim().notEmpty(),
  body('doc_key').trim().notEmpty().matches(/^[a-z0-9_]+$/),
  body('accepted_types').optional().trim(),
  body('max_size_mb').optional().isInt({ min: 1, max: 20 }),
  body('is_required').optional().isBoolean(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { doc_name, doc_key, description='', accepted_types='pdf,jpg,png', max_size_mb=2, is_required=1, sort_order=0, sample_url } = req.body;

    const exists = db.prepare('SELECT id FROM service_documents WHERE service_id=? AND doc_key=?').get(req.params.id, doc_key);
    if (exists) return res.status(409).json({ success: false, message: 'Document key already exists' });

    const id = uuidv4();
    db.prepare('INSERT INTO service_documents (id,service_id,doc_name,doc_key,description,accepted_types,max_size_mb,is_required,sort_order,sample_url) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, req.params.id, doc_name, doc_key, description, accepted_types, max_size_mb, is_required?1:0, sort_order, sample_url||null);

    auditLog(req.user.id, 'ADD_DOCUMENT', 'service_documents', id, req, { doc_name, service_id: req.params.id });
    res.status(201).json({ success: true, message: 'Document requirement added', data: { id, doc_name, doc_key } });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/documents/:docId
router.put('/documents/:docId', (req, res, next) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM service_documents WHERE id=?').get(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    const allowed = ['doc_name','description','accepted_types','max_size_mb','is_required','is_active','sort_order','sample_url'];
    const updates = []; const vals = [];
    allowed.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=?`); vals.push(req.body[f]); } });
    if (!updates.length) return res.json({ success: true, message: 'Nothing to update' });
    updates.push('updated_at=datetime("now")'); vals.push(req.params.docId);
    db.prepare(`UPDATE service_documents SET ${updates.join(',')} WHERE id=?`).run(...vals);
    res.json({ success: true, message: 'Document updated' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/services/documents/:docId
router.delete('/documents/:docId', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM service_documents WHERE id=?').run(req.params.docId);
    res.json({ success: true, message: 'Document requirement deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  SYSTEM SETTINGS
// ════════════════════════════════════════════════════

// GET /api/admin/services/settings (admin – all)
router.get('/settings/all', (req, res, next) => {
  try {
    const db = getDb();
    const { group } = req.query;
    let sql = 'SELECT * FROM system_settings';
    const params = [];
    if (group) { sql += ' WHERE group_name=?'; params.push(group); }
    sql += ' ORDER BY group_name, key';
    const settings = db.prepare(sql).all(...params);
    // Group them
    const grouped = {};
    settings.forEach(s => { if (!grouped[s.group_name]) grouped[s.group_name] = []; grouped[s.group_name].push(s); });
    res.json({ success: true, data: settings, grouped });
  } catch (err) { next(err); }
});

// GET /api/services/settings (public – only is_public=1)
// (handled in services route)

// PUT /api/admin/services/settings/:key
router.put('/settings/:key', [
  body('value').notEmpty(),
  body('reason').optional().trim(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const setting = db.prepare('SELECT * FROM system_settings WHERE key=?').get(req.params.key);
    if (!setting) return res.status(404).json({ success: false, message: 'Setting not found' });
    db.prepare('UPDATE system_settings SET value=?,updated_by=?,updated_at=datetime("now") WHERE key=?')
      .run(req.body.value, req.user.id, req.params.key);
    auditLog(req.user.id, 'UPDATE_SETTING', 'system_settings', req.params.key, req, { old: setting.value, new: req.body.value });
    res.json({ success: true, message: `Setting '${req.params.key}' updated` });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/settings/bulk – update multiple at once
router.put('/settings/bulk', [
  body('settings').isObject().withMessage('settings must be object {key: value}'),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const update = db.prepare('UPDATE system_settings SET value=?,updated_by=?,updated_at=datetime("now") WHERE key=?');
    db.transaction(() => {
      Object.entries(req.body.settings).forEach(([key, value]) => {
        update.run(String(value), req.user.id, key);
        auditLog(req.user.id, 'UPDATE_SETTING', 'system_settings', key, req, { new: value });
      });
    })();
    res.json({ success: true, message: `${Object.keys(req.body.settings).length} settings updated` });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ════════════════════════════════════════════════════

router.get('/announcements', (req, res, next) => {
  try {
    const db = getDb();
    const anns = db.prepare('SELECT a.*, u.name as created_by_name FROM announcements a LEFT JOIN users u ON u.id=a.created_by ORDER BY a.created_at DESC').all();
    res.json({ success: true, data: anns });
  } catch (err) { next(err); }
});

router.post('/announcements', [
  body('title').trim().notEmpty(),
  body('message').trim().notEmpty(),
  body('type').isIn(['info','success','warning','alert']),
  body('target_role').optional().isIn(['all','citizen','retailer','officer']),
  body('is_marquee').optional().isBoolean(),
], validateRequest, (req, res, next) => {
  try {
    const db = getDb();
    const { title, message, type, target_role='all', is_marquee=false, starts_at, ends_at } = req.body;
    const id = uuidv4();
    db.prepare('INSERT INTO announcements (id,title,message,type,target_role,is_marquee,starts_at,ends_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, title, message, type, target_role, is_marquee?1:0, starts_at||null, ends_at||null, req.user.id);
    res.status(201).json({ success: true, message: 'Announcement created', data: { id } });
  } catch (err) { next(err); }
});

router.put('/announcements/:id', (req, res, next) => {
  try {
    const db = getDb();
    const allowed = ['title','message','type','target_role','is_active','is_marquee','starts_at','ends_at'];
    const updates = []; const vals = [];
    allowed.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=?`); vals.push(req.body[f]); } });
    if (!updates.length) return res.json({ success: true, message: 'Nothing to update' });
    updates.push('updated_at=datetime("now")'); vals.push(req.params.id);
    db.prepare(`UPDATE announcements SET ${updates.join(',')} WHERE id=?`).run(...vals);
    res.json({ success: true, message: 'Announcement updated' });
  } catch (err) { next(err); }
});

router.delete('/announcements/:id', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
