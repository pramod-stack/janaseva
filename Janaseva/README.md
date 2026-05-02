# JanaSeva E-Governance Portal
### Full-Stack Deployment Guide

---

## Project Structure
```
janaseva/
├── frontend/
│   └── index.html          ← Complete SPA frontend
└── backend/
    ├── server.js            ← Express entry point (PORT 5000)
    ├── package.json         ← All dependencies
    ├── .env.example         ← Copy to .env and fill values
    ├── config/
    │   ├── db.js            ← SQLite connection
    │   ├── migrate.js       ← Creates all DB tables
    │   └── seed.js          ← Inserts service fees + demo users
    ├── middleware/
    │   ├── auth.js          ← JWT verify + role guards
    │   ├── errorHandler.js  ← Central error + 404
    │   └── upload.js        ← Multer file upload
    ├── routes/
    │   ├── auth.js          ← Register, Login, OTP, Profile
    │   ├── applications.js  ← Submit, Track, Status update
    │   ├── payments.js      ← Razorpay + Wallet payment
    │   ├── wallet.js        ← Balance, transactions, deduct
    │   ├── notifications.js ← In-app notifications
    │   ├── services.js      ← Catalogue, fees, recharge, bills
    │   ├── admin.js         ← Dashboard stats, user mgmt
    │   └── retailers.js     ← Retailer / agent management
    ├── services/
    │   └── notificationService.js ← Email (Nodemailer) + SMS
    └── utils/
        └── helpers.js       ← Ref numbers, fee calc, OTP, audit
```

---

## Quick Deploy (5 Commands)

```bash
# 1. Install dependencies
cd janaseva/backend && npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set JWT_SECRET, SMTP, Razorpay keys

# 3. Create database tables
node config/migrate.js

# 4. Seed service fees + demo users
node config/seed.js

# 5. Start server
npm start
# Dev mode with hot-reload:
npm run dev
```

Open `frontend/index.html` in browser OR serve it:
```bash
# Serve frontend (install once: npm i -g serve)
serve janaseva/frontend -p 3000
```

---

## Demo Credentials

| Role      | Email                  | Password        |
|-----------|------------------------|-----------------|
| Retailer  | arjun@janaseva.in       | Retailer@123    |
| Admin     | admin@janaseva.in       | Admin@1234      |
| Citizen   | ravi@example.com       | Citizen@123     |

---

## API Endpoints

### Auth  `/api/auth`
| Method | Path            | Description              |
|--------|-----------------|--------------------------|
| POST   | /register       | Create account           |
| POST   | /login          | Email/mobile + password  |
| POST   | /send-otp       | Send OTP to mobile       |
| POST   | /verify-otp     | Verify OTP + login       |
| POST   | /refresh        | Refresh access token     |
| POST   | /logout         | Invalidate tokens        |
| GET    | /me             | Get current user profile |
| PUT    | /profile        | Update profile           |

### Applications  `/api/applications`
| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| POST   | /submit           | Submit any service application     |
| GET    | /track/:refNumber | Public track by reference number   |
| GET    | /my               | My applications (paginated)        |
| GET    | /:id              | Single application details         |
| PUT    | /:id/status       | Officer updates status [Officer+]  |
| GET    | /                 | All applications [Admin/Officer]   |

### Payments  `/api/payments`
| Method | Path              | Description                    |
|--------|-------------------|--------------------------------|
| POST   | /create-order     | Create Razorpay order          |
| POST   | /verify           | Verify payment signature       |
| POST   | /webhook          | Razorpay webhook handler       |
| POST   | /wallet-topup     | Create wallet top-up order     |
| POST   | /wallet-topup/verify | Confirm wallet credit       |
| GET    | /history          | Payment history                |

### Wallet  `/api/wallet`
| Method | Path         | Description                  |
|--------|--------------|------------------------------|
| GET    | /balance     | Get wallet balances          |
| GET    | /transactions| Transaction history          |
| POST   | /deduct      | Pay for service from wallet  |
| POST   | /credit      | Admin: credit wallet         |

### Services  `/api/services`
| Method | Path             | Description                      |
|--------|------------------|----------------------------------|
| GET    | /catalogue       | All services with fees           |
| GET    | /fees/:type      | Fee for specific service type    |
| POST   | /recharge        | Mobile recharge                  |
| POST   | /fetch-bill      | Fetch utility bill details       |
| POST   | /pay-bill        | Pay utility bill                 |
| GET    | /operators       | Operator/provider catalogue      |

### Notifications  `/api/notifications`
| Method | Path         | Description               |
|--------|--------------|---------------------------|
| GET    | /            | User notifications        |
| PUT    | /:id/read    | Mark one as read          |
| PUT    | /read-all    | Mark all as read          |
| DELETE | /:id         | Delete notification       |
| POST   | /broadcast   | Admin: broadcast to users |

### Admin  `/api/admin`
| Method | Path                    | Description             |
|--------|-------------------------|-------------------------|
| GET    | /dashboard              | Stats & KPIs            |
| GET    | /users                  | List all users          |
| PUT    | /users/:id/kyc          | Approve/reject KYC      |
| PUT    | /users/:id/toggle-active| Activate/deactivate     |
| POST   | /users/create-officer   | Create officer account  |
| GET    | /audit-log              | Full audit trail        |
| PUT    | /service-fees/:type     | Update service fee      |
| GET    | /revenue-report         | Revenue analytics       |

### Retailers  `/api/retailers`
| Method | Path              | Description              |
|--------|-------------------|--------------------------|
| POST   | /register         | Register as retailer     |
| GET    | /my               | My retailer profile+stats|
| GET    | /commission-history| Commission earnings     |
| GET    | /                 | All retailers [Admin]    |

---

## Production Deployment (VPS / Ubuntu)

### 1. Install Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2 (process manager)
```bash
npm install -g pm2
cd janaseva/backend
pm2 start server.js --name janaseva-api
pm2 startup && pm2 save
```

### 3. Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name yourdomain.in;

    # Frontend
    root /var/www/janaseva/frontend;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/janaseva/backend/uploads/;
    }

    location / { try_files $uri $uri/ /index.html; }
}
```

### 4. SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.in
```

### 5. Update frontend API URL
In `frontend/index.html`, change:
```js
const API = 'https://yourdomain.in/api';
```

---

## Environment Variables (`.env`)

| Variable               | Required | Description                          |
|------------------------|----------|--------------------------------------|
| PORT                   | No       | Server port (default: 5000)          |
| JWT_SECRET             | **YES**  | Strong random string (32+ chars)     |
| DB_PATH                | No       | SQLite file path (default: ./janaseva.db) |
| SMTP_HOST              | No       | Email SMTP host                      |
| SMTP_USER              | No       | Email address                        |
| SMTP_PASS              | No       | Email app password                   |
| RAZORPAY_KEY_ID        | No       | Razorpay key (for live payments)     |
| RAZORPAY_KEY_SECRET    | No       | Razorpay secret                      |
| SMS_API_KEY            | No       | Msg91 API key (for OTP SMS)          |
| FRONTEND_URL           | No       | Frontend URL for CORS                |

---

## Service Types Reference

All 30 service types accepted by `/api/applications/submit`:

`pan_new` · `pan_correction` · `pan_missing` · `aadhaar_update` · `pvc_aadhaar`
`passport_fresh` · `passport_renewal` · `passport_tatkal`
`driving_licence` · `dl_renewal` · `learners_licence`
`gst_new` · `gst_amendment` · `gst_composition`
`msme_udyam` · `caste_cert` · `income_cert` · `domicile` · `birth_death`
`dsc` · `abha` · `eshram` · `pmsym`
`recharge` · `electricity` · `bbps`
`pvc_card` · `savings_account` · `eaadhaar_print` · `rc_print` · `epan_print`

---

*JanaSeva E-Governance Portal · v1.0.0 · © 2026*
