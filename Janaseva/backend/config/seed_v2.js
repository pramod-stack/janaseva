// config/seed_v2.js
// Seeds: categories, services, form fields, documents, system settings
// Run: node config/seed_v2.js

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const db = new Database(path.resolve(process.env.DB_PATH || './janaseva.db'));
db.pragma('foreign_keys = ON');
console.log('🌱 Seeding V2 data...\n');

// ─── HELPERS ────────────────────────────────────────
const insertCat  = db.prepare(`INSERT OR REPLACE INTO service_categories (id,name,slug,icon,color,description,sort_order) VALUES (?,?,?,?,?,?,?)`);
const insertSvc  = db.prepare(`INSERT OR REPLACE INTO services (id,service_type,name,short_name,category_id,description,eligibility,processing_days,govt_fee,platform_fee,gst_percent,icon,color,is_free,requires_kyc,show_on_home,sort_order,help_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertField= db.prepare(`INSERT OR REPLACE INTO service_form_fields (id,service_id,field_name,field_label,field_type,placeholder,options,validation,help_text,sort_order,is_required,section,grid_cols) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insertDoc  = db.prepare(`INSERT OR REPLACE INTO service_documents (id,service_id,doc_name,doc_key,description,accepted_types,max_size_mb,is_required,sort_order) VALUES (?,?,?,?,?,?,?,?,?)`);
const insertSetting = db.prepare(`INSERT OR REPLACE INTO system_settings (key,value,type,label,description,group_name,is_public) VALUES (?,?,?,?,?,?,?)`);
const insertAnn  = db.prepare(`INSERT OR IGNORE INTO announcements (id,title,message,type,target_role,is_active,is_marquee) VALUES (?,?,?,?,?,1,?)`);

// ─── CATEGORIES ─────────────────────────────────────
const CATS = [
  ['cat-01','Identity & Aadhaar','identity','🪪','red','Aadhaar, PAN, and identity-related services',1],
  ['cat-02','Travel & Transport','transport','🚗','blue','Passport, driving licence, vehicle RC',2],
  ['cat-03','Business & Tax','business','🏢','orange','GST, MSME, DSC, and business registrations',3],
  ['cat-04','Social Welfare','welfare','🤝','green','Certificates, pensions and government schemes',4],
  ['cat-05','Utility Payments','utilities','⚡','teal','Electricity, water, gas, mobile recharge',5],
  ['cat-06','Print Services','print','🖨️','purple','Print e-Aadhaar, RC, PAN, DL documents',6],
  ['cat-07','Banking & Finance','banking','🏦','pink','Savings accounts, insurance, loans',7],
];
const catMap = {};
db.transaction(() => { CATS.forEach(c => { insertCat.run(...c); catMap[c[1]] = c[0]; }); })();
console.log(`  ✓ ${CATS.length} categories`);

// ─── SERVICES ────────────────────────────────────────
// Format: [id, type, name, short_name, cat_id, description, eligibility, days, govt_fee, platform_fee, gst%, icon, color, is_free, req_kyc, show_home, sort, help_text]
const SVCS = [
  // Identity
  ['svc-pan-new','pan_new','New PAN Card Application','New PAN',catMap['Identity & Aadhaar'],'Apply for a new Permanent Account Number (PAN) card issued by NSDL/UTI.','Indian citizens and entities requiring PAN for tax purposes.',10,107,15,18,'🪙','blue',0,0,1,1,'PAN is mandatory for income tax filing, opening bank accounts, and transactions above ₹50,000.'],
  ['svc-pan-cor','pan_correction','PAN Card Correction','PAN Correction',catMap['Identity & Aadhaar'],'Correct name, DOB, address or photo on existing PAN card.','Existing PAN card holders with incorrect details.',7,107,10,18,'✏️','orange',0,0,1,2,'Carry original PAN card and supporting document for correction.'],
  ['svc-pan-miss','pan_missing','Find Missing PAN','Find PAN',catMap['Identity & Aadhaar'],'Retrieve your existing PAN number if you have forgotten it.','Any PAN card holder who has misplaced their PAN number.',1,0,30,0,'🔍','purple',0,0,0,3,'OTP will be sent to your registered mobile number.'],
  ['svc-epan','epan_print','E-PAN Print','E-PAN Print',catMap['Print Services'],'Download and print e-PAN from NSDL portal instantly.','Any PAN card holder.',0,0,9,18,'🖨️','blue',0,0,1,1,'Instant digital PAN card; legally equivalent to physical PAN.'],
  ['svc-aadh','aadhaar_update','Aadhaar Correction/Update','Aadhaar Update',catMap['Identity & Aadhaar'],'Update name, address, DOB, gender, or mobile linked to your Aadhaar.','Any Aadhaar card holder.',3,50,30,0,'🪪','red',0,0,1,4,'Biometric update not available online; visit nearest Aadhaar Seva Kendra.'],
  ['svc-pvc-aadh','pvc_aadhaar','PVC Aadhaar Card','PVC Aadhaar',catMap['Identity & Aadhaar'],'Order a durable PVC (plastic) Aadhaar card delivered to your address.','Any Aadhaar card holder.',7,50,20,0,'💳','teal',0,0,1,5,'Delivered via India Post Speed Post within 7 working days.'],
  ['svc-eaadh','eaadhaar_print','E-Aadhaar Print','E-Aadhaar',catMap['Print Services'],'Download and print your e-Aadhaar with masked Aadhaar number.','Any Aadhaar card holder.',0,0,30,0,'🖨️','red',0,0,1,2,'Password for e-Aadhaar PDF is first 4 letters of name (caps) + birth year.'],
  // Transport
  ['svc-pass-fresh','passport_fresh','Fresh Passport Application','Fresh Passport',catMap['Travel & Transport'],'Apply for a new 36-page or 60-page Indian passport.','Indian citizens without a valid passport.',30,1500,50,0,'📘','blue',0,1,1,1,'Appointment at nearest Passport Seva Kendra required after online submission.'],
  ['svc-pass-ren','passport_renewal','Passport Renewal','Renew Passport',catMap['Travel & Transport'],'Renew expired or near-expiry passport.','Indian citizens with expiring passport.',21,1500,50,0,'🔄','green',0,1,1,2,'Valid for 10 years from date of issue for adults.'],
  ['svc-pass-tat','passport_tatkal','Tatkal Passport (Urgent)','Tatkal Passport',catMap['Travel & Transport'],'Urgent passport processing within 3 working days.','Indian citizens with genuine urgency.',3,3500,50,0,'⚡','orange',0,1,1,3,'Requires additional tatkaal fee and supporting urgency documents.'],
  ['svc-dl-new','driving_licence','New Driving Licence','New DL',catMap['Travel & Transport'],'Apply for a permanent driving licence after passing driving test.','Indian citizens aged 18+ (16+ for MCWOG).',30,200,30,0,'🚗','blue',0,0,1,4,'Learner\'s licence required before applying for permanent DL.'],
  ['svc-dl-ren','dl_renewal','Driving Licence Renewal','DL Renewal',catMap['Travel & Transport'],'Renew expired or expiring driving licence.','DL holders with expired/expiring licence.',7,200,30,0,'🔄','teal',0,0,1,5,'Renew within grace period to avoid penalty.'],
  ['svc-ll','learners_licence','Learner\'s Licence','Learner\'s DL',catMap['Travel & Transport'],'Apply for learner\'s licence – first step to getting a full DL.','Indian citizens aged 16+.',1,150,30,0,'📖','purple',0,0,1,6,'Valid for 6 months; online test available on Sarathi portal.'],
  ['svc-rc','rc_print','Vehicle RC Print','RC Print',catMap['Print Services'],'Print your vehicle Registration Certificate (RC) from Parivahan portal.','Any registered vehicle owner.',0,0,40,0,'🚘','blue',0,0,1,3,'Short RC (1 page) or Long RC (4 pages) available.'],
  // Business & Tax
  ['svc-gst','gst_new','GST Registration','GST Reg.',catMap['Business & Tax'],'Register your business under Goods and Services Tax (GST).','Businesses with turnover above threshold or voluntary registration.',7,0,500,18,'📋','orange',0,1,1,1,'Mandatory for interstate business even below threshold.'],
  ['svc-gst-amend','gst_amendment','GST Amendment','GST Amendment',catMap['Business & Tax'],'Amend business name, address, or other details in GST registration.','Registered GST taxpayers.',3,0,300,18,'✏️','orange',0,1,0,2,'Core fields can only be amended by tax officer.'],
  ['svc-msme','msme_udyam','Udyam MSME Registration','MSME Reg.',catMap['Business & Tax'],'Register your enterprise under Udyam (Micro/Small/Medium) portal.','Manufacturing or service enterprises.',1,0,299,0,'🏭','green',1,0,1,3,'Government fee is zero; platform facilitation charge applies.'],
  ['svc-dsc','dsc','Digital Signature Certificate (DSC)','DSC',catMap['Business & Tax'],'Obtain Class-3 DSC for e-tendering, MCA filings, and income tax.','Businesses and professionals requiring digital signing.',3,0,1299,18,'✍️','purple',0,1,1,4,'Valid for 1–3 years; USB token delivered to your address.'],
  // Social Welfare
  ['svc-caste','caste_cert','Caste Certificate','Caste Cert',catMap['Social Welfare'],'Official caste/community certificate from Revenue Department.','SC/ST/OBC citizens as per state government classification.',15,0,30,0,'📄','green',0,0,1,1,'Required for reservations, scholarships, and govt schemes.'],
  ['svc-income','income_cert','Income Certificate','Income Cert',catMap['Social Welfare'],'Annual family income certificate from Revenue/Tehsildar office.','Any Indian citizen requiring income proof.',10,0,30,0,'💰','teal',0,0,1,2,'Required for EWS reservation, scholarships, and welfare schemes.'],
  ['svc-dom','domicile','Domicile/Residence Certificate','Domicile',catMap['Social Welfare'],'Certificate confirming state domicile/residence.','State residents with proof of continuous residence.',15,0,30,0,'🏠','blue',0,0,1,3,'Typically requires 3–15 years of residence depending on state.'],
  ['svc-birth','birth_death','Birth/Death Certificate','Birth/Death',catMap['Social Welfare'],'Official birth or death certificate from municipal authority.','Family members of newborns or deceased persons.',7,0,30,0,'📝','purple',0,0,1,4,'Register within 21 days of event to avoid late fee.'],
  ['svc-abha','abha','ABHA Card (Ayushman Bharat)','ABHA Card',catMap['Social Welfare'],'Create your digital Health ID under Ayushman Bharat Digital Mission.','All Indian citizens.',1,0,0,0,'🏥','teal',1,0,1,5,'Completely free; links all your health records digitally.'],
  ['svc-eshram','eshram','e-Shram Card','e-Shram',catMap['Social Welfare'],'Register as unorganised worker; get ₹2L accident insurance.','Unorganised sector workers aged 16–59.',1,0,0,0,'👷','orange',1,0,1,6,'Also provides access to social security schemes.'],
  ['svc-pmsym','pmsym','PM-SYM Pension Enrolment','PM-SYM',catMap['Social Welfare'],'Enrol in PM Shram Yogi Maan-Dhan for ₹3000/month pension.','Unorganised workers aged 18–40 with income below ₹15,000/month.',1,0,0,0,'👴','green',1,0,1,7,'Government matches your monthly contribution equally.'],
  // Utilities
  ['svc-recharge','recharge','Mobile Recharge','Recharge',catMap['Utility Payments'],'Instant prepaid/postpaid mobile recharge for all operators.','Any mobile subscriber.',0,0,2,0,'📱','red',0,0,1,1,'Supports Jio, Airtel, Vi, BSNL, MTNL.'],
  ['svc-elec','electricity','Electricity Bill Payment','Electricity',catMap['Utility Payments'],'Pay electricity bills for BESCOM, MSEDCL, TANGEDCO, and more.','Electricity consumers across India.',0,0,5,0,'⚡','orange',0,0,1,2,'Supports 50+ electricity boards across India.'],
  ['svc-bbps','bbps','BBPS – All Utility Bills','BBPS',catMap['Utility Payments'],'Pay water, gas, DTH, broadband, insurance via Bharat Bill Pay.','Any utility bill payer.',0,0,5,0,'📄','blue',0,0,1,3,'Instant confirmation and digital receipt.'],
  // Banking
  ['svc-savings','savings_account','Open Zero-Balance Savings Account','Savings A/c',catMap['Banking & Finance'],'Instant savings account opening with SBI, BOB, Canara, IDFC, and more.','Indian citizens with valid KYC documents.',1,0,0,0,'🏦','green',1,0,1,1,'Paperless KYC using Aadhaar and PAN.'],
  // Print
  ['svc-dl-print','dl_print','Driving Licence Print','DL Print',catMap['Print Services'],'Print driving licence from Sarathi-Parivahan portal.','Any valid DL holder.',0,0,30,0,'🚗','teal',0,0,1,4,'Soft copy of DL is also legally valid on DigiLocker.'],
  ['svc-pvc-card','pvc_card','Custom PVC ID Card Maker','PVC Card',catMap['Print Services'],'Design and print custom PVC ID cards for organisations/schools.','Any individual or organisation.',3,0,70,18,'🎨','pink',0,0,1,5,'Laminated PVC card delivered to address or print at CSC.'],
];
db.transaction(() => { SVCS.forEach(s => insertSvc.run(...s)); })();
console.log(`  ✓ ${SVCS.length} services`);

// ─── FORM FIELDS ─────────────────────────────────────
// Helper: field(service_id, name, label, type, placeholder, options, validation, help, sort, required, section, grid)
const F = (sid, name, label, type, ph='', opts='', valid='{"required":true}', help='', sort=0, req=1, section='Personal Details', grid=1) =>
  insertField.run(uuidv4(), sid, name, label, type, ph, opts||null, valid, help||null, sort, req, section, grid);

db.transaction(() => {
  // PAN New
  F('svc-pan-new','title','Title','select','',JSON.stringify(['Mr.','Mrs.','Ms.','Dr.']),'{"required":true}','',1,1,'Personal Details',1);
  F('svc-pan-new','first_name','First Name','text','As per birth certificate','','{"required":true,"minLength":2}','',2,1,'Personal Details',1);
  F('svc-pan-new','last_name','Last Name / Surname','text','As per Aadhaar','','{"required":true,"minLength":2}','',3,1,'Personal Details',1);
  F('svc-pan-new','dob','Date of Birth','date','','','{"required":true}','Must be 18+ for individual PAN',4,1,'Personal Details',1);
  F('svc-pan-new','gender','Gender','select','',JSON.stringify(['Male','Female','Transgender']),'{"required":true}','',5,1,'Personal Details',1);
  F('svc-pan-new','aadhaar','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true,"pattern":"^[0-9 ]{14}$"}','12-digit Aadhaar number with spaces',6,1,'Personal Details',1);
  F('svc-pan-new','mobile','Mobile Number','tel','+91 XXXXXXXXXX','','{"required":true,"pattern":"^[6-9][0-9]{9}$"}','Registered mobile for OTP',7,1,'Contact Details',1);
  F('svc-pan-new','email','Email Address','email','your@email.com','','{"required":true}','',8,1,'Contact Details',1);
  F('svc-pan-new','fathers_name','Father\'s Name','text','Father\'s full name','','{"required":true}','Required as per NSDL norms',9,1,'Personal Details',2);

  // PAN Correction
  F('svc-pan-cor','existing_pan','Existing PAN Number','text','ABCDE1234F','','{"required":true,"pattern":"^[A-Z]{5}[0-9]{4}[A-Z]$"}','Current PAN on your card',1,1,'PAN Details',1);
  F('svc-pan-cor','aadhaar','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','',2,1,'PAN Details',1);
  F('svc-pan-cor','correction_field','Field to Correct','select','',JSON.stringify(['Name','Date of Birth','Father\'s Name','Address','Photograph','Signature']),'{"required":true}','',3,1,'Correction Details',1);
  F('svc-pan-cor','correction_details','Describe Correction','textarea','What needs to be corrected...','','{"required":true,"minLength":10}','Be specific about the correction needed',4,1,'Correction Details',2);
  F('svc-pan-cor','mobile','Mobile','tel','+91','','{"required":true}','',5,1,'Contact Details',1);
  F('svc-pan-cor','email','Email','email','','','{"required":true}','',6,1,'Contact Details',1);

  // Aadhaar Update
  F('svc-aadh','aadhaar_number','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true,"pattern":"^[0-9 ]{14}$"}','',1,1,'Aadhaar Details',1);
  F('svc-aadh','registered_mobile','Registered Mobile','tel','+91 XXXXXXXXXX','','{"required":true}','Mobile linked to your Aadhaar',2,1,'Aadhaar Details',1);
  F('svc-aadh','update_field','Field to Update','select','',JSON.stringify(['Name','Date of Birth','Gender','Address','Mobile Number','Email ID','Language Preference']),'{"required":true}','',3,1,'Update Details',1);
  F('svc-aadh','current_value','Current Value on Aadhaar','text','','','{"required":false}','Leave blank if unknown',4,0,'Update Details',1);
  F('svc-aadh','new_value','New / Correct Value','text','','','{"required":true}','',5,1,'Update Details',1);
  F('svc-aadh','reason','Reason for Update','textarea','','','{"required":false}','Optional – helps processing',6,0,'Update Details',2);

  // Passport Fresh
  F('svc-pass-fresh','full_name','Full Name','text','As per Aadhaar','','{"required":true}','',1,1,'Personal Details',2);
  F('svc-pass-fresh','dob','Date of Birth','date','','','{"required":true}','',2,1,'Personal Details',1);
  F('svc-pass-fresh','place_of_birth','Place of Birth','text','City, State','','{"required":true}','District and state of birth',3,1,'Personal Details',1);
  F('svc-pass-fresh','aadhaar','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','',4,1,'Personal Details',1);
  F('svc-pass-fresh','mobile','Mobile','tel','+91','','{"required":true}','',5,1,'Contact Details',1);
  F('svc-pass-fresh','email','Email','email','','','{"required":true}','',6,1,'Contact Details',1);
  F('svc-pass-fresh','address','Current Address','textarea','Full address with PIN','','{"required":true}','',7,1,'Address Details',2);
  F('svc-pass-fresh','city','City','text','','','{"required":true}','',8,1,'Address Details',1);
  F('svc-pass-fresh','state','State','select','',JSON.stringify(['Karnataka','Maharashtra','Tamil Nadu','Telangana','Kerala','Delhi','Gujarat','Rajasthan','UP','MP','Bihar','West Bengal','Other']),'{"required":true}','',9,1,'Address Details',1);
  F('svc-pass-fresh','pin','PIN Code','text','6-digit PIN','','{"required":true,"pattern":"^[0-9]{6}$"}','',10,1,'Address Details',1);
  F('svc-pass-fresh','passport_type','Passport Type','select','',JSON.stringify(['36-page (Standard)','60-page (Jumbo)']),'{"required":true}','',11,1,'Passport Details',1);

  // Driving Licence
  F('svc-dl-new','full_name','Full Name','text','As per Aadhaar','','{"required":true}','',1,1,'Personal Details',2);
  F('svc-dl-new','dob','Date of Birth','date','','','{"required":true}','Must be 18+ for LMV',2,1,'Personal Details',1);
  F('svc-dl-new','aadhaar','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','',3,1,'Personal Details',1);
  F('svc-dl-new','blood_group','Blood Group','select','',JSON.stringify(['A+','A-','B+','B-','O+','O-','AB+','AB-']),'{"required":true}','Important for emergency',4,1,'Personal Details',1);
  F('svc-dl-new','vehicle_class','Vehicle Class','select','',JSON.stringify(['LMV (Light Motor Vehicle – Car)','MCWG (Motorcycle with Gear)','MCWOG (Motorcycle without Gear)','HMV (Heavy Motor Vehicle)','LMV-TR (Transport)']),'{"required":true}','',5,1,'Licence Details',1);
  F('svc-dl-new','mobile','Mobile','tel','+91','','{"required":true}','',6,1,'Contact Details',1);
  F('svc-dl-new','address','Current Address','textarea','Full address','','{"required":true}','',7,1,'Address',2);
  F('svc-dl-new','pin','PIN Code','text','','','{"required":true,"pattern":"^[0-9]{6}$"}','',8,1,'Address',1);
  F('svc-dl-new','state','State','select','',JSON.stringify(['Karnataka','Maharashtra','Tamil Nadu','Telangana','Kerala','Delhi','Other']),'{"required":true}','',9,1,'Address',1);

  // GST
  F('svc-gst','legal_name','Legal Business Name','text','As per PAN','','{"required":true}','Name exactly as on PAN card',1,1,'Business Details',2);
  F('svc-gst','trade_name','Trade Name / Brand','text','Optional brand name','','{"required":false}','',2,0,'Business Details',1);
  F('svc-gst','pan','PAN Number','text','ABCDE1234F','','{"required":true,"pattern":"^[A-Z]{5}[0-9]{4}[A-Z]$"}','Business/Proprietor PAN',3,1,'Business Details',1);
  F('svc-gst','constitution','Business Constitution','select','',JSON.stringify(['Proprietorship','Partnership Firm','LLP','Private Limited Company','Public Limited Company','Trust','HUF','Society']),'{"required":true}','',4,1,'Business Details',1);
  F('svc-gst','business_type','Business Type','select','',JSON.stringify(['Goods Only','Services Only','Both Goods & Services']),'{"required":true}','',5,1,'Business Details',1);
  F('svc-gst','annual_turnover','Annual Turnover (Estimated)','select','',JSON.stringify(['Below ₹20 Lakhs','₹20L – ₹40L','₹40L – ₹1 Crore','₹1 Cr – ₹5 Cr','Above ₹5 Crore']),'{"required":true}','',6,1,'Business Details',1);
  F('svc-gst','owner_name','Proprietor / Owner Name','text','','','{"required":true}','',7,1,'Owner Details',1);
  F('svc-gst','owner_aadhaar','Owner Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','',8,1,'Owner Details',1);
  F('svc-gst','mobile','Mobile','tel','+91','','{"required":true}','',9,1,'Owner Details',1);
  F('svc-gst','email','Email','email','','','{"required":true}','',10,1,'Owner Details',1);
  F('svc-gst','business_address','Business Address','textarea','Full address','','{"required":true}','',11,1,'Business Address',2);
  F('svc-gst','state','State','select','',JSON.stringify(['Karnataka','Maharashtra','Tamil Nadu','Telangana','Kerala','Delhi','Gujarat','Other']),'{"required":true}','',12,1,'Business Address',1);
  F('svc-gst','pin','PIN Code','text','','','{"required":true,"pattern":"^[0-9]{6}$"}','',13,1,'Business Address',1);

  // MSME
  F('svc-msme','aadhaar','Owner\'s Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','Aadhaar of proprietor/partner/director',1,1,'Owner Details',1);
  F('svc-msme','owner_name','Owner\'s Name','text','As per Aadhaar','','{"required":true}','',2,1,'Owner Details',1);
  F('svc-msme','enterprise_name','Enterprise Name','text','Business/firm name','','{"required":true}','',3,1,'Enterprise Details',2);
  F('svc-msme','org_type','Type of Organisation','select','',JSON.stringify(['Proprietorship','Partnership','HUF','LLP','Private Limited Company','Co-operative Society']),'{"required":true}','',4,1,'Enterprise Details',1);
  F('svc-msme','activity','Main Activity','select','',JSON.stringify(['Manufacturing','Services','Trading']),'{"required":true}','',5,1,'Enterprise Details',1);
  F('svc-msme','employees','Number of Employees','number','Total headcount','','{"required":true,"min":1}','',6,1,'Enterprise Details',1);
  F('svc-msme','investment','Investment in Plant & Machinery (₹)','number','Amount in Rupees','','{"required":true,"min":0}','',7,1,'Financial Details',1);
  F('svc-msme','annual_turnover','Annual Turnover (₹)','number','Last FY turnover','','{"required":false}','',8,0,'Financial Details',1);
  F('svc-msme','pan','PAN Number','text','ABCDE1234F','','{"required":true}','',9,1,'Tax Details',1);
  F('svc-msme','gstin','GSTIN (if registered)','text','27AAAAA0000A1Z5','','{"required":false}','Optional',10,0,'Tax Details',1);
  F('svc-msme','mobile','Mobile','tel','+91','','{"required":true}','',11,1,'Contact',1);
  F('svc-msme','email','Email','email','','','{"required":false}','',12,0,'Contact',1);
  F('svc-msme','address','Business Address','textarea','','','{"required":true}','',13,1,'Address',2);

  // Caste Certificate
  F('svc-caste','full_name','Full Name','text','Applicant full name','','{"required":true}','',1,1,'Personal Details',1);
  F('svc-caste','fathers_name','Father\'s Name','text','','','{"required":true}','',2,1,'Personal Details',1);
  F('svc-caste','dob','Date of Birth','date','','','{"required":true}','',3,1,'Personal Details',1);
  F('svc-caste','aadhaar','Aadhaar Number','text','XXXX XXXX XXXX','','{"required":true}','',4,1,'Personal Details',1);
  F('svc-caste','caste_community','Caste / Community','text','Enter exact caste name','','{"required":true}','',5,1,'Certificate Details',1);
  F('svc-caste','purpose','Purpose of Certificate','select','',JSON.stringify(['Education/Scholarship','Government Job','EWS Reservation','Welfare Scheme','Other']),'{"required":true}','',6,1,'Certificate Details',1);
  F('svc-caste','state','State','select','',JSON.stringify(['Karnataka','Maharashtra','Tamil Nadu','Telangana','Kerala','Delhi','Other']),'{"required":true}','',7,1,'Address',1);
  F('svc-caste','district','District','text','','','{"required":true}','',8,1,'Address',1);
  F('svc-caste','mobile','Mobile','tel','+91','','{"required":true}','',9,1,'Contact',1);

  // Recharge
  F('svc-recharge','mobile_number','Mobile Number to Recharge','tel','10-digit number','','{"required":true,"pattern":"^[6-9][0-9]{9}$"}','',1,1,'Recharge Details',2);
  F('svc-recharge','operator','Operator','select','',JSON.stringify(['Jio','Airtel','Vi (Vodafone Idea)','BSNL','MTNL']),'{"required":true}','',2,1,'Recharge Details',1);
  F('svc-recharge','circle','Telecom Circle','select','',JSON.stringify(['Karnataka','Maharashtra & Goa','Tamil Nadu','Andhra Pradesh & Telangana','Kerala','Delhi','UP East','UP West','Rajasthan','Gujarat','All India']),'{"required":true}','',3,1,'Recharge Details',1);
  F('svc-recharge','amount','Recharge Amount (₹)','number','Enter amount','','{"required":true,"min":10,"max":5000}','',4,1,'Recharge Details',1);

  // Electricity
  F('svc-elec','provider','Electricity Provider','select','',JSON.stringify(['BESCOM (Bengaluru)','HESCOM (Hubli)','MESCOM (Mangaluru)','MSEDCL (Maharashtra)','TANGEDCO (Tamil Nadu)','TSSPDCL (Telangana)','KSEB (Kerala)','BSES Rajdhani (Delhi)','DVVNL (UP)']),'{"required":true}','',1,1,'Bill Details',1);
  F('svc-elec','consumer_number','Consumer Number','text','As on electricity bill','','{"required":true}','Found on top of your electricity bill',2,1,'Bill Details',1);
  F('svc-elec','mobile','Registered Mobile','tel','+91','','{"required":true}','For receipt and confirmation',3,1,'Bill Details',1);

  // BBPS
  F('svc-bbps','bill_type','Bill / Service Type','select','',JSON.stringify(['Water Bill','Gas / PNG Bill','DTH Recharge','Broadband / WiFi','Insurance Premium','Landline Bill','Loan EMI','LPG Gas Booking','Municipal Tax','Club Membership']),'{"required":true}','',1,1,'Bill Details',1);
  F('svc-bbps','provider','Service Provider','text','Enter provider name','','{"required":true}','e.g. BWSSB, Indane, Airtel DTH',2,1,'Bill Details',1);
  F('svc-bbps','consumer_number','Account / Consumer Number','text','','','{"required":true}','',3,1,'Bill Details',1);
  F('svc-bbps','mobile','Registered Mobile','tel','+91','','{"required":true}','',4,1,'Bill Details',1);

})();
console.log(`  ✓ Form fields seeded`);

// ─── DOCUMENTS ───────────────────────────────────────
db.transaction(() => {
  const D = (sid, name, key, desc, types='pdf,jpg,png', size=2, req=1, sort=0) =>
    insertDoc.run(uuidv4(), sid, name, key, desc, types, size, req, sort);

  D('svc-pan-new','ID Proof (Aadhaar / Voter ID / Passport)','id_proof','Any government-issued photo ID','pdf,jpg,png',2,1,1);
  D('svc-pan-new','Date of Birth Proof','dob_proof','Birth certificate, school certificate, or Aadhaar','pdf,jpg,png',2,1,2);
  D('svc-pan-new','Address Proof','address_proof','Aadhaar, Voter ID, Utility Bill (last 3 months)','pdf,jpg,png',2,1,3);
  D('svc-pan-new','Passport Size Photograph','photo','Recent white-background photograph','jpg,png',1,1,4);

  D('svc-pan-cor','Existing PAN Card (copy)','pan_copy','Both sides of current PAN card','pdf,jpg,png',2,1,1);
  D('svc-pan-cor','Supporting Proof (for field being corrected)','support_doc','Document supporting the correction','pdf,jpg,png',2,1,2);

  D('svc-aadh','Proof of Updated Field','update_proof','Document showing correct/new information','pdf,jpg,png',2,1,1);

  D('svc-pass-fresh','Aadhaar Card','aadhaar','Both sides of Aadhaar card','pdf,jpg,png',2,1,1);
  D('svc-pass-fresh','Date of Birth Proof','dob_proof','Birth certificate or Aadhaar','pdf,jpg,png',2,1,2);
  D('svc-pass-fresh','Address Proof','address_proof','Aadhaar / Utility bill / Bank passbook','pdf,jpg,png',2,1,3);
  D('svc-pass-fresh','Passport Size Photograph','photo','White background, recent photo','jpg,png',1,1,4);
  D('svc-pass-fresh','Existing Passport (if any)','old_passport','Only if renewing – all pages','pdf,jpg,png',5,0,5);

  D('svc-dl-new','Aadhaar Card (Age + Address Proof)','aadhaar','Both sides','pdf,jpg,png',2,1,1);
  D('svc-dl-new','Passport Size Photograph','photo','White background','jpg,png',1,1,2);
  D('svc-dl-new','Medical Certificate (Form 1A)','medical_cert','From registered medical practitioner','pdf',2,1,3);
  D('svc-dl-new','Learner\'s Licence (if available)','learners_ll','Copy of issued LL','pdf,jpg',2,0,4);

  D('svc-gst','PAN Card','pan_card','Business or proprietor PAN','pdf,jpg,png',2,1,1);
  D('svc-gst','Aadhaar Card','aadhaar','Proprietor/Director Aadhaar','pdf,jpg,png',2,1,2);
  D('svc-gst','Business Address Proof','address_proof','Electricity bill / rent agreement / NOC','pdf,jpg,png',3,1,3);
  D('svc-gst','Cancelled Cheque / Bank Statement','bank_proof','Last 3 months or cancelled cheque','pdf',3,1,4);
  D('svc-gst','Partnership Deed / MOA','constitution_doc','For firms/companies – incorporation document','pdf',5,0,5);

  D('svc-caste','Aadhaar Card','aadhaar','Both sides','pdf,jpg,png',2,1,1);
  D('svc-caste','Ration Card / Family Document','ration_card','For family caste proof','pdf,jpg,png',2,0,2);
  D('svc-caste','Previous Caste Certificate (if any)','old_cert','If renewal or copy required','pdf,jpg',2,0,3);

  D('svc-pvc-card','Passport Size Photograph','photo','White background, clear face','jpg,png',1,1,1);
  D('svc-pvc-card','Organisation Logo','logo','PNG with transparent background preferred','png,jpg',1,0,2);

  D('svc-savings','Aadhaar Card','aadhaar','Both sides – colour copy','pdf,jpg,png',2,1,1);
  D('svc-savings','PAN Card','pan','Clear copy','pdf,jpg,png',2,1,2);
  D('svc-savings','Passport Size Photograph','photo','White background','jpg,png',1,1,3);

})();
console.log(`  ✓ Service documents seeded`);

// ─── SYSTEM SETTINGS ─────────────────────────────────
const SETTINGS = [
  // General
  ['portal_name','JanaSeva','string','Portal Name','Display name of the portal','general',1],
  ['portal_tagline','E-Governance Portal – 30+ Services at Your Doorstep','string','Portal Tagline','Shown on login screen','general',1],
  ['support_phone','7760449027','string','Support Phone','Customer care number','general',1],
  ['support_whatsapp','7800353483','string','Support WhatsApp','WhatsApp support number','general',1],
  ['support_email','support@janaseva.in','string','Support Email','','general',1],
  ['support_hours','10AM – 6PM (Mon–Sat)','string','Support Hours','Working hours text','general',1],
  ['working_days','Mon,Tue,Wed,Thu,Fri,Sat','string','Working Days','Comma-separated','general',1],
  // Features
  ['enable_wallet_payment','true','boolean','Enable Wallet Payment','Allow users to pay via wallet balance','features',1],
  ['enable_razorpay','false','boolean','Enable Razorpay','Enable online card/UPI payments','features',0],
  ['enable_kyc_mandatory','false','boolean','KYC Mandatory','Block service access without KYC','features',1],
  ['enable_otp_login','true','boolean','OTP Login','Allow mobile OTP based login','features',1],
  ['max_upload_size_mb','5','number','Max Upload Size (MB)','Maximum file size per document upload','uploads',0],
  ['allowed_file_types','pdf,jpg,jpeg,png','string','Allowed File Types','Comma-separated extensions','uploads',0],
  // Fees
  ['default_gst_percent','18','number','Default GST %','Applied to platform fee if not overridden','fees',0],
  ['wallet_min_balance','0','number','Minimum Wallet Balance (₹)','Min balance required for transactions','fees',0],
  ['wallet_max_topup','50000','number','Max Wallet Top-up (₹)','Single transaction limit','fees',0],
  // Notifications
  ['sms_enabled','false','boolean','SMS Notifications','Send SMS alerts to users','notifications',0],
  ['email_enabled','false','boolean','Email Notifications','Send email alerts to users','notifications',0],
  ['notify_on_submit','true','boolean','Notify on Submit','Notify user when application is submitted','notifications',0],
  ['notify_on_status_change','true','boolean','Notify on Status Change','Notify user on every status update','notifications',0],
  // Maintenance
  ['maintenance_mode','false','boolean','Maintenance Mode','Show maintenance message to all users','maintenance',1],
  ['maintenance_message','We are performing scheduled maintenance. We\'ll be back shortly!','string','Maintenance Message','Shown during maintenance','maintenance',1],
];
db.transaction(() => { SETTINGS.forEach(s => insertSetting.run(...s)); })();
console.log(`  ✓ ${SETTINGS.length} system settings`);

// ─── ANNOUNCEMENTS ───────────────────────────────────
db.transaction(() => {
  insertAnn.run(uuidv4(),'Aadhaar New PVC Card Available','Order your PVC Aadhaar card now – delivered to your doorstep in 7 days.','info','all',1);
  insertAnn.run(uuidv4(),'MSME Registration Now Live','Register your enterprise under Udyam for free. Platform fee: ₹299 only.','success','all',1);
  insertAnn.run(uuidv4(),'GST Registration – Apply Now','Professional GST registration with expert assistance at ₹590.','info','all',1);
  insertAnn.run(uuidv4(),'Become a Distributor','Earn 10% commission on every recharge done by your agents.','success','retailer',0);
})();
console.log(`  ✓ Announcements seeded`);

console.log('\n✅ V2 seed complete!');
db.close();
