// config/seed_janasevaka.js
// Seeds all Janasevaka services from the official service list
// Run AFTER seed_v2.js: node config/seed_janasevaka.js

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const db = new Database(path.resolve(process.env.DB_PATH || './janaseva.db'));
db.pragma('foreign_keys = ON');
console.log('🌱 Seeding Janasevaka services...\n');

const insertCat  = db.prepare(`INSERT OR REPLACE INTO service_categories (id,name,slug,icon,color,description,sort_order) VALUES (?,?,?,?,?,?,?)`);
const insertSvc  = db.prepare(`INSERT OR REPLACE INTO services (id,service_type,name,short_name,category_id,description,eligibility,processing_days,govt_fee,platform_fee,gst_percent,icon,color,is_free,requires_kyc,show_on_home,sort_order,help_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertDoc  = db.prepare(`INSERT OR REPLACE INTO service_documents (id,service_id,doc_name,doc_key,description,accepted_types,max_size_mb,is_required,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`);
const insertFee  = db.prepare(`INSERT OR REPLACE INTO service_fees (id,service_type,service_name,govt_fee,platform_fee,gst_percent) VALUES (?,?,?,?,?,?)`);

// ─── CATEGORIES ───────────────────────────────────────
const CATS = [
  ['jcat-01','Health','health','🏥','teal','Health cards and medical services',10],
  ['jcat-02','Aadhaar Services','aadhaar-js','🪪','red','UIDAI Aadhaar enrolment and updates',11],
  ['jcat-03','Revenue Certificates','revenue','📄','blue','Income, caste, domicile and other Revenue Dept certificates',12],
  ['jcat-04','Pension & Welfare Schemes','pension','👴','green','Government pension schemes and welfare programs',13],
  ['jcat-05','BBMP Services','bbmp','🏙️','orange','Khatha transfer, registration, and BBMP property services',14],
  ['jcat-06','Police Services','police','👮','purple','Police verification certificates',15],
  ['jcat-07','Senior Citizen','senior','🧓','pink','Senior citizen cards and services',16],
  ['jcat-08','Construction Workers','construction','🏗️','gray','Karnataka Building & Other Construction Workers Welfare Board',17],
];

const catMap = {};
db.transaction(() => {
  CATS.forEach(c => {
    insertCat.run(...c);
    catMap[c[1]] = c[0];
  });
})();
console.log(`  ✓ ${CATS.length} Janasevaka categories`);

// ─── SERVICES ─────────────────────────────────────────
// [id, type, name, short_name, cat_id, desc, eligibility, days, govt_fee, platform_fee, gst%, icon, color, is_free, req_kyc, show_home, sort, help_text]

const SVCS = [
  // ── Health ──────────────────────────────────────────
  ['js-01','arogya_health_card','Arogya Health Card','Arogya Card',catMap['Health'],
    'Apply for the Arogya Karnataka health card for government health scheme benefits.',
    'Karnataka residents with Aadhaar card.',1,50,115,0,'🏥','teal',0,0,1,1,
    'Jana Sevaka charges ₹115. Govt fee ₹50. Bring Aadhaar card. Ration card optional.'],

  // ── Aadhaar ─────────────────────────────────────────
  ['js-02','aadhaar_new_enrolment','Aadhaar New Enrolment','Aadhaar Enrolment',catMap['Aadhaar Services'],
    'Fresh Aadhaar enrolment for first-time applicants.',
    'Indian citizens without an Aadhaar card.',20,0,115,0,'🪪','red',0,0,1,1,
    'Processing time 15-20 days. No govt fee. JS charge ₹115.'],
  ['js-03','aadhaar_biometric_update','Biometric Update (Aadhaar)','Biometric Update',catMap['Aadhaar Services'],
    'Update fingerprints, iris, or photo in Aadhaar records.',
    'Any Aadhaar card holder.',20,100,115,0,'👆','red',0,0,1,2,
    'Govt fee ₹100 + JS charge ₹115 = ₹215 total.'],
  ['js-04','aadhaar_demographic_update','Demographic Update/Correction in Aadhaar','Aadhaar Correction',catMap['Aadhaar Services'],
    'Correct name, date of birth, gender, address, or mobile number in Aadhaar.',
    'Any Aadhaar card holder.',20,50,115,0,'✏️','orange',0,0,1,3,
    'Govt fee ₹50 + JS charge ₹115 = ₹165 total.'],
  ['js-05','aadhaar_mandatory_biometric','Mandatory Biometric Update (5–15 years)','Mandatory Biometric',catMap['Aadhaar Services'],
    'Mandatory biometric update for children between 5 and 15 years of age.',
    'Children aged 5–15 years with existing Aadhaar.',20,0,115,0,'🧒','red',0,0,1,4,
    'No govt fee. JS charge ₹115.'],

  // ── Revenue Certificates ─────────────────────────────
  ['js-06','revenue_income_certificate','Income Certificate','Income Cert',catMap['Revenue Certificates'],
    'Annual family income certificate issued by Revenue / Tehsildar department.',
    'Karnataka residents. Aadhaar of any Karnataka location required.',21,35,115,0,'💰','blue',0,0,1,1,
    'Govt fee ₹35 + JS ₹115 = ₹150. Processing: 21 days.'],
  ['js-07','revenue_caste_certificate','Caste Certificate (Cat-A)','Caste Cert',catMap['Revenue Certificates'],
    'Official caste/community certificate (Category A) from Revenue Department.',
    'Karnataka residents. SC/ST/OBC classification.',21,50,115,0,'📄','blue',0,0,1,2,
    'Govt fee ₹50 + JS ₹115 = ₹165. Transfer Certificate and Self Declaration required.'],
  ['js-08','revenue_caste_income_cert','Caste and Income Certificate','Caste+Income',catMap['Revenue Certificates'],
    'Combined caste and income certificate from Revenue Department.',
    'Karnataka residents.',21,35,115,0,'📄','blue',0,0,1,3,
    'Govt fee ₹35 + JS ₹115 = ₹150.'],
  ['js-09','revenue_land_holding','Land Holding Certificate','Land Holding',catMap['Revenue Certificates'],
    'Certificate confirming land holding status from Revenue Department.',
    'Karnataka land holders.',21,35,115,0,'🌾','green',0,0,1,4,
    'Govt fee ₹35 + JS ₹115 = ₹150. Voter ID required.'],
  ['js-10','revenue_bonafide','Bonafide Certificate','Bonafide',catMap['Revenue Certificates'],
    'Bonafide residence/citizenship certificate from Revenue Department.',
    'Karnataka residents.',21,35,115,0,'📋','blue',0,0,1,5,
    'Govt fee ₹35 + JS ₹115 = ₹150.'],
  ['js-11','revenue_solvency','Solvency Certificate','Solvency',catMap['Revenue Certificates'],
    'Certificate of financial solvency for tenders, loans and legal requirements.',
    'Karnataka property owners.',21,35,115,0,'🏦','orange',0,0,1,6,
    'Requires RTC copy, EC (Encumbrance Certificate), and property documents.'],
  ['js-12','revenue_family_tree','Attestation of Family Tree','Family Tree',catMap['Revenue Certificates'],
    'Official attestation of family tree/genealogy for legal and inheritance purposes.',
    'Karnataka residents.',7,35,115,0,'🌳','green',0,0,1,7,
    'Processing 7 days. Affidavit and Death Certificate required.'],
  ['js-13','revenue_non_creamy_layer','Non-Creamy Layer Certificate','Non-Creamy Layer',catMap['Revenue Certificates'],
    'Non-creamy layer certificate for OBC applicants for reservations and schemes.',
    'OBC category Karnataka residents.',21,35,115,0,'📄','teal',0,0,1,8,
    'School TC required if studied. Ration card and Voter ID optional.'],
  ['js-14','income_cert_compassionate','Income Certificate for Compassionate Appointment','Compassionate Income',catMap['Revenue Certificates'],
    'Special income certificate for compassionate appointment applications.',
    'Karnataka residents applying for compassionate government employment.',21,35,115,0,'💼','blue',0,0,1,9,
    'Salary certificate and bank statement for last one year required.'],
  ['js-15','revenue_living_certificate','Living Certificate','Living Cert',catMap['Revenue Certificates'],
    'Certificate confirming the applicant is alive, for pension and legal purposes.',
    'Karnataka residents.',21,35,115,0,'✅','green',0,0,1,10,
    'Self declaration required.'],
  ['js-16','revenue_obc_central','OBC Certificate (Central)','OBC Central',catMap['Revenue Certificates'],
    'Central OBC (Other Backward Classes) certificate for central government reservations.',
    'Karnataka OBC residents.',21,35,115,0,'📄','orange',0,0,1,11,
    'School TC, Old Caste Certificate, relatives certificate and self declaration required.'],
  ['js-17','revenue_residence_cert','Residence Certificate','Residence Cert',catMap['Revenue Certificates'],
    'Certificate of current residence from Revenue Department.',
    'Karnataka residents.',7,35,115,0,'🏠','blue',0,0,1,12,
    'Processing 7 days. Rental agreement required. Ration card and Voter ID optional.'],
  ['js-18','revenue_domicile','Domicile Certificate','Domicile',catMap['Revenue Certificates'],
    'State domicile certificate confirming long-term residence in Karnataka.',
    'Karnataka residents.',7,35,115,0,'🏛️','purple',0,0,1,13,
    'Processing 7 days. Ration card and Voter ID optional.'],

  // ── Pension & Welfare ────────────────────────────────
  ['js-19','ignoaps_pension','Indira Gandhi National Old Age Pension (IGNOAPS)','Old Age Pension',catMap['Pension & Welfare Schemes'],
    'Central government old age pension scheme for citizens above 60 years.',
    'Karnataka residents above 60 years.',45,35,115,0,'👴','green',0,0,1,1,
    'Ration card, Voter ID, age certificate, passport photo, and bank passbook required.'],
  ['js-20','widow_pension','Widow Pension','Widow Pension',catMap['Pension & Welfare Schemes'],
    'Monthly pension for widows under Karnataka state welfare scheme.',
    'Karnataka widows above 18 years of age.',45,35,115,0,'🙏','teal',0,0,1,2,
    'Husband death certificate, age certificate, ration card, bank passbook and photo required.'],
  ['js-21','physically_handicapped_pension','Physically Handicapped Pension','PH Pension',catMap['Pension & Welfare Schemes'],
    'Monthly pension for physically handicapped citizens of Karnataka.',
    'Karnataka residents with physical disability.',45,35,115,0,'♿','blue',0,0,1,3,
    'Doctor certified disability certificate, ration card, Voter ID, photo, bank passbook required.'],
  ['js-22','anthya_samskara_yojane','Anthya Samskara Yojane (ASY) – Funeral Assistance','Funeral Assistance',catMap['Pension & Welfare Schemes'],
    'Government financial assistance for funeral expenses under ASY scheme.',
    'Karnataka BPL families.',45,35,115,0,'🙏','gray',0,0,1,4,
    'Bank passbook required. Ration card and Voter ID optional.'],
  ['js-23','acid_victim_pension','Acid Victim Pension (AVP)','Acid Victim Pension',catMap['Pension & Welfare Schemes'],
    'Monthly pension support for acid attack victims in Karnataka.',
    'Karnataka acid attack survivors.',45,35,115,0,'💊','red',0,0,1,5,
    'Bank passbook and doctor certificate required.'],
  ['js-24','no_govt_job_cert','No Government Job Certificate','No Govt Job Cert',catMap['Pension & Welfare Schemes'],
    'Certificate confirming the applicant does not hold a government job.',
    'Karnataka residents.',45,35,115,0,'📄','orange',0,0,1,6,
    'Processing 45 days. Ration card and Voter ID optional.'],
  ['js-25','unemployment_certificate','Unemployment Certificate','Unemployment Cert',catMap['Pension & Welfare Schemes'],
    'Unemployment certificate for registered job seekers from Employment Exchange.',
    'Karnataka residents registered with Employment Exchange.',45,35,115,0,'💼','blue',0,0,1,7,
    'Acknowledgement of registration in employment exchange required.'],
  ['js-26','widow_certificate','Widow Certificate','Widow Cert',catMap['Pension & Welfare Schemes'],
    'Certificate confirming widow status for welfare scheme eligibility.',
    'Karnataka widows.',45,35,115,0,'📄','purple',0,0,1,8,
    'Husband death certificate and self declaration required.'],
  ['js-27','sandhya_suraksha_yojane','Sandhya Suraksha Yojane','Sandhya Suraksha',catMap['Pension & Welfare Schemes'],
    'Karnataka state pension scheme for senior citizens above 65 years.',
    'Karnataka residents above 65 years.',45,40,115,0,'🌅','green',0,0,1,9,
    'Age certificate, ration card, Voter ID, passport photo, and bank passbook required.'],

  // ── Senior Citizen ───────────────────────────────────
  ['js-28','senior_citizen_card','Senior Citizen Card','Senior Citizen Card',catMap['Senior Citizen'],
    'Official senior citizen card issued by Department for Empowerment of Differently Abled and Senior Citizen.',
    'Karnataka residents above senior citizen age threshold.',45,40,115,0,'🧓','pink',0,0,1,1,
    'Blood group certificate and passport photo required. SSLC marks card optional.'],

  // ── Police ──────────────────────────────────────────
  ['js-29','pvc_domestic_servants','Police Verification Certificate – Domestic Servants','PVC Domestic',catMap['Police Services'],
    'Police verification certificate for domestic servants and housekeeping staff.',
    'Employers of domestic workers in Karnataka.',21,455,115,0,'👮','purple',0,0,1,1,
    'Aadhaar card and 1 passport photo required. Rental agreement optional. Total ₹570.'],
  ['js-30','pvc_job_antecedents','Police Verification Certificate – Job (Antecedents)','PVC Job',catMap['Police Services'],
    'Police verification certificate for job purposes (antecedents check) for MNCs/private companies.',
    'Job applicants in Karnataka.',21,755,115,0,'👮','purple',0,0,1,2,
    'Aadhaar card and 1 passport photo required. Total ₹870.'],
  ['js-31','pvc_job_address','Police Verification Certificate – Job (Address + Antecedents)','PVC Address+Job',catMap['Police Services'],
    'Police verification certificate including address verification and antecedents for corporate employment.',
    'Job applicants in Karnataka.',21,1505,115,0,'👮','purple',0,0,1,3,
    'Aadhaar card and 1 passport photo required. Total ₹1620.'],

  // ── BBMP Services ────────────────────────────────────
  ['js-32','bbmp_khatha_transfer_sale_single','Khatha Transfer – Sale Deed (Single)','Khatha Transfer Single',catMap['BBMP Services'],
    'Transfer of BBMP Khatha to new owner based on sale deed (single owner).',
    'Property buyers in Bengaluru with registered sale deed.',30,0,115,0,'🏘️','orange',0,0,1,1,
    'Sale deed, tax paid receipt (current year), and Encumbrance Certificate (Form-15) required.'],
  ['js-33','bbmp_khatha_transfer_sale_joint','Khatha Transfer – Sale Deed (Joint)','Khatha Transfer Joint',catMap['BBMP Services'],
    'Transfer of BBMP Khatha to new joint owners based on sale deed.',
    'Joint property buyers in Bengaluru.',30,0,115,0,'🏘️','orange',0,0,1,2,
    'Sale deed, tax receipt, EC, and affidavit required.'],
  ['js-34','bbmp_khatha_transfer_inheritance_single','Khatha Transfer – Inheritance (Single)','Inheritance Khatha Single',catMap['BBMP Services'],
    'BBMP Khatha transfer through inheritance for single heir.',
    'Legal heirs of property in Bengaluru.',30,0,115,0,'📜','teal',0,0,1,3,
    'Title deed, death certificate, will, EC, notarized family tree, and NOC from family members required.'],
  ['js-35','bbmp_khatha_transfer_inheritance_joint','Khatha Transfer – Inheritance (Joint)','Inheritance Khatha Joint',catMap['BBMP Services'],
    'BBMP Khatha transfer through inheritance for joint heirs.',
    'Multiple legal heirs of property in Bengaluru.',30,0,115,0,'📜','teal',0,0,1,4,
    'Title deed, death certificate, will, EC, notarized family tree, NOC, and affidavit required.'],
  ['js-36','bbmp_khatha_transfer_gift_single','Khatha Transfer – Gift Deed (Single)','Gift Deed Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on registered gift deed (single owner).',
    'Gift deed recipients in Bengaluru.',30,0,115,0,'🎁','orange',0,0,1,5,
    'Title deed, gift deed, tax receipt, and EC required.'],
  ['js-37','bbmp_khatha_transfer_gift_joint','Khatha Transfer – Gift Deed (Joint)','Gift Deed Joint Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on registered gift deed (joint owners).',
    'Joint gift deed recipients in Bengaluru.',30,0,115,0,'🎁','orange',0,0,1,6,
    'Title deed, gift deed, tax receipt, EC, and affidavit required.'],
  ['js-38','bbmp_khatha_court_decree_single','Khatha Transfer – Court Decree (Single)','Court Decree Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on court decree (single party).',
    'Court decree holders for Bengaluru property.',30,0,115,0,'⚖️','red',0,0,1,7,
    'Court decree, title deed, tax receipt, and EC required.'],
  ['js-39','bbmp_khatha_court_decree_joint','Khatha Transfer – Court Decree (Joint)','Court Decree Joint',catMap['BBMP Services'],
    'BBMP Khatha transfer based on court decree (joint parties).',
    'Multiple court decree holders for Bengaluru property.',30,0,115,0,'⚖️','red',0,0,1,8,
    'Court decree, title deed, tax receipt, EC, and affidavit required.'],
  ['js-40','bbmp_khatha_partition_single','Khatha Transfer – Partition Deed (Single)','Partition Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on registered partition deed (single owner).',
    'Partition deed holders in Bengaluru.',30,0,115,0,'📐','blue',0,0,1,9,
    'Partition deed, title deed, tax receipt, and EC required.'],
  ['js-41','bbmp_khatha_partition_joint','Khatha Transfer – Partition Deed (Joint)','Partition Joint Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on registered partition deed (joint owners).',
    'Joint partition deed holders in Bengaluru.',30,0,115,0,'📐','blue',0,0,1,10,
    'Partition deed, title deed, tax receipt, EC, and affidavit required.'],
  ['js-42','bbmp_khatha_release_single','Khatha Transfer – Release Deed (Single)','Release Deed Khatha',catMap['BBMP Services'],
    'BBMP Khatha transfer based on release deed (single owner).',
    'Release deed holders in Bengaluru.',30,0,115,0,'🔓','green',0,0,1,11,
    'Release deed, title deed, tax receipt, and EC required.'],
  ['js-43','bbmp_khatha_release_joint','Khatha Transfer – Release Deed (Joint)','Release Deed Joint',catMap['BBMP Services'],
    'BBMP Khatha transfer based on release deed (joint owners).',
    'Joint release deed holders in Bengaluru.',30,0,115,0,'🔓','green',0,0,1,12,
    'Release deed, title deed, tax receipt, EC, and affidavit required.'],
  ['js-44','bbmp_khatha_bifurcation_single','Khatha Bifurcation – Sale Deed (Single)','Khatha Bifurcation',catMap['BBMP Services'],
    'Bifurcation of BBMP Khatha based on sale deed (single owner).',
    'Property owners in Bengaluru splitting property.',30,0,115,0,'✂️','purple',0,0,1,13,
    'Sale deed, tax receipt, EC, self-attested sketch, and Improvement Charges Receipt required.'],
  ['js-45','bbmp_khatha_bifurcation_joint','Khatha Bifurcation – Sale Deed (Joint)','Khatha Bifurcation Joint',catMap['BBMP Services'],
    'Bifurcation of BBMP Khatha based on sale deed (joint owners).',
    'Joint property owners splitting property in Bengaluru.',30,0,115,0,'✂️','purple',0,0,1,14,
    'Sale deed, tax receipt, EC, sketch, affidavit, and Improvement Charges Receipt required.'],
  ['js-46','bbmp_khatha_registration_single','Khatha Registration (Single Owner)','Khatha Reg. Single',catMap['BBMP Services'],
    'New BBMP Khatha registration for single owner of converted land.',
    'Single owners of newly converted land in Bengaluru.',30,0,115,0,'📋','teal',0,0,1,15,
    'Previous and current title deeds, land conversion order, RTC, EC, and location sketch required.'],
  ['js-47','bbmp_khatha_registration_joint','Khatha Registration (Joint)','Khatha Reg. Joint',catMap['BBMP Services'],
    'New BBMP Khatha registration for joint owners of converted land.',
    'Joint owners of newly converted land in Bengaluru.',30,0,115,0,'📋','teal',0,0,1,16,
    'Previous and current title deeds, conversion order, RTC, EC, location sketch, and joint declaration required.'],
  ['js-48','bbmp_khatha_amalgamation','Khatha Amalgamation – Sale Deed','Khatha Amalgamation',catMap['BBMP Services'],
    'Amalgamation of multiple BBMP Khathas based on sale deed.',
    'Property owners combining adjacent properties in Bengaluru.',30,0,115,0,'🔗','orange',0,0,1,17,
    'Sale deeds, tax receipt, EC, and self-attested amalgamation sketch required.'],

  // ── Construction Workers ─────────────────────────────
  ['js-49','kbocwwb_registration','Registration with KBOCWWB','KBOCWWB Reg.',catMap['Construction Workers'],
    'Registration with Karnataka Building and Other Construction Workers Welfare Board.',
    'Construction workers in Karnataka.',45,50,115,0,'🏗️','gray',0,0,1,1,
    'Aadhaar, employment certificate, ration card, Voter ID, photo required. Fee: ₹165–₹215.'],
  ['js-50','kbocwwb_education_assistance','Application for Educational Assistance (KBOCWWB)','Education Assistance',catMap['Construction Workers'],
    'Educational financial assistance for children of registered KBOCWWB members.',
    'Registered KBOCWWB beneficiaries with children studying.',45,0,115,0,'📚','blue',0,0,1,2,
    'Smart card, ration card, employment certificate, bank account, marks card required. Apply within 6 months.'],
  ['js-51','kbocwwb_funeral_assistance','Funeral & Ex-Gratia Assistance (KBOCWWB)','Funeral Assistance',catMap['Construction Workers'],
    'Funeral expenses and ex-gratia assistance for family of deceased KBOCWWB member.',
    'Family/nominee of deceased registered construction worker.',30,0,115,0,'🙏','gray',0,0,1,3,
    'ID card, bank passbook, death certificate required. Apply within one year of death.'],
  ['js-52','kbocwwb_renewal_1yr','KBOCWWB Registration Renewal (1 Year)','KBOCWWB Renew 1yr',catMap['Construction Workers'],
    'Renewal of existing KBOCWWB registration for 1 year.',
    'Registered KBOCWWB members.',0,25,115,0,'🔄','teal',0,0,0,4,
    'ID card, employment certificate, Aadhaar, ration card, pay slips required. Fee ₹140.'],
  ['js-53','kbocwwb_renewal_3yr','KBOCWWB Registration Renewal (3 Years)','KBOCWWB Renew 3yr',catMap['Construction Workers'],
    'Renewal of existing KBOCWWB registration for 3 years.',
    'Registered KBOCWWB members.',0,75,115,0,'🔄','teal',0,0,0,5,
    'ID card, employment certificate, Aadhaar, ration card, pay slips required. Fee ₹190.'],
  ['js-54','kbocwwb_medical_assistance','Medical Assistance – Karmika Arogya Bhagya','Medical Assistance',catMap['Construction Workers'],
    'Medical assistance under Karmika Arogya Bhagya scheme for hospitalised members.',
    'Registered KBOCWWB beneficiaries or dependents hospitalised.',30,0,115,0,'🏥','red',0,0,1,6,
    'Smart card, employment certificate, bank account, hospital bills and medical documents required.'],
  ['js-55','kbocwwb_marriage_assistance','Marriage Assistance (KBOCWWB)','Marriage Assistance',catMap['Construction Workers'],
    'Financial assistance for marriage of registered construction worker or dependent.',
    'KBOCWWB members registered for at least 1 year.',60,0,115,0,'💍','pink',0,0,1,7,
    'Employment certificate, bank details, marriage certificate, invitation card required. Apply within 6 months.'],
  ['js-56','kbocwwb_duplicate_id','Issue of Duplicate Identity Card (KBOCWWB)','Duplicate ID Card',catMap['Construction Workers'],
    'Replacement/duplicate identity card for registered KBOCWWB members.',
    'Registered KBOCWWB members who lost their ID card.',0,0,115,0,'💳','purple',0,0,0,8,
    'Employment certificate and self-attested Aadhaar required.'],
  ['js-57','kbocwwb_delivery_assistance','Delivery Assistance (KBOCWWB)','Delivery Assistance',catMap['Construction Workers'],
    'Financial assistance for childbirth/delivery for registered KBOCWWB members.',
    'Registered female KBOCWWB members or member spouse.',30,0,115,0,'👶','teal',0,0,1,9,
    'Affidavit for second child, bank account, employment certificate, discharge summary, birth certificate required.'],
  ['js-58','kbocwwb_pension','Pension Application (KBOCWWB)','KBOCWWB Pension',catMap['Construction Workers'],
    'Pension for registered construction workers who have attained 60 years of age.',
    'KBOCWWB members aged 60+ who were registered for at least 3 years.',0,0,115,0,'👴','green',0,0,1,10,
    'ID card, bank passbook, ration card required. Apply within 6 months of turning 60.'],
];

db.transaction(() => { SVCS.forEach(s => insertSvc.run(...s)); })();
console.log(`  ✓ ${SVCS.length} Janasevaka services`);

// ─── SEED SERVICE_FEES TABLE (for catalogue) ──────────
db.transaction(() => {
  SVCS.forEach(s => {
    const [id, type, name, , , , , , govt_fee, platform_fee, gst_percent] = s;
    insertFee.run(uuidv4(), type, name, govt_fee, platform_fee, gst_percent);
  });
})();
console.log(`  ✓ Service fees seeded`);

// ─── DOCUMENTS ───────────────────────────────────────
const D = (sid, name, key, desc, types = 'pdf,jpg,png', size = 2, req = 1, sort = 0) =>
  insertDoc.run(uuidv4(), sid, name, key, desc, types, size, req, sort);

db.transaction(() => {
  // Arogya Health Card
  D('js-01','Aadhaar Card','aadhaar','Valid Aadhaar card of applicant','pdf,jpg,png',2,1,1);
  D('js-01','Ration Card','ration_card','Optional – ration card for verification','pdf,jpg,png',2,0,2);

  // Aadhaar Enrolment
  D('js-02','ID Proof','id_proof','Any valid government photo ID','pdf,jpg,png',2,1,1);
  D('js-02','Address Proof','address_proof','Utility bill, rent agreement, or govt document','pdf,jpg,png',2,1,2);
  D('js-02','Date of Birth Proof','dob_proof','Birth certificate or school certificate','pdf,jpg,png',2,1,3);

  // Biometric Update
  D('js-03','Aadhaar Card','aadhaar','Existing Aadhaar card (any location in India)','pdf,jpg,png',2,1,1);

  // Demographic Update
  D('js-04','Aadhaar Card','aadhaar','Existing Aadhaar card','pdf,jpg,png',2,1,1);
  D('js-04','Supporting Document','support_doc','Proof for the field being updated','pdf,jpg,png',2,1,2);

  // Mandatory Biometric (5–15 yrs)
  D('js-05','Aadhaar Card (Child)','aadhaar','Child\'s existing Aadhaar card','pdf,jpg,png',2,1,1);
  D('js-05','Parent Aadhaar','parent_aadhaar','Parent/guardian Aadhaar card','pdf,jpg,png',2,1,2);

  // Income Certificate
  D('js-06','Aadhaar Card','aadhaar','Any Karnataka Aadhaar (subject to dept approval)','pdf,jpg,png',2,1,1);
  D('js-06','Bank Statement / Salary Slips','bank_statement','Bank statement or salary slips for income proof','pdf,jpg,png',3,1,2);
  D('js-06','Self Declaration','self_declaration','Signed self-declaration of income','pdf',1,1,3);
  D('js-06','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,4);
  D('js-06','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,5);

  // Caste Certificate
  D('js-07','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-07','Transfer Certificate (TC)','tc','School Transfer Certificate','pdf,jpg,png',2,1,2);
  D('js-07','Self Declaration','self_declaration','Signed self-declaration','pdf',1,1,3);
  D('js-07','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,4);
  D('js-07','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,5);

  // Caste + Income
  D('js-08','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-08','Transfer Certificate','tc','School TC','pdf,jpg,png',2,1,2);
  D('js-08','Bank Statement (6 months)','bank_statement','6-month bank statement or pay slips','pdf',3,1,3);
  D('js-08','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,4);

  // Land Holding
  D('js-09','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-09','Voter ID','voter_id','Required for land holding','pdf,jpg,png',2,1,2);
  D('js-09','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,3);

  // Bonafide Certificate
  D('js-10','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-10','Voter ID','voter_id','Required','pdf,jpg,png',2,1,2);

  // Solvency
  D('js-11','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-11','RTC Copy','rtc','Recent RTC (Record of Rights, Tenancy & Crops)','pdf,jpg,png',2,1,2);
  D('js-11','Encumbrance Certificate','ec','EC (Encumbrance Certificate) from property registration','pdf',3,1,3);
  D('js-11','Property Documents','property_docs','Sale deed or possession certificate','pdf',5,1,4);

  // Family Tree
  D('js-12','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-12','Affidavit','affidavit','Notarized affidavit of family tree','pdf',2,1,2);
  D('js-12','Death Certificate','death_cert','If deceased family member involved','pdf,jpg,png',2,1,3);
  D('js-12','Rental Agreement','rental_agreement','Optional – for urban cases','pdf',2,0,4);

  // Non-Creamy Layer
  D('js-13','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-13','Transfer Certificate (TC)','tc','School TC if studied','pdf,jpg,png',2,0,2);
  D('js-13','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,3);
  D('js-13','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,4);

  // Income for Compassionate Appointment
  D('js-14','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-14','Salary Certificate','salary_cert','Current salary certificate of family member in govt service','pdf,jpg,png',2,1,2);
  D('js-14','Bank Statement (1 year)','bank_statement','Bank statement for last one year','pdf',3,1,3);
  D('js-14','Self Declaration','self_declaration','Self-declaration','pdf',1,1,4);

  // Living Certificate
  D('js-15','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-15','Self Declaration','self_declaration','Signed self-declaration of being alive','pdf',1,1,2);

  // OBC Central
  D('js-16','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-16','School Certificate / TC','school_cert','School certificate or Transfer Certificate','pdf,jpg,png',2,1,2);
  D('js-16','Old Caste Certificate','old_caste','Existing caste certificate if available','pdf,jpg,png',2,0,3);
  D('js-16','Relatives Certificate','relatives_cert','Certificate of relatives in the same community','pdf',2,0,4);
  D('js-16','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,5);

  // Residence Certificate
  D('js-17','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-17','Rental Agreement','rental_agreement','Current rental agreement of residence','pdf',2,1,2);
  D('js-17','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,3);

  // Domicile
  D('js-18','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-18','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,2);
  D('js-18','Voter ID','voter_id','Optional','pdf,jpg,png',2,0,3);

  // Old Age Pension
  D('js-19','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-19','Ration Card','ration_card','Required','pdf,jpg,png',2,1,2);
  D('js-19','Voter ID','voter_id','Required','pdf,jpg,png',2,1,3);
  D('js-19','Age Certificate (60+)','age_cert','Birth certificate or school certificate','pdf,jpg,png',2,1,4);
  D('js-19','Passport Size Photo','photo','1 recent passport size photograph','jpg,png',1,1,5);
  D('js-19','Bank Passbook','bank_passbook','First page of bank passbook','pdf,jpg,png',2,1,6);
  D('js-19','Income Certificate','income_cert','Optional','pdf',2,0,7);

  // Widow Pension
  D('js-20','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-20','Husband Death Certificate','death_cert','Original death certificate of husband','pdf,jpg,png',2,1,2);
  D('js-20','Age Certificate (18+)','age_cert','For applicants above 18 years','pdf,jpg,png',2,1,3);
  D('js-20','Ration Card','ration_card','Required','pdf,jpg,png',2,1,4);
  D('js-20','Bank Passbook','bank_passbook','First page','pdf,jpg,png',2,1,5);
  D('js-20','Passport Size Photo','photo','1 photo','jpg,png',1,1,6);

  // PH Pension
  D('js-21','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-21','Doctor Disability Certificate','doctor_cert','Certified by registered medical practitioner','pdf,jpg,png',2,1,2);
  D('js-21','Ration Card','ration_card','Required','pdf,jpg,png',2,1,3);
  D('js-21','Voter ID','voter_id','Required','pdf,jpg,png',2,1,4);
  D('js-21','Bank Passbook','bank_passbook','First page','pdf,jpg,png',2,1,5);
  D('js-21','Passport Size Photo','photo','1 photo','jpg,png',1,1,6);

  // ASY
  D('js-22','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-22','Bank Passbook','bank_passbook','First page of bank passbook','pdf,jpg,png',2,1,2);
  D('js-22','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,3);

  // Acid Victim Pension
  D('js-23','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-23','Bank Passbook','bank_passbook','First page','pdf,jpg,png',2,1,2);
  D('js-23','Doctor Certificate','doctor_cert','Medical certificate confirming acid attack injuries','pdf,jpg,png',2,1,3);

  // No Govt Job
  D('js-24','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-24','Ration Card','ration_card','Optional','pdf,jpg,png',2,0,2);

  // Unemployment
  D('js-25','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-25','Employment Exchange Acknowledgement','emp_exchange','Registration acknowledgement from employment exchange','pdf,jpg,png',2,1,2);

  // Widow Certificate
  D('js-26','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-26','Husband Death Certificate','death_cert','Original death certificate','pdf,jpg,png',2,1,2);
  D('js-26','Self Declaration','self_declaration','Signed self-declaration','pdf',1,1,3);

  // Sandhya Suraksha
  D('js-27','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-27','Age Certificate (65+)','age_cert','Proof of age above 65 years','pdf,jpg,png',2,1,2);
  D('js-27','Ration Card','ration_card','Required','pdf,jpg,png',2,1,3);
  D('js-27','Voter ID','voter_id','Required','pdf,jpg,png',2,1,4);
  D('js-27','Bank Passbook','bank_passbook','First page','pdf,jpg,png',2,1,5);
  D('js-27','Passport Size Photo','photo','1 passport photo','jpg,png',1,1,6);

  // Senior Citizen Card
  D('js-28','Aadhaar Card','aadhaar','Karnataka Aadhaar','pdf,jpg,png',2,1,1);
  D('js-28','Blood Group Certificate','blood_group','Certificate from medical lab or hospital','pdf,jpg,png',2,1,2);
  D('js-28','Passport Size Photo','photo','1 recent photo','jpg,png',1,1,3);
  D('js-28','SSLC Marks Card','sslc','Optional – for age proof','pdf,jpg,png',2,0,4);

  // Police Verifications
  ['js-29','js-30','js-31'].forEach((sid, i) => {
    D(sid,'Aadhaar Card','aadhaar','Karnataka Aadhaar (any location)','pdf,jpg,png',2,1,1);
    D(sid,'Passport Size Photo','photo','1 recent passport size photograph','jpg,png',1,1,2);
    D(sid,'Rental Agreement','rental_agreement','Optional – if not owned property','pdf',2,0,3);
  });

  // BBMP Khatha Services (common docs)
  const bbmpSaleIds = ['js-32','js-33'];
  bbmpSaleIds.forEach(sid => {
    D(sid,'Sale Deed','sale_deed','Registered sale deed','pdf',5,1,1);
    D(sid,'Tax Paid Receipt (Current Year)','tax_receipt','BBMP property tax receipt','pdf,jpg,png',2,1,2);
    D(sid,'Encumbrance Certificate (Form-15)','ec','EC from sale deed date to current date','pdf',3,1,3);
    D(sid,'Aadhaar Card (with mobile)','aadhaar','Bengaluru Aadhaar with mobile number','pdf,jpg,png',2,1,4);
    if (sid === 'js-33') D(sid,'Affidavit (Joint Application)','affidavit','Notarized affidavit for joint Khatha','pdf',2,1,5);
  });

  const bbmpInheritanceIds = ['js-34','js-35'];
  bbmpInheritanceIds.forEach(sid => {
    D(sid,'Previous Title Deed / Possession Certificate','title_deed','Earlier ownership document','pdf',5,1,1);
    D(sid,'Tax Paid Receipt','tax_receipt','Current year BBMP tax receipt','pdf,jpg,png',2,1,2);
    D(sid,'Will (if any)','will','Registered will of deceased','pdf',3,0,3);
    D(sid,'Original Death Certificate of Khathadar','death_cert','Original death certificate','pdf,jpg,png',2,1,4);
    D(sid,'Encumbrance Certificate (Form-15)','ec','EC till current date','pdf',3,1,5);
    D(sid,'Notarized Family Tree + NOC','family_tree_noc','Notarized family tree and NOC from all family members','pdf',3,1,6);
    D(sid,'Aadhaar Card (Bengaluru)','aadhaar','Aadhaar with mobile number','pdf,jpg,png',2,1,7);
    if (sid === 'js-35') D(sid,'Affidavit (Joint)','affidavit','Affidavit for joint Khatha','pdf',2,1,8);
  });

  // KBOCWWB
  D('js-49','Aadhaar Card (Karnataka)','aadhaar','Aadhaar of any Karnataka location','pdf,jpg,png',2,1,1);
  D('js-49','Employment Certificate','employment_cert','Issued by recent employer','pdf,jpg,png',2,1,2);
  D('js-49','Ration Card','ration_card','Required','pdf,jpg,png',2,1,3);
  D('js-49','Voter ID','voter_id','Required','pdf,jpg,png',2,1,4);
  D('js-49','Passport Size Photo','photo','1 passport size photograph','jpg,png',1,1,5);

  D('js-50','Smart Card / Proof of Identity (Board)','smart_card','Smart card issued by KBOCWWB','pdf,jpg,png',2,1,1);
  D('js-50','Ration Card','ration_card','Required','pdf,jpg,png',2,1,2);
  D('js-50','Employment Certificate','employment_cert','Current employment certificate','pdf,jpg,png',2,1,3);
  D('js-50','Bank Account Proof','bank_proof','Bank passbook first page or cancelled cheque','pdf,jpg,png',2,1,4);
  D('js-50','Marks Card and Study Certificate','marks_card','For each child applying for assistance','pdf,jpg,png',2,1,5);
  D('js-50','Child Photograph','child_photo','Photograph of each child','jpg,png',1,1,6);
  D('js-50','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,7);

  D('js-51','Photo ID Card (attested)','id_card','Photocopy of KBOCWWB ID attested by gazetted officer','pdf,jpg,png',2,1,1);
  D('js-51','Bank Passbook / Nominee Passbook','bank_passbook','Beneficiary or nominee bank passbook','pdf,jpg,png',2,1,2);
  D('js-51','Death Certificate (attested)','death_cert','Attested by gazetted officer','pdf,jpg,png',2,1,3);
  D('js-51','Ration Card','ration_card','Required','pdf,jpg,png',2,1,4);
  D('js-51','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,5);
  D('js-51','Employer Certificate','employer_cert','Certificate from employer','pdf,jpg,png',2,1,6);
  D('js-51','Nominee Photo ID','nominee_id','Any photo ID proof of nominee','pdf,jpg,png',2,1,7);

  ['js-52','js-53'].forEach(sid => {
    D(sid,'KBOCWWB ID Card','id_card','Existing ID/smart card','pdf,jpg,png',2,1,1);
    D(sid,'Employment Certificate','employment_cert','Form A/B/C/D','pdf,jpg,png',2,1,2);
    D(sid,'Aadhaar Card','aadhaar','Self-attested Karnataka Aadhaar','pdf,jpg,png',2,1,3);
    D(sid,'Ration Card','ration_card','Required','pdf,jpg,png',2,1,4);
    D(sid,'Beneficiary Photo','photo','Recent photograph','jpg,png',1,1,5);
  });

  D('js-54','Smart Card','smart_card','Proof of identity / KBOCWWB smart card','pdf,jpg,png',2,1,1);
  D('js-54','Employment Certificate','employment_cert','Current employment proof','pdf,jpg,png',2,1,2);
  D('js-54','Bank Account Proof','bank_proof','Bank passbook first page','pdf,jpg,png',2,1,3);
  D('js-54','Hospital Bills','hospital_bills','Bills showing admission and discharge dates','pdf',5,1,4);
  D('js-54','Medical Documents','medical_docs','All treatment documents during hospitalization','pdf',5,1,5);
  D('js-54','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,6);

  D('js-55','Employment Certificate','employment_cert','Current employment proof','pdf,jpg,png',2,1,1);
  D('js-55','Bank Account Details','bank_details','Passbook first page or cancelled cheque','pdf,jpg,png',2,1,2);
  D('js-55','Marriage Certificate','marriage_cert','From Registrar of Marriages','pdf,jpg,png',2,1,3);
  D('js-55','Marriage Invitation Card','invitation','Marriage invitation card','pdf,jpg,png',1,0,4);
  D('js-55','Ration Card','ration_card','Required','pdf,jpg,png',2,1,5);
  D('js-55','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,6);
  D('js-55','Affidavit (if outside Karnataka)','affidavit','Required if marriage took place outside Karnataka','pdf',2,0,7);

  D('js-56','Employment Certificate','employment_cert','Form A/B/C/D','pdf,jpg,png',2,1,1);
  D('js-56','Aadhaar Card (self-attested)','aadhaar','Self-attested copy','pdf,jpg,png',2,1,2);

  D('js-57','Affidavit for Second Child','affidavit','Required if applying for second child delivery','pdf',2,0,1);
  D('js-57','Bank Account Proof','bank_proof','Passbook first page','pdf,jpg,png',2,1,2);
  D('js-57','Child Photograph','child_photo','Recent photograph of child','jpg,png',1,1,3);
  D('js-57','Employment Certificate','employment_cert','From employer','pdf,jpg,png',2,1,4);
  D('js-57','Smart Card / Proof of Identity','smart_card','KBOCWWB issued ID','pdf,jpg,png',2,1,5);
  D('js-57','Discharge Summary','discharge_summary','Hospital discharge summary','pdf',3,1,6);
  D('js-57','Birth Certificate of Child','birth_cert','Municipality-issued birth certificate','pdf,jpg,png',2,1,7);
  D('js-57','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,8);

  D('js-58','KBOCWWB ID Card (attested)','id_card','Attested photocopy of ID card','pdf,jpg,png',2,1,1);
  D('js-58','Original ID Card','original_id','To be submitted to the Board','pdf,jpg,png',2,1,2);
  D('js-58','Bank Passbook','bank_passbook','Beneficiary bank passbook first page','pdf,jpg,png',2,1,3);
  D('js-58','Ration Card','ration_card','Required','pdf,jpg,png',2,1,4);
  D('js-58','Employer Certificate','employer_cert','From recent employer','pdf,jpg,png',2,1,5);
  D('js-58','Aadhaar Card','aadhaar','Karnataka Aadhaar with mobile','pdf,jpg,png',2,1,6);
})();
console.log(`  ✓ Janasevaka service documents seeded`);

console.log('\n✅ Janasevaka seed complete! 57 services added.');
db.close();
