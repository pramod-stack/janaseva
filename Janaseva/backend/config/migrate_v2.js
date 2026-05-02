// config/migrate_v2.js
// JanaSeva – Database V2 Migration
// Adds: service_categories, services, service_documents, service_form_fields,
//       service_fee_history, announcements, system_settings
// Run: node config/migrate_v2.js

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const db = new Database(path.resolve(process.env.DB_PATH || './janaseva.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔄 Running V2 migrations...');

db.exec(`
  -- ════════════════════════════════════════════════
  --  SERVICE CATEGORIES
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS service_categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    icon        TEXT NOT NULL DEFAULT '📋',
    color       TEXT NOT NULL DEFAULT 'blue',
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  SERVICES (fully admin-manageable)
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS services (
    id              TEXT PRIMARY KEY,
    service_type    TEXT NOT NULL UNIQUE,   -- slug: pan_new, aadhaar_update …
    name            TEXT NOT NULL,
    short_name      TEXT NOT NULL,
    category_id     TEXT NOT NULL REFERENCES service_categories(id),
    description     TEXT,
    eligibility     TEXT,                   -- who can apply
    processing_days INTEGER NOT NULL DEFAULT 7,
    govt_fee        REAL NOT NULL DEFAULT 0,
    platform_fee    REAL NOT NULL DEFAULT 0,
    gst_percent     REAL NOT NULL DEFAULT 18,
    icon            TEXT NOT NULL DEFAULT '📋',
    color           TEXT NOT NULL DEFAULT 'blue',  -- css class suffix
    is_active       INTEGER NOT NULL DEFAULT 1,
    is_free         INTEGER NOT NULL DEFAULT 0,
    requires_kyc    INTEGER NOT NULL DEFAULT 0,
    show_on_home    INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    external_url    TEXT,                   -- optional redirect to govt portal
    help_text       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by      TEXT REFERENCES users(id)
  );

  -- ════════════════════════════════════════════════
  --  SERVICE FORM FIELDS (dynamic form builder)
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS service_form_fields (
    id              TEXT PRIMARY KEY,
    service_id      TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    field_name      TEXT NOT NULL,           -- internal key: aadhaar_number
    field_label     TEXT NOT NULL,           -- display: Aadhaar Number
    field_type      TEXT NOT NULL,           -- text|number|email|tel|date|select|textarea|radio|checkbox
    placeholder     TEXT,
    default_value   TEXT,
    options         TEXT,                    -- JSON array for select/radio: ["Male","Female"]
    validation      TEXT,                    -- JSON: {"required":true,"minLength":12,"pattern":"^[0-9 ]+$"}
    help_text       TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_required     INTEGER NOT NULL DEFAULT 1,
    is_active       INTEGER NOT NULL DEFAULT 1,
    section         TEXT NOT NULL DEFAULT 'Personal Details',  -- grouping label
    grid_cols       INTEGER NOT NULL DEFAULT 1,  -- 1=half width, 2=full width
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  SERVICE DOCUMENTS (required docs per service)
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS service_documents (
    id              TEXT PRIMARY KEY,
    service_id      TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    doc_name        TEXT NOT NULL,           -- "Aadhaar Card"
    doc_key         TEXT NOT NULL,           -- aadhaar_card (internal key)
    description     TEXT,                    -- what exactly to upload
    accepted_types  TEXT NOT NULL DEFAULT 'pdf,jpg,png',
    max_size_mb     INTEGER NOT NULL DEFAULT 2,
    is_required     INTEGER NOT NULL DEFAULT 1,
    is_active       INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    sample_url      TEXT,                    -- link to sample document
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  SERVICE FEE HISTORY (audit trail for fee changes)
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS service_fee_history (
    id              TEXT PRIMARY KEY,
    service_id      TEXT NOT NULL REFERENCES services(id),
    old_govt_fee    REAL,
    old_platform_fee REAL,
    old_gst_percent REAL,
    new_govt_fee    REAL,
    new_platform_fee REAL,
    new_gst_percent REAL,
    reason          TEXT,
    changed_by      TEXT REFERENCES users(id),
    changed_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  ANNOUNCEMENTS / BANNERS
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS announcements (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'info',   -- info|success|warning|alert
    target_role TEXT DEFAULT 'all',              -- all|citizen|retailer|officer
    is_active   INTEGER NOT NULL DEFAULT 1,
    is_marquee  INTEGER NOT NULL DEFAULT 0,      -- show in header scrolling bar
    starts_at   TEXT,
    ends_at     TEXT,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  SYSTEM SETTINGS (key-value config store)
  -- ════════════════════════════════════════════════
  CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'string',  -- string|number|boolean|json
    label       TEXT NOT NULL,
    description TEXT,
    group_name  TEXT NOT NULL DEFAULT 'general',
    is_public   INTEGER NOT NULL DEFAULT 0,       -- expose to frontend API
    updated_by  TEXT REFERENCES users(id),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ════════════════════════════════════════════════
  --  UPGRADE: existing service_fees → keep for compat
  -- ════════════════════════════════════════════════

  -- ════════════════════════════════════════════════
  --  INDEXES
  -- ════════════════════════════════════════════════
  CREATE INDEX IF NOT EXISTS idx_services_cat    ON services(category_id);
  CREATE INDEX IF NOT EXISTS idx_services_type   ON services(service_type);
  CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
  CREATE INDEX IF NOT EXISTS idx_form_fields_svc ON service_form_fields(service_id);
  CREATE INDEX IF NOT EXISTS idx_docs_svc        ON service_documents(service_id);
  CREATE INDEX IF NOT EXISTS idx_fee_hist_svc    ON service_fee_history(service_id);
  CREATE INDEX IF NOT EXISTS idx_announce_active ON announcements(is_active);
  CREATE INDEX IF NOT EXISTS idx_settings_group  ON system_settings(group_name);
`);

console.log('✅ V2 tables created');
db.close();
