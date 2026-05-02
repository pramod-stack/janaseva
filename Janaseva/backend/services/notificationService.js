// services/notificationService.js
// Sends emails via Nodemailer and SMS via Msg91/Fast2SMS

const nodemailer = require('nodemailer');

// ─── Mailer Setup ────────────────────────────────────
let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ─── Email Templates ─────────────────────────────────
const emailTemplates = {
  welcome: (name) => ({
    subject: 'Welcome to JanaSeva E-Governance Portal!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#f0f2f7;padding:30px">
        <div style="background:#1a0a2e;padding:20px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Jana <span style="color:#f39c12">Seva</span></h1>
          <p style="color:#aaa;margin:4px 0 0;font-size:12px">E-GOVERNANCE PORTAL</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px">
          <h2 style="color:#1a1a2e">Welcome, ${name}! 🎉</h2>
          <p style="color:#555;line-height:1.6">Your JanaSeva account has been created. You can now access 30+ government services from one platform.</p>
          <div style="background:#f0faf5;border-left:4px solid #27ae60;padding:16px;border-radius:0 8px 8px 0;margin:20px 0">
            <strong>Next step:</strong> Complete your KYC verification to unlock all services.
          </div>
          <a href="${process.env.FRONTEND_URL}/profile" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete KYC →</a>
        </div>
      </div>`,
  }),

  applicationSubmitted: (name, refNumber, serviceName) => ({
    subject: `Application Submitted – ${refNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#1a0a2e">Application Received ✅</h2>
        <p>Dear ${name},</p>
        <p>Your application for <strong>${serviceName}</strong> has been submitted successfully.</p>
        <div style="background:#f8f9fb;border:1px solid #e5e9f0;border-radius:10px;padding:20px;margin:20px 0">
          <p style="margin:0;color:#888;font-size:12px">Reference Number</p>
          <h3 style="margin:4px 0;color:#c0392b;font-size:22px;letter-spacing:2px">${refNumber}</h3>
        </div>
        <p>Track your application at: <a href="${process.env.FRONTEND_URL}/track/${refNumber}">${process.env.FRONTEND_URL}/track/${refNumber}</a></p>
      </div>`,
  }),

  applicationApproved: (name, refNumber, serviceName) => ({
    subject: `✅ Application Approved – ${refNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#27ae60;padding:16px;border-radius:10px;text-align:center;margin-bottom:20px">
          <h2 style="color:#fff;margin:0">Application Approved! 🎉</h2>
        </div>
        <p>Dear ${name},</p>
        <p>Great news! Your application for <strong>${serviceName}</strong> (Ref: <strong>${refNumber}</strong>) has been <strong style="color:#27ae60">APPROVED</strong>.</p>
        <a href="${process.env.FRONTEND_URL}/reports" style="display:inline-block;background:#27ae60;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Download Certificate →</a>
      </div>`,
  }),

  otp: (otp) => ({
    subject: 'Your JanaSeva OTP',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;text-align:center">
        <h2>Your OTP</h2>
        <div style="background:#1a0a2e;padding:20px;border-radius:12px">
          <span style="color:#f39c12;font-size:36px;font-weight:700;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#888;font-size:12px;margin-top:16px">Valid for 10 minutes. Do not share with anyone.</p>
      </div>`,
  }),

  paymentConfirmation: (name, amount, serviceName, refNumber) => ({
    subject: `Payment Confirmed – ₹${amount} for ${serviceName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Payment Successful ✅</h2>
        <p>Dear ${name},</p>
        <p>₹<strong>${amount}</strong> paid for <strong>${serviceName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e9f0;color:#888">Reference</td><td style="padding:8px;border:1px solid #e5e9f0"><strong>${refNumber}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e9f0;color:#888">Amount</td><td style="padding:8px;border:1px solid #e5e9f0;color:#27ae60"><strong>₹${amount}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e9f0;color:#888">Date</td><td style="padding:8px;border:1px solid #e5e9f0">${new Date().toLocaleString('en-IN')}</td></tr>
        </table>
      </div>`,
  }),
};

// ─── Send Email ───────────────────────────────────────
async function sendEmail(to, templateKey, ...args) {
  try {
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') {
      console.log(`[EMAIL STUB] To: ${to} | Template: ${templateKey} | Args:`, args);
      return { success: true, stub: true };
    }

    const template = emailTemplates[templateKey]?.(...args);
    if (!template) throw new Error(`Unknown email template: ${templateKey}`);

    const info = await getTransporter().sendMail({
      from: `"JanaSeva Portal" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    });

    console.log(`[EMAIL] Sent to ${to}: ${template.subject} (${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL ERROR] ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Send SMS ─────────────────────────────────────────
async function sendSMS(mobile, message) {
  try {
    if (!process.env.SMS_API_KEY || process.env.SMS_API_KEY === 'your_sms_api_key') {
      console.log(`[SMS STUB] To: ${mobile} | Message: ${message}`);
      return { success: true, stub: true };
    }

    // Msg91 API integration
    const response = await fetch(`https://api.msg91.com/api/v5/flow/`, {
      method: 'POST',
      headers: { 'authkey': process.env.SMS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: process.env.SMS_TEMPLATE_ID,
        sender: process.env.SMS_SENDER_ID || 'SEVAON',
        mobiles: `91${mobile}`,
        VAR1: message,
      }),
    });

    const result = await response.json();
    console.log(`[SMS] Sent to ${mobile}: ${result.type}`);
    return { success: result.type === 'success' };
  } catch (err) {
    console.error(`[SMS ERROR] ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Convenience Senders ─────────────────────────────
async function notifyApplicationSubmitted(userEmail, userName, refNumber, serviceName) {
  return sendEmail(userEmail, 'applicationSubmitted', userName, refNumber, serviceName);
}

async function notifyApplicationApproved(userEmail, userName, refNumber, serviceName) {
  return sendEmail(userEmail, 'applicationApproved', userName, refNumber, serviceName);
}

async function notifyOTP(mobile, otp, email) {
  await sendSMS(mobile, `Your JanaSeva OTP is ${otp}. Valid for 10 minutes. Do not share.`);
  if (email) await sendEmail(email, 'otp', otp);
}

module.exports = { sendEmail, sendSMS, notifyApplicationSubmitted, notifyApplicationApproved, notifyOTP };
