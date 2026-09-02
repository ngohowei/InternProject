import express from 'express';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { Account } from '../models/Account.js';

const router = express.Router();

// Helper: Initialize Twilio Client dynamically from process.env
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && sid !== 'your_twilio_account_sid_here' && token && token !== 'your_twilio_auth_token_here') {
    try {
      return twilio(sid, token);
    } catch (e) {
      console.error('Twilio init error:', e.message);
    }
  }
  return null;
};

// Helper: Initialize Nodemailer Transporter dynamically from process.env
const getNodemailerTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && user !== 'your_email@gmail.com' && pass && pass !== 'your_app_password_here') {
    try {
      return nodemailer.createTransport({
        host: host || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user, pass }
      });
    } catch (e) {
      console.error('Nodemailer init error:', e.message);
    }
  }
  return null;
};

// POST /api/auth/login - Role-based database login
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ success: false, error: 'Email/Phone and Password required' });
    }

    const query = emailOrPhone.trim().toLowerCase();
    const account = await Account.findOne({
      $or: [
        { email: query },
        { phone: emailOrPhone.trim() }
      ],
      password: password
    });

    if (!account) {
      return res.status(401).json({ success: false, error: 'Invalid email/phone or password' });
    }

    let role = account.role;
    if (role === 'staff') role = 'engineer';

    return res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: role,
        dbRole: account.role,
        customerName: account.customerName,
        engineerId: account.engineerId
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Database server error' });
  }
});

// POST /api/auth/send-otp - Generate & Send Real SMS (Twilio) and Email (Nodemailer) OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ success: false, error: 'Email or Phone required' });
    }

    const query = emailOrPhone.trim().toLowerCase();
    const account = await Account.findOne({
      $or: [
        { email: query },
        { phone: emailOrPhone.trim() }
      ]
    });

    if (!account) {
      return res.status(404).json({ success: false, error: `Account for '${emailOrPhone}' not found in MongoDB` });
    }

    // Generate random 6-digit OTP code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    account.otpCode = otpCode;
    account.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity
    await account.save();

    let deliveryStatus = [];
    const isPhoneInput = emailOrPhone.trim().startsWith('+') || /^[0-9\-\s\(\)]+$/.test(emailOrPhone.trim());

    // Attempt Twilio Real SMS if input is phone or requested
    const twilioClient = getTwilioClient();
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (isPhoneInput || account.phone) {
      if (twilioClient && twilioPhone && twilioPhone !== 'your_twilio_phone_number_here') {
        try {
          await twilioClient.messages.create({
            body: `[Welpack Engineering] Your password verification code is ${otpCode}. Valid for 10 minutes.`,
            from: twilioPhone,
            to: account.phone || emailOrPhone.trim()
          });
          deliveryStatus.push(`📱 Real SMS sent via Twilio to ${account.phone || emailOrPhone}`);
        } catch (smsErr) {
          console.error('Twilio SMS error:', smsErr.message);
          deliveryStatus.push(`⚠️ Twilio SMS error: ${smsErr.message}`);
        }
      } else if (isPhoneInput) {
        deliveryStatus.push(`⚠️ Twilio Phone Number not configured in server/.env yet (Sent OTP to account email fallback)`);
      }
    }

    // Attempt Nodemailer Real Email if input is email or fallback
    const transporter = getNodemailerTransporter();
    if (transporter && account.email && (!isPhoneInput || deliveryStatus.length === 0 || deliveryStatus.some(s => s.includes('not configured')))) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Welpack Engineering Support" <support@welpack.com>',
          to: account.email,
          subject: '🔑 Welpack Engineering - Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px;">
              <h2 style="color: #2563eb; margin-bottom: 8px;">Welpack Engineering</h2>
              <p style="color: #64748b; margin-top: 0;">Password Reset Verification Code</p>
              <p>Hello <strong>${account.name}</strong>,</p>
              <p>Your 6-digit verification code is:</p>
              <div style="background-color: #f1f5f9; border-left: 4px solid #3b82f6; padding: 14px 20px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b; display: inline-block; margin: 12px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 0.85rem; color: #64748b;">This code will expire in 10 minutes.</p>
            </div>
          `
        });
        deliveryStatus.push(`✉️ Real Email sent via Nodemailer to ${account.email}`);
      } catch (emailErr) {
        console.error('Nodemailer Email error:', emailErr.message);
        deliveryStatus.push(`⚠️ Email error: ${emailErr.message}`);
      }
    }

    const isRealServiceUsed = deliveryStatus.some(s => s.includes('Real SMS') || s.includes('Real Email'));

    if (deliveryStatus.length === 0) {
      deliveryStatus.push(`🔑 OTP generated: ${otpCode} (Fill server/.env with Twilio/Nodemailer credentials for live SMS/Email delivery)`);
    }

    return res.json({
      success: true,
      otpCode: isRealServiceUsed ? undefined : otpCode,
      message: deliveryStatus.join(' | ')
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// POST /api/auth/verify-otp - Pre-verify code before showing new password fields
router.post('/verify-otp', async (req, res) => {
  try {
    const { emailOrPhone, currentPasswordOrCode } = req.body;
    if (!emailOrPhone || !currentPasswordOrCode) {
      return res.status(400).json({ success: false, error: 'Email/Phone and Verification Code required' });
    }

    const query = emailOrPhone.trim().toLowerCase();
    const account = await Account.findOne({
      $or: [
        { email: query },
        { phone: emailOrPhone.trim() }
      ]
    });

    if (!account) {
      return res.status(404).json({ success: false, error: `Account '${emailOrPhone}' not found` });
    }

    const isCurrentPass = currentPasswordOrCode === account.password;
    const isDemoCode = currentPasswordOrCode === '123456';
    const isOtpValid = account.otpCode && currentPasswordOrCode === account.otpCode && account.otpExpiresAt && new Date() < new Date(account.otpExpiresAt);

    if (!isCurrentPass && !isDemoCode && !isOtpValid) {
      return res.status(401).json({ success: false, error: 'Incorrect verification code or password' });
    }

    return res.json({ success: true, message: 'Identity verified successfully!' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
router.post('/change-password', async (req, res) => {
  try {
    const { emailOrPhone, currentPasswordOrCode, newPassword } = req.body;
    if (!emailOrPhone || !currentPasswordOrCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const query = emailOrPhone.trim().toLowerCase();
    const account = await Account.findOne({
      $or: [
        { email: query },
        { phone: emailOrPhone.trim() }
      ]
    });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    // Verification check: current password OR valid unexpired OTP OR demo code 123456
    const isCurrentPass = currentPasswordOrCode === account.password;
    const isDemoCode = currentPasswordOrCode === '123456';
    const isOtpValid = account.otpCode && currentPasswordOrCode === account.otpCode && account.otpExpiresAt && new Date() < new Date(account.otpExpiresAt);

    if (!isCurrentPass && !isDemoCode && !isOtpValid) {
      return res.status(401).json({ success: false, error: 'Incorrect current password or invalid/expired verification code' });
    }

    account.password = newPassword;
    account.otpCode = null;
    account.otpExpiresAt = null;
    await account.save();

    return res.json({ success: true, message: 'Password updated successfully in MongoDB' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

export default router;
