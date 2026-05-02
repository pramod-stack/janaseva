// config/seed.js
// Run AFTER migrate.js: node config/seed.js

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const db = new Database(path.resolve(process.env.DB_PATH || './janaseva.db'));
db.pragma('foreign_keys = ON');

console.log('🌱 Seeding database...');

// ── Service Fees ──────────────────────────────────────
const fees = [
  { type: 'pan_new',          name: 'New PAN Card',               govt: 107,    platform: 15,   gst: 18 },
  { type: 'pan_correction',   name: 'PAN Correction',             govt: 107,    platform: 10,   gst: 18 },
  { type: 'pan_missing',      name: 'Find Missing PAN',           govt: 0,      platform: 30,   gst: 18 },
  { type: 'aadhaar_update',   name: 'Aadhaar Update',             govt: 50,     platform: 30,   gst: 18 },
  { type: 'pvc_aadhaar',      name: 'PVC Aadhaar Card',           govt: 50,     platform: 20,   gst: 0  },
  { type: 'passport_fresh',   name: 'Fresh Passport (36pg)',      govt: 1500,   platform: 50,   gst: 0  },
  { type: 'passport_renewal', name: 'Passport Renewal',           govt: 1500,   platform: 50,   gst: 0  },
  { type: 'passport_tatkal',  name: 'Tatkal Passport',            govt: 3500,   platform: 50,   gst: 0  },
  { type: 'driving_licence',  name: 'New Driving Licence',        govt: 250,    platform: 30,   gst: 0  },
  { type: 'dl_renewal',       name: 'DL Renewal',                 govt: 200,    platform: 30,   gst: 0  },
  { type: 'learners_licence', name: "Learner's Licence",          govt: 150,    platform: 30,   gst: 0  },
  { type: 'gst_new',          name: 'GST Registration',           govt: 0,      platform: 500,  gst: 18 },
  { type: 'gst_amendment',    name: 'GST Amendment',              govt: 0,      platform: 300,  gst: 18 },
  { type: 'msme_udyam',       name: 'Udyam MSME Registration',    govt: 0,      platform: 299,  gst: 0  },
  { type: 'caste_cert',       name: 'Caste Certificate',          govt: 0,      platform: 30,   gst: 0  },
  { type: 'income_cert',      name: 'Income Certificate',         govt: 0,      platform: 30,   gst: 0  },
  { type: 'domicile',         name: 'Domicile Certificate',       govt: 0,      platform: 30,   gst: 0  },
  { type: 'birth_death',      name: 'Birth / Death Certificate',  govt: 0,      platform: 30,   gst: 0  },
  { type: 'dsc',              name: 'Digital Signature (DSC)',     govt: 0,      platform: 1299, gst: 18 },
  { type: 'abha',             name: 'ABHA Card',                  govt: 0,      platform: 0,    gst: 0  },
  { type: 'eshram',           name: 'e-Shram Card',               govt: 0,      platform: 0,    gst: 0  },
  { type: 'pmsym',            name: 'PM-SYM Pension Enrolment',   govt: 0,      platform: 0,    gst: 0  },
  { type: 'recharge',         name: 'Mobile Recharge',            govt: 0,      platform: 2,    gst: 0  },
  { type: 'electricity',      name: 'Electricity Bill Payment',   govt: 0,      platform: 5,    gst: 0  },
  { type: 'bbps',             name: 'BBPS Bill Payment',          govt: 0,      platform: 5,    gst: 0  },
  { type: 'pvc_card',         name: 'PVC ID Card',                govt: 0,      platform: 70,   gst: 18 },
  { type: 'savings_account',  name: 'Open Savings Account',       govt: 0,      platform: 0,    gst: 0  },
  { type: 'eaadhaar_print',   name: 'E-Aadhaar Print',            govt: 0,      platform: 30,   gst: 0  },
  { type: 'rc_print',         name: 'Vehicle RC Print',           govt: 0,      platform: 40,   gst: 0  },
  { type: 'epan_print',       name: 'E-PAN Print',                govt: 0,      platform: 9,    gst: 18 },
];

const insertFee = db.prepare(`
  INSERT OR REPLACE INTO service_fees (id, service_type, service_name, govt_fee, platform_fee, gst_percent)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seedFees = db.transaction(() => {
  fees.forEach(f => insertFee.run(uuidv4(), f.type, f.name, f.govt, f.platform, f.gst));
});
seedFees();
console.log(`  ✓ ${fees.length} service fees seeded`);

// ── Admin User ────────────────────────────────────────
const adminId = uuidv4();
const adminHash = bcrypt.hashSync('Admin@1234', 12);
db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, mobile, password, role, kyc_status, wallet_balance)
  VALUES (?, 'Admin JanaSeva', 'admin@janaseva.in', '9999999999', ?, 'admin', 'verified', 0)
`).run(adminId, adminHash);
console.log('  ✓ Admin user created: admin@janaseva.in / Admin@1234');

// ── Demo Retailer ─────────────────────────────────────
const retailerId = uuidv4();
const retailerHash = bcrypt.hashSync('Retailer@123', 12);
const existingRetailer = db.prepare('SELECT id FROM users WHERE email = ?').get('arjun@janaseva.in');
if (!existingRetailer) {
  db.prepare(`
    INSERT INTO users (id, name, email, mobile, password, role, kyc_status, wallet_balance)
    VALUES (?, 'Arjun N', 'arjun@janaseva.in', '9876543210', ?, 'retailer', 'verified', 164.00)
  `).run(retailerId, retailerHash);
  db.prepare(`
    INSERT INTO retailers (id, user_id, retailer_code, shop_name, district, state, commission_rate)
    VALUES (?, ?, 'SVA-RET-00234', 'Arjun Seva Centre', 'Bengaluru Urban', 'Karnataka', 5.0)
  `).run(uuidv4(), retailerId);
  console.log('  ✓ Demo retailer: arjun@janaseva.in / Retailer@123');
}

// ── Demo Citizen ──────────────────────────────────────
const citizenId = uuidv4();
const citizenHash = bcrypt.hashSync('Citizen@123', 12);
const existingCitizen = db.prepare('SELECT id FROM users WHERE email = ?').get('ravi@example.com');
if (!existingCitizen) {
  db.prepare(`
    INSERT INTO users (id, name, email, mobile, password, role, kyc_status)
    VALUES (?, 'Ravi Kumar', 'ravi@example.com', '9123456789', ?, 'citizen', 'pending')
  `).run(citizenId, citizenHash);
  console.log('  ✓ Demo citizen: ravi@example.com / Citizen@123');
}

console.log('✅ Seed complete!');
db.close();
