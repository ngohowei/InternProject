import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/*
 * Brute-force / abuse protection for the sign-in endpoints.
 *
 * Design goals:
 *  - Normal use is never limited: successful sign-ins and page refreshes (/auth/me) are not counted.
 *  - Only FAILED attempts count against password / code guessing.
 *  - Limits are tracked per (network address + account), so one person mistyping their password
 *    can't lock other people out, and an attacker can't lock a real user out from a different network.
 *  - A looser per-network cap still stops one address from guessing across many accounts.
 *  - Sending a verification code costs money (SMS / email), so every request counts there.
 */
const WINDOW_MS = 15 * 60 * 1000;

const accountOf = (req) => String(req.body?.emailOrPhone ?? '').trim().toLowerCase().slice(0, 100);

const tooMany = (reason) => (req, res) => {
  const msLeft = req.rateLimit?.resetTime ? Math.max(0, req.rateLimit.resetTime.getTime() - Date.now()) : WINDOW_MS;
  const minutes = Math.max(1, Math.ceil(msLeft / 60000));
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    retryAfterSeconds: Math.ceil(msLeft / 1000),
    error: `${reason} Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`
  });
};

const make = ({ limit, perAccount, failedOnly, reason }) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: failedOnly,
    keyGenerator: (req) => (perAccount ? `${ipKeyGenerator(req.ip)}|${accountOf(req)}` : ipKeyGenerator(req.ip)),
    handler: tooMany(reason)
  });

// Sign in: failed attempts only
export const loginPerAccount = make({
  limit: 8, perAccount: true, failedOnly: true,
  reason: 'Too many failed sign-in attempts for this account.'
});
export const loginPerNetwork = make({
  limit: 40, perAccount: false, failedOnly: true,
  reason: 'Too many failed sign-in attempts from this network.'
});

// Requesting a verification code (SMS / email): every request counts
export const otpPerAccount = make({
  limit: 5, perAccount: true, failedOnly: false,
  reason: 'Too many verification codes were requested for this account.'
});
export const otpPerNetwork = make({
  limit: 20, perAccount: false, failedOnly: false,
  reason: 'Too many verification codes were requested from this network.'
});

// Checking a code / current password (guessable): failed attempts only
export const codeCheck = make({
  limit: 8, perAccount: true, failedOnly: true,
  reason: 'Too many incorrect codes or passwords.'
});
