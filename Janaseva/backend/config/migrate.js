// config/migrate.js
// Run: node config/migrate.js
// Creates all SQLite tables for JanaSeva

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './janaseva.db';
const db = new Database(path.resolve(DB_PATH));

// Enable WAL mode for concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🔄 Running migrations...');

db.exec(`
  -- ─────────────────────────────────────
  --  USERS & AUTH
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    mobile      TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    aadhaar     TEXT,
    role        TEXT NOT NULL DEFAULT 'citizen'  -- citizen | retailer | distributor | officer | admin
    ,kyc_status  TEXT NOT NULL DEFAULT 'pending'  -- pending | verified | rejected
    ,is_active   INTEGER NOT NULL DEFAULT 1
    ,wallet_balance  REAL NOT NULL DEFAULT 0.0
    ,pan_wallet      REAL NOT NULL DEFAULT 0.0
    ,state       TEXT
    ,address     TEXT
    ,created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    ,updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_store (
    id         TEXT PRIMARY KEY,
    mobile     TEXT NOT NULL,
    otp        TEXT NOT NULL,
    purpose    TEXT NOT NULL,  -- login | register | reset | aadhaar
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  WALLET & TRANSACTIONS
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL,  -- credit | debit
    wallet      TEXT NOT NULL DEFAULT 'main',  -- main | pan
    amount      REAL NOT NULL,
    balance_after REAL NOT NULL,
    description TEXT,
    ref_id      TEXT,
    status      TEXT NOT NULL DEFAULT 'completed',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  APPLICATIONS (all services)
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS applications (
    id            TEXT PRIMARY KEY,
    ref_number    TEXT UNIQUE NOT NULL,
    user_id       TEXT NOT NULL REFERENCES users(id),
    service_type  TEXT NOT NULL,   -- pan_new | pan_correction | aadhaar_update | passport | driving_licence | gst | msme | caste_cert | income_cert | domicile | birth_death | dsc | abha | eshram | pmsym | recharge | electricity | bbps | pvc_card | savings_account
    service_name  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'submitted',  -- submitted | processing | under_review | approved | rejected | dispatched | completed
    step          INTEGER NOT NULL DEFAULT 1,
    form_data     TEXT NOT NULL DEFAULT '{}',  -- JSON stringified form fields
    fees          REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | refunded
    payment_ref   TEXT,
    payment_method TEXT,
    officer_id    TEXT REFERENCES users(id),
    officer_notes TEXT,
    rejection_reason TEXT,
    certificate_url  TEXT,
    submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT
  );

  -- ─────────────────────────────────────
  --  DOCUMENTS
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS documents (
    id             TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(id),
    doc_type       TEXT NOT NULL,   -- id_proof | address_proof | photo | pan_card | aadhaar | other
    file_name      TEXT NOT NULL,
    file_path      TEXT NOT NULL,
    file_size      INTEGER,
    mime_type      TEXT,
    verified       INTEGER NOT NULL DEFAULT 0,
    uploaded_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  PAYMENTS (Razorpay / UPI orders)
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS payments (
    id              TEXT PRIMARY KEY,
    application_id  TEXT REFERENCES applications(id),
    user_id         TEXT NOT NULL REFERENCES users(id),
    order_id        TEXT UNIQUE,   -- Razorpay order ID
    payment_id      TEXT,          -- Razorpay payment ID
    amount          REAL NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'INR',
    method          TEXT,          -- card | upi | netbanking | wallet
    status          TEXT NOT NULL DEFAULT 'created',  -- created | paid | failed | refunded
    gateway_response TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  RETAILERS / AGENTS
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS retailers (
    id            TEXT PRIMARY KEY,
    user_id       TEXT UNIQUE NOT NULL REFERENCES users(id),
    retailer_code TEXT UNIQUE NOT NULL,
    distributor_id TEXT REFERENCES retailers(id),
    shop_name     TEXT,
    shop_address  TEXT,
    district      TEXT,
    state         TEXT,
    commission_rate REAL NOT NULL DEFAULT 0.0,
    total_earned  REAL NOT NULL DEFAULT 0.0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  NOTIFICATIONS
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'info',  -- info | success | warning | error
    read        INTEGER NOT NULL DEFAULT 0,
    action_url  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  SERVICE FEES CONFIG
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS service_fees (
    id           TEXT PRIMARY KEY,
    service_type TEXT UNIQUE NOT NULL,
    service_name TEXT NOT NULL,
    govt_fee     REAL NOT NULL DEFAULT 0,
    platform_fee REAL NOT NULL DEFAULT 0,
    gst_percent  REAL NOT NULL DEFAULT 18,
    is_active    INTEGER NOT NULL DEFAULT 1,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  AUDIT LOG
  -- ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    user_id     TEXT,
    action      TEXT NOT NULL,
    entity      TEXT,
    entity_id   TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────
  --  INDEXES
  -- ─────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_apps_user     ON applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_apps_ref      ON applications(ref_number);
  CREATE INDEX IF NOT EXISTS idx_apps_status   ON applications(status);
  CREATE INDEX IF NOT EXISTS idx_docs_app      ON documents(application_id);
  CREATE INDEX IF NOT EXISTS idx_walletTx_user ON wallet_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_notif_user    ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_app  ON payments(application_id);
  CREATE INDEX IF NOT EXISTS idx_otp_mobile    ON otp_store(mobile);
`);

console.log('✅ All tables created successfully.');
db.close();
