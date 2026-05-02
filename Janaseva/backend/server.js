// server.js — JanaSeva E-Governance Portal Backend
// Entry point: sets up Express, middleware, routes, error handling

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// ─── Route Imports ────────────────────────────────────
const authRoutes         = require('./routes/auth');
const applicationRoutes  = require('./routes/applications');
const paymentRoutes      = require('./routes/payments');
const walletRoutes       = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');
const serviceRoutes      = require('./routes/services');
const adminRoutes        = require('./routes/admin');
const adminServiceRoutes = require('./routes/admin_services'); // FIXED
const retailerRoutes     = require('./routes/retailers');

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────
//  SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow file serving
  contentSecurityPolicy: false, // allow tailwind, fonts, and external videos
}));

app.use(cors({
  origin: (origin, cb) => {
    // Reflect exactly what the client requested to allow all origins
    cb(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────────────────────────────────────────────
//  RATE LIMITING
// ─────────────────────────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' },
});

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,  // strict for login/register
  message: { success: false, message: 'Too many auth attempts. Try again after 15 minutes.' },
});

const otpLimit = rateLimit({
  windowMs: 60 * 1000,   // 1 min
  max: 3,
  message: { success: false, message: 'Too many OTP requests. Wait 1 minute.' },
});

app.use(globalLimit);

// ─────────────────────────────────────────────────────
//  BODY PARSING
// ─────────────────────────────────────────────────────
// Razorpay webhook needs raw body — must be before json()
app.use('/api/payments/webhook', express.raw({ type: '*/*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────
//  LOGGING
// ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─────────────────────────────────────────────────────
//  STATIC FILES (uploaded documents)
// ─────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads'), {
  setHeaders(res) {
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
  },
}));

// ─────────────────────────────────────────────────────
//  HEALTH CHECK
// ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'JanaSeva API',
    version: '1.0.0',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'JanaSeva E-Governance API',
    version: '1.0.0',
    endpoints: {
      auth:          '/api/auth',
      applications:  '/api/applications',
      payments:      '/api/payments',
      wallet:        '/api/wallet',
      notifications: '/api/notifications',
      services:      '/api/services',
      admin:         '/api/admin',
      retailers:     '/api/retailers',
    }
  });
});

// ─────────────────────────────────────────────────────
//  API ROUTES
// ─────────────────────────────────────────────────────
app.use('/api/auth',          authLimit, authRoutes);
app.use('/api/auth/send-otp', otpLimit);
app.use('/api/applications',  applicationRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/admin/services',   adminServiceRoutes); // FIXED: admin service CRUD
app.use('/api/retailers',     retailerRoutes);

// ─────────────────────────────────────────────────────
//  SERVE FRONTEND (production)
// ─────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ─────────────────────────────────────────────────────
//  ERROR HANDLING
// ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   JanaSeva E-Governance API               ║
  ║   Port    : ${PORT}                          ║
  ║   Env     : ${process.env.NODE_ENV || 'development'}                  ║
  ║   DB      : ${process.env.DB_PATH || './janaseva.db'}             ║
  ║   Health  : http://localhost:${PORT}/health  ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app; // for testing
