import jwt from 'jsonwebtoken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to server/.env');
  }
  return secret;
};

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

/** Require a valid Bearer token. Attaches req.user. */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(token, getSecret());
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
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
