import jwt from 'jsonwebtoken';
import { Engineer } from '../models/Engineer.js';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to server/.env');
  }
  return secret;
};

export const DEACTIVATED_MESSAGE = 'This account has been deactivated. Please contact your administrator.';

export const signToken = (account) =>
  jwt.sign(
    {
      sub: account.id,
      // 'staff' is the DB role; everything downstream uses the client-facing 'engineer'
      role: account.role === 'staff' ? 'engineer' : account.role,
      name: account.name,
      email: account.email,
      engineerId: account.engineerId || null,
      customerName: account.customerName || null
    },
    getSecret(),
    { expiresIn: '12h' }
  );

/** True when this engineer id exists and has not been deactivated by an admin. */
export const isEngineerActive = async (engineerId) => {
  if (!engineerId) return false;
  const eng = await Engineer.findOne({ id: engineerId }, 'isActive');
  return !!eng && eng.isActive !== false;
};

/**
 * Require a valid Bearer token. Attaches req.user.
 * Engineers are re-checked against the database on every request, so deactivating
 * an engineer cuts off their existing sessions immediately, not only new logins.
 */
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  let user;
  try {
    user = jwt.verify(token, getSecret());
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }

  try {
    if (user.role === 'engineer' && !(await isEngineerActive(user.engineerId))) {
      return res.status(403).json({ success: false, code: 'DEACTIVATED', error: DEACTIVATED_MESSAGE });
    }
  } catch (err) {
    return next(err);
  }

  req.user = user;
  next();
};

/** Require the authenticated user to have one of the given roles. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'You do not have permission to do this' });
  }
  next();
};
