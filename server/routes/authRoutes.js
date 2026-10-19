import express from 'express';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { Account } from '../models/Account.js';
import { signToken, requireAuth, isEngineerActive, DEACTIVATED_MESSAGE } from '../middleware/auth.js';

const router = express.Router();
const isProd = () => process.env.NODE_ENV === 'production';

// Helper: Initialize Twilio Client dynamically from process.env
const getTwilioClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && sid.startsWith('AC') && token) {
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
  if (host && user && pass) {
    try {
      return nodemailer.createTransport({
        host,
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

const findAccount = (emailOrPhone) => {
  const raw = String(emailOrPhone).trim();
  return Account.findOne({
    $or: [{ email: raw.toLowerCase() }, { phone: raw }]
  });
};

// POST /api/auth/login - password check + JWT issue
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ success: false, error: 'Email/Phone and Password required' });
    }

    const account = await findAccount(emailOrPhone);
    if (!account || !(await account.verifyPassword(String(password)))) {
      return res.status(401).json({ success: false, error: 'Invalid email/phone or password' });
    }

    // A deactivated engineer must not be able to sign in (checked after the password so
    // the message is only revealed to someone who actually knows the credentials).
    if (account.role === 'staff' && !(await isEngineerActive(account.engineerId))) {
      return res.status(403).json({ success: false, code: 'DEACTIVATED', error: DEACTIVATED_MESSAGE });
    }

    // 'staff' is the DB role; the client-facing role is 'engineer'
    const clientRole = account.role === 'staff' ? 'engineer' : account.role;
    const token = signToken(account);

    return res.json({
      success: true,
      token,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: clientRole,
        dbRole: account.role,
        customerName: account.customerName,
        engineerId: account.engineerId
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/auth/me - restore session from a stored token
router.get('/me', requireAuth, async (req, res) => {
  try {
    const account = await Account.findOne({ id: req.user.sub });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    const clientRole = account.role === 'staff' ? 'engineer' : account.role;
    return res.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        role: clientRole,
        dbRole: account.role,
        customerName: account.customerName,
        engineerId: account.engineerId
      }
    });
  } catch (err) {
    console.error('Session restore error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/auth/send-otp - generate a reset code, deliver via SMS/email when configured
router.post('/send-otp', async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    if (!emailOrPhone) {
      return res.status(400).json({ success: false, error: 'Email or Phone required' });
    }

    const account = await findAccount(emailOrPhone);
    if (!account) {
      // Do not reveal whether an account exists
      return res.json({ success: true, message: 'If that account exists, a verification code has been sent.' });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    account.otpCode = otpCode;
    account.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await account.save();

    const deliveryStatus = [];
    const isPhoneInput = /^[+0-9\-\s()]+$/.test(String(emailOrPhone).trim());

    const twilioClient = getTwilioClient();
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    if ((isPhoneInput || account.phone) && twilioClient && twilioPhone) {
      try {
        await twilioClient.messages.create({
          body: `[Welpack Engineering] Your password verification code is ${otpCode}. Valid for 10 minutes.`,
          from: twilioPhone,
          to: account.phone || String(emailOrPhone).trim()
        });
        deliveryStatus.push('SMS sent');
      } catch (smsErr) {
        console.error('Twilio SMS error:', smsErr.message);
      }
    }

    const transporter = getNodemailerTransporter();
    if (transporter && account.email && deliveryStatus.length === 0) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Welpack Engineering Support" <support@welpack.com>',
          to: account.email,
          subject: 'Welpack Engineering - Verification Code',
          html: `<p>Hello <strong>${account.name}</strong>,</p>
                 <p>Your 6-digit verification code is:</p>
                 <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${otpCode}</p>
                 <p>This code expires in 10 minutes.</p>`
        });
        deliveryStatus.push('Email sent');
      } catch (emailErr) {
        console.error('Nodemailer error:', emailErr.message);
      }
    }

    const delivered = deliveryStatus.length > 0;
    return res.json({
      success: true,
      // Only expose the code directly outside production, when no real channel delivered it
      devOtpCode: !isProd() && !delivered ? otpCode : undefined,
      message: delivered
        ? `Verification code sent (${deliveryStatus.join(', ')}).`
        : isProd()
          ? 'Verification code generated. Contact your administrator if you do not receive it.'
          : `Dev mode: code is ${otpCode} (configure SMTP/Twilio in server/.env for real delivery).`
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

const verifyIdentity = (account, currentPasswordOrCode) => {
  const codeValid =
    account.otpCode &&
    currentPasswordOrCode === account.otpCode &&
    account.otpExpiresAt &&
    new Date() < new Date(account.otpExpiresAt);
  return { codeValid };
};

// POST /api/auth/verify-otp - pre-check a code or current password
router.post('/verify-otp', async (req, res) => {
  try {
    const { emailOrPhone, currentPasswordOrCode } = req.body;
    if (!emailOrPhone || !currentPasswordOrCode) {
      return res.status(400).json({ success: false, error: 'Email/Phone and Verification Code required' });
    }

    const account = await findAccount(emailOrPhone);
    if (!account) {
      return res.status(401).json({ success: false, error: 'Incorrect verification code or password' });
    }

    const isCurrentPass = await account.verifyPassword(String(currentPasswordOrCode));
    const { codeValid } = verifyIdentity(account, currentPasswordOrCode);

    if (!isCurrentPass && !codeValid) {
      return res.status(401).json({ success: false, error: 'Incorrect verification code or password' });
    }

    return res.json({ success: true, message: 'Identity verified' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { emailOrPhone, currentPasswordOrCode, newPassword } = req.body;
    if (!emailOrPhone || !currentPasswordOrCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const account = await findAccount(emailOrPhone);
    if (!account) {
      return res.status(401).json({ success: false, error: 'Incorrect current password or invalid/expired code' });
    }

    const isCurrentPass = await account.verifyPassword(String(currentPasswordOrCode));
    const { codeValid } = verifyIdentity(account, currentPasswordOrCode);

    if (!isCurrentPass && !codeValid) {
      return res.status(401).json({ success: false, error: 'Incorrect current password or invalid/expired code' });
    }

    account.password = String(newPassword); // hashed by the model pre-save hook
    account.otpCode = null;
    account.otpExpiresAt = null;
    await account.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
