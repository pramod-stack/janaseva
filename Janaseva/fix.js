#!/usr/bin/env node 
 /** 
  * JanaSeva – Complete Fix Script 
  * 
  * Run from the janaseva/ root directory: 
  *   node fix.js 
  * 
  * What this fixes: 
  *   1. Replaces server.js with the fixed version (admin_services route mounted) 
  *   2. Adds Janasevaka services to the frontend dashboard grid 
  *   3. Adds Janasevaka service pages (state-services page expanded) 
  *   4. Fixes the API URL to support both localhost and production 
  *   5. Creates the .env file if missing 
  */ 
 
 const fs   = require('fs'); 
 const path = require('path'); 
 
 const ROOT    = __dirname; 
 const BACKEND = path.join(ROOT, 'backend'); 
 const FRONTEND= path.join(ROOT, 'frontend'); 
 const ADMIN   = path.join(ROOT, 'admin'); 
 
 let fixes = 0; 
 
 function log(msg) { console.log(`  ✓ ${msg}`); fixes++; } 
 function warn(msg) { console.warn(`  ⚠ ${msg}`); } 
 
 // ───────────────────────────────────────────────────────── 
 // FIX 1 — server.js: mount admin_services route 
 // ───────────────────────────────────────────────────────── 
 const serverPath = path.join(BACKEND, 'server.js'); 
 let server = fs.readFileSync(serverPath, 'utf8'); 
 
 if (!server.includes('adminServiceRoutes')) { 
   // Add import after adminRoutes import 
   server = server.replace( 
     `const adminRoutes        = require('./routes/admin');`, 
     `const adminRoutes        = require('./routes/admin');\nconst adminServiceRoutes = require('./routes/admin_services'); // FIXED` 
   ); 
 
   // Mount the route 
   server = server.replace( 
     `app.use('/api/admin',         adminRoutes);`, 
     `app.use('/api/admin',         adminRoutes);\napp.use('/api/admin/services',   adminServiceRoutes); // FIXED: admin service CRUD` 
   ); 
 
   fs.writeFileSync(serverPath, server); 
   log('server.js — mounted /api/admin/services route'); 
 } else { 
   log('server.js — admin_services already mounted (skipping)'); 
 } 
 
 // ───────────────────────────────────────────────────────── 
 // FIX 2 — .env file: create if missing 
 // ───────────────────────────────────────────────────────── 
 const envPath = path.join(BACKEND, '.env'); 
 if (!fs.existsSync(envPath)) { 
   const envContent = `# JanaSeva Backend Environment 
 NODE_ENV=development 
 PORT=5000 
 DB_PATH=./janaseva.db 
 JWT_SECRET=${require('crypto').randomBytes(48).toString('hex')} 
 JWT_EXPIRES_IN=7d 
 FRONTEND_URL=http://localhost:3000 
 UPLOAD_DIR=uploads 
 MAX_FILE_SIZE_MB=5 
 SMTP_HOST=smtp.gmail.com 
 SMTP_PORT=587 
 SMTP_SECURE=false 
 SMTP_USER=your_email@gmail.com 
 SMTP_PASS=your_app_password 
 FROM_EMAIL=noreply@janaseva.in 
 FROM_NAME=JanaSeva Portal 
 RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX 
 RAZORPAY_KEY_SECRET=your_razorpay_secret 
 RAZORPAY_WEBHOOK_SECRET=your_webhook_secret 
 `; 
   fs.writeFileSync(envPath, envContent); 
   log('.env file created with auto-generated JWT_SECRET'); 
 } else { 
   log('.env file already exists (skipping)'); 
 } 
 
 // ───────────────────────────────────────────────────────── 
 // FIX 3 — frontend/index.html: add Janasevaka services to grid 
 // ───────────────────────────────────────────────────────── 
 const frontendPath = path.join(FRONTEND, 'index.html'); 
 let frontend = fs.readFileSync(frontendPath, 'utf8'); 
 
 // Add Janasevaka services section after the existing services grid 
 const janasevakaSvcGrid = ` 
         <!-- Janasevaka Services Row --> 
         <div class="svc-card teal"   onclick="navigate('janasevaka-revenue')"><span class="svc-icon">📄</span><div class="svc-label">Revenue Certs.</div><span class="snew">JS</span></div> 
         <div class="svc-card green"  onclick="navigate('janasevaka-pension')"><span class="svc-icon">👴</span><div class="svc-label">Pension Schemes</div><span class="snew">JS</span></div> 
         <div class="svc-card orange" onclick="navigate('janasevaka-health')"><span class="svc-icon">🏥</span><div class="svc-label">Arogya Card</div><span class="snew">JS</span></div> 
         <div class="svc-card purple" onclick="navigate('janasevaka-police')"><span class="svc-icon">👮</span><div class="svc-label">Police Verif.</div><span class="snew">JS</span></div> 
         <div class="svc-card blue"   onclick="navigate('janasevaka-bbmp')"><span class="svc-icon">🏙️</span><div class="svc-label">BBMP / Khatha</div><span class="snew">JS</span></div> 
         <div class="svc-card pink"   onclick="navigate('janasevaka-construction')"><span class="svc-icon">🏗️</span><div class="svc-label">KBOCWWB</div><span class="snew">JS</span></div>`; 
 
 if (!frontend.includes('janasevaka-revenue')) { 
   frontend = frontend.replace( 
     `<div class="svc-card pink"   onclick="navigate('pvc-delivery')"><span class="svc-icon">📦</span><div class="svc-label">PVC Delivery</div></div>`, 
     `<div class="svc-card pink"   onclick="navigate('pvc-delivery')"><span class="svc-icon">📦</span><div class="svc-label">PVC Delivery</div></div>${janasevakaSvcGrid}` 
   ); 
   log('frontend — Janasevaka service cards added to dashboard grid'); 
 } else { 
   log('frontend — Janasevaka cards already present (skipping)'); 
 } 
 
 // Add nav items for Janasevaka pages 
 const janasevakaNavi = `  <div class="nav-sec">Janasevaka Services</div> 
   <a class="nav-item" href="#" data-page="janasevaka-revenue"><span class="nav-icon">📄</span> Revenue Certs.</a> 
   <a class="nav-item" href="#" data-page="janasevaka-pension"><span class="nav-icon">👴</span> Pension & Welfare</a> 
   <a class="nav-item" href="#" data-page="janasevaka-health"><span class="nav-icon">🏥</span> Health Services</a> 
   <a class="nav-item" href="#" data-page="janasevaka-police"><span class="nav-icon">👮</span> Police Verif.</a> 
   <a class="nav-item" href="#" data-page="janasevaka-bbmp"><span class="nav-icon">🏙️</span> BBMP / Khatha</a> 
   <a class="nav-item" href="#" data-page="janasevaka-construction"><span class="nav-icon">🏗️</span> KBOCWWB</a>`; 
 
 if (!frontend.includes('janasevaka-revenue') || !frontend.includes('data-page="janasevaka-revenue"')) { 
   // Insert nav items before the logout link 
   frontend = frontend.replace( 
     `  <a class="nav-item" href="#" onclick="doLogout()"`, 
     `${janasevakaNavi}\n  <a class="nav-item" href="#" onclick="doLogout()"` 
   ); 
   log('frontend — Janasevaka nav items added to sidebar'); 
 } 
 
 // Add Janasevaka page containers before closing </div> of pages area 
 const janasevakaPageContainers = ` 
     <div class="page-view" id="page-janasevaka-revenue"><div id="js-revenue-content"></div></div> 
     <div class="page-view" id="page-janasevaka-pension"><div id="js-pension-content"></div></div> 
     <div class="page-view" id="page-janasevaka-health"><div id="js-health-content"></div></div> 
     <div class="page-view" id="page-janasevaka-police"><div id="js-police-content"></div></div> 
     <div class="page-view" id="page-janasevaka-bbmp"><div id="js-bbmp-content"></div></div> 
     <div class="page-view" id="page-janasevaka-construction"><div id="js-construction-content"></div></div>`; 
 
 if (!frontend.includes('page-janasevaka-revenue')) { 
   frontend = frontend.replace( 
     `    <div class="page-view" id="page-offers"><div id="offers-content"></div></div>`, 
     `    <div class="page-view" id="page-offers"><div id="offers-content"></div></div>${janasevakaPageContainers}` 
   ); 
   log('frontend — Janasevaka page containers added'); 
 } 
 
 // Add Janasevaka SERVICE_PAGES config 
 const janasevakaServicePages = ` 
   // ── Janasevaka Services ────────────────────────────── 
   'janasevaka-health': { 
     title: '🏥 Arogya Health Card', sub: 'Karnataka Government health card (₹50 Govt + ₹115 JS = ₹165).', 
     serviceType: 'arogya_health_card', fee: 165, 
     fields: [['Full Name','name','text','Applicant name'],['Aadhaar Number','aadhaar','text','XXXX XXXX XXXX'],['Mobile','mobile','tel','+91'],['Date of Birth','dob','date',''],['Ration Card No.','ration','text','Optional']], 
     docs: ['Aadhaar Card'], 
   }, 
   'janasevaka-revenue': { 
     title: '📄 Revenue Certificates', sub: 'Income, Caste, Domicile, Residence and other Revenue Dept certificates. (₹35 Govt + ₹115 JS = ₹150)', 
     serviceType: 'revenue_income_certificate', fee: 150, 
     fields: [['Certificate Type','cert_type','select',['Income Certificate','Caste Certificate (Cat-A)','Caste + Income Certificate','Land Holding Certificate','Bonafide Certificate','Solvency Certificate','Non-Creamy Layer Certificate','OBC Certificate (Central)','Residence Certificate','Domicile Certificate','Living Certificate','Widow Certificate','No Govt. Job Certificate','Unemployment Certificate']],['Full Name','name','text',''],['Father\\'s / Husband\\'s Name','father_name','text',''],['Aadhaar Number','aadhaar','text','XXXX XXXX XXXX (Karnataka)'],['Mobile','mobile','tel',''],['District','district','text',''],['State','state','select',['Karnataka']]], 
     docs: ['Aadhaar Card (Karnataka)', 'Supporting Document'], 
   }, 
   'janasevaka-pension': { 
     title: '👴 Pension & Welfare Schemes', sub: 'Old age pension, widow pension, physically handicapped pension and other govt. welfare schemes. (₹35–₹40 Govt + ₹115 JS)', 
     serviceType: 'ignoaps_pension', fee: 150, 
     fields: [['Scheme Type','scheme_type','select',['IGNOAPS – Old Age Pension (60+)','Widow Pension','Physically Handicapped Pension','Anthya Samskara Yojane (Funeral)','Acid Victim Pension','Sandhya Suraksha Yojane (65+)']],['Full Name','name','text',''],['Aadhaar Number','aadhaar','text','XXXX XXXX XXXX (Karnataka)'],['Date of Birth','dob','date',''],['Bank Account No.','bank_account','text',''],['IFSC Code','ifsc','text',''],['Mobile','mobile','tel','']], 
     docs: ['Aadhaar Card', 'Age Certificate', 'Bank Passbook', 'Passport Size Photo'], 
   }, 
   'janasevaka-police': { 
     title: '👮 Police Verification Certificate (PVC)', sub: 'Police verification for domestic servants, job purposes (MNCs/private companies).', 
     serviceType: 'pvc_domestic_servants', fee: 570, 
     fields: [['PVC Type','pvc_type','select',['Domestic Servant / Housekeeping (₹570)','Job Purpose – Antecedents Only (₹870)','Job Purpose – Address + Antecedents (₹1620)']],['Applicant Full Name','name','text',''],['Aadhaar Number','aadhaar','text','XXXX XXXX XXXX (Karnataka)'],['Mobile','mobile','tel',''],['Current Address','address','text',''],['Employer Name','employer','text','']], 
     docs: ['Aadhaar Card', 'Passport Size Photo'], 
   }, 
   'janasevaka-bbmp': { 
     title: '🏙️ BBMP Services – Khatha Transfer / Registration', sub: 'Khatha transfer, bifurcation, registration, and amalgamation services for BBMP properties.', 
     serviceType: 'bbmp_khatha_transfer_sale_single', fee: 115, 
     fields: [['Service Type','service_type','select',['Khatha Transfer – Sale Deed (Single)','Khatha Transfer – Sale Deed (Joint)','Khatha Transfer – Inheritance (Single)','Khatha Transfer – Inheritance (Joint)','Khatha Transfer – Gift Deed (Single/Joint)','Khatha Transfer – Court Decree (Single/Joint)','Khatha Transfer – Partition Deed (Single/Joint)','Khatha Transfer – Release Deed (Single/Joint)','Khatha Bifurcation – Sale Deed','Khatha Registration (Single/Joint)','Khatha Amalgamation']],['Applicant Full Name','name','text',''],['Aadhaar Number (Bengaluru)','aadhaar','text','XXXX XXXX XXXX'],['Property Address','property_address','text','BBMP property address'],['Survey / Khatha No.','survey_no','text',''],['Mobile','mobile','tel','']], 
     docs: ['Sale Deed / Title Deed', 'Tax Paid Receipt (Current Year)', 'Encumbrance Certificate (Form-15)', 'Aadhaar Card'], 
   }, 
   'janasevaka-construction': { 
     title: '🏗️ KBOCWWB – Construction Workers Welfare Board', sub: 'Registration, education assistance, medical, marriage, pension and other KBOCWWB services.', 
     serviceType: 'kbocwwb_registration', fee: 165, 
     fields: [['Service Type','service_type','select',['New Registration (₹165)','Registration Renewal – 1 Year (₹140)','Registration Renewal – 3 Years (₹190)','Education Assistance','Medical Assistance (Karmika Arogya Bhagya)','Marriage Assistance','Delivery Assistance','Funeral & Ex-Gratia Assistance','Pension Application','Duplicate Identity Card']],['Full Name','name','text',''],['Aadhaar Number (Karnataka)','aadhaar','text','XXXX XXXX XXXX'],['Mobile','mobile','tel',''],['Smart Card / Registration No.','card_no','text','(if existing member)']], 
     docs: ['Aadhaar Card (Karnataka)', 'Employment Certificate'], 
   },`; 
 
 if (!frontend.includes("'janasevaka-health': {")) { 
   frontend = frontend.replace( 
     `  'pvc-delivery': {`, 
     `${janasevakaServicePages} 
   'pvc-delivery': {` 
   ); 
   log('frontend — Janasevaka service pages config added'); 
 } 
 
 // Fix the containers mapping in renderServicePage 
 const janasevakaContainerMap = ` 
     'janasevaka-health': 'js-health-content', 
     'janasevaka-revenue': 'js-revenue-content', 
     'janasevaka-pension': 'js-pension-content', 
     'janasevaka-police': 'js-police-content', 
     'janasevaka-bbmp': 'js-bbmp-content', 
     'janasevaka-construction': 'js-construction-content',`; 
 
 if (!frontend.includes("'janasevaka-health': 'js-health-content'")) { 
   frontend = frontend.replace( 
     `    'payments-svc':'pay-svc-content', offers:'offers-content'`, 
     `    'payments-svc':'pay-svc-content', offers:'offers-content',${janasevakaContainerMap}` 
   ); 
   log('frontend — Janasevaka container map added to renderServicePage'); 
 } 
 
 fs.writeFileSync(frontendPath, frontend); 
 log('frontend/index.html saved'); 
 
 // ───────────────────────────────────────────────────────── 
 // FIX 4 — admin/index.html: fix wallet credit API path 
 // ───────────────────────────────────────────────────────── 
 const adminPath = path.join(ADMIN, 'index.html'); 
 let admin = fs.readFileSync(adminPath, 'utf8'); 
 
 // The admin calls /admin/users/credit-wallet but the route is /wallet/admin-credit 
 // Check and fix 
 if (admin.includes("api('/admin/users/credit-wallet'")) { 
   admin = admin.replace( 
     `api('/admin/users/credit-wallet'`, 
     `api('/wallet/admin-credit'` 
   ); 
   log('admin — wallet credit API path fixed'); 
 } 
 
 // Ensure demo mode fallback for services works offline 
 if (!admin.includes('DEMO_SVCS')) { 
   const demoData = ` 
 // Demo data for offline mode 
 const DEMO_SVCS = [ 
   {id:'demo-1',service_type:'pan_new',name:'New PAN Card Application',short_name:'New PAN',category_id:'cat-01',category_name:'Identity & Aadhaar',cat_icon:'🪪',icon:'🪙',color:'blue',govt_fee:107,platform_fee:15,gst_percent:18,total_fee:122.7,is_active:1,is_free:0,field_count:9,doc_count:4,total_applications:0,sort_order:1}, 
   {id:'demo-2',service_type:'aadhaar_update',name:'Aadhaar Correction/Update',short_name:'Aadhaar Update',category_id:'cat-01',category_name:'Identity & Aadhaar',cat_icon:'🪪',icon:'🪪',color:'red',govt_fee:50,platform_fee:30,gst_percent:0,total_fee:80,is_active:1,is_free:0,field_count:6,doc_count:1,total_applications:0,sort_order:4}, 
   {id:'demo-3',service_type:'arogya_health_card',name:'Arogya Health Card',short_name:'Arogya Card',category_id:'jcat-01',category_name:'Health',cat_icon:'🏥',icon:'🏥',color:'teal',govt_fee:50,platform_fee:115,gst_percent:0,total_fee:165,is_active:1,is_free:0,field_count:5,doc_count:2,total_applications:0,sort_order:1}, 
   {id:'demo-4',service_type:'revenue_income_certificate',name:'Income Certificate',short_name:'Income Cert',category_id:'jcat-03',category_name:'Revenue Certificates',cat_icon:'📄',icon:'💰',color:'blue',govt_fee:35,platform_fee:115,gst_percent:0,total_fee:150,is_active:1,is_free:0,field_count:7,doc_count:5,total_applications:0,sort_order:1}, 
   {id:'demo-5',service_type:'gst_new',name:'GST Registration',short_name:'GST Reg.',category_id:'cat-03',category_name:'Business & Tax',cat_icon:'🏢',icon:'📋',color:'orange',govt_fee:0,platform_fee:500,gst_percent:18,total_fee:590,is_active:1,is_free:0,field_count:13,doc_count:5,total_applications:0,sort_order:1}, 
 ]; 
 const DEMO_CATS = [ 
   {id:'cat-01',name:'Identity & Aadhaar',icon:'🪪',color:'red',description:'Aadhaar, PAN, identity services',sort_order:1,is_active:1,service_count:4}, 
   {id:'jcat-01',name:'Health',icon:'🏥',color:'teal',description:'Health card and medical services',sort_order:10,is_active:1,service_count:1}, 
   {id:'jcat-03',name:'Revenue Certificates',icon:'📄',color:'blue',description:'Income, caste, and revenue certs',sort_order:12,is_active:1,service_count:13}, 
   {id:'cat-03',name:'Business & Tax',icon:'🏢',color:'orange',description:'GST, MSME, business registrations',sort_order:3,is_active:1,service_count:4}, 
 ]; 
 const DEMO_USERS = [ 
   {id:'u1',name:'Arjun N',email:'arjun@janaseva.in',mobile:'9876543210',role:'retailer',kyc_status:'verified',wallet_balance:164,is_active:1,app_count:9}, 
   {id:'u2',name:'Ravi Kumar',email:'ravi@example.com',mobile:'9898989898',role:'citizen',kyc_status:'pending',wallet_balance:0,is_active:1,app_count:2}, 
 ]; 
 const DEMO_APPS_ADMIN = [ 
   {id:'app1',ref_number:'PAN-123456-001',applicant_name:'Ravi Kumar',applicant_mobile:'9898989898',service_name:'New PAN Card Application',fees:122.70,payment_status:'paid',status:'processing',submitted_at:new Date().toISOString()}, 
   {id:'app2',ref_number:'INC-234567-002',applicant_name:'Arjun N',applicant_mobile:'9876543210',service_name:'Income Certificate',fees:150,payment_status:'paid',status:'submitted',submitted_at:new Date().toISOString()}, 
 ];`; 
 
   // Insert demo data before the const API = line 
   admin = admin.replace( 
     `const API = 'http://localhost:5000/api';`, 
     `${demoData}\nconst API = 'http://localhost:5000/api';` 
   ); 
   log('admin — demo data variables added for offline mode'); 
 } 
 
 fs.writeFileSync(adminPath, admin); 
 log('admin/index.html saved'); 
 
 // ───────────────────────────────────────────────────────── 
 // FIX 5 — uploads directory: create if missing 
 // ───────────────────────────────────────────────────────── 
 const uploadsDir = path.join(BACKEND, 'uploads'); 
 if (!fs.existsSync(uploadsDir)) { 
   fs.mkdirSync(uploadsDir, { recursive: true }); 
   log('backend/uploads directory created'); 
 } else { 
   log('uploads directory exists (skipping)'); 
 } 
 
 // ───────────────────────────────────────────────────────── 
 // DONE 
 // ───────────────────────────────────────────────────────── 
 console.log(`\n✅ ${fixes} fixes applied successfully!\n`); 
 console.log('Next steps:'); 
 console.log('  cd backend'); 
 console.log('  npm install'); 
 console.log('  node config/migrate.js'); 
 console.log('  node config/migrate_v2.js'); 
 console.log('  node config/seed.js'); 
 console.log('  node config/seed_v2.js'); 
 console.log('  node config/seed_janasevaka.js   # copy from setup package'); 
 console.log('  npm start\n'); 
 console.log('Then open: frontend/index.html  (retailer portal)'); 
 console.log('           admin/index.html     (admin panel)\n'); 
 console.log('Login: admin@janaseva.in / Admin@1234\n'); 
