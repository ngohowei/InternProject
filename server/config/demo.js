import { INITIAL_ACCOUNTS } from '../../src/data/initialData.js';

/**
 * Demo mode turns on the conveniences that are only safe on a private demo machine:
 *   - the 1-click "login as admin / engineer / customer" buttons on the sign-in page
 *   - the admin "Reset Demo" button (wipes ALL data and restores the sample data)
 *
 * Set DEMO_MODE=true / false in server/.env. When it is not set, demo mode is ON in development
 * and OFF when NODE_ENV=production. Turn it OFF before sharing the site with anyone.
 */
export const isDemoMode = () => {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

const demoAccount = (email, role, label) => {
  const a = INITIAL_ACCOUNTS.find((x) => x.email === email);
  return a ? { role, label, email: a.email, password: a.password } : null;
};

/**
 * The sample logins behind the 1-click buttons. They are sent to the browser ONLY in demo mode, so
 * a live site's web page and JavaScript contain no passwords at all.
 */
export const getDemoLogins = () =>
  isDemoMode()
    ? [
        demoAccount('admin@welpack.com', 'admin', 'ADMIN'),
        demoAccount('alex@welpack.com', 'engineer', 'STAFF ENGINEER'),
        demoAccount('dmiller@acmesemi.com', 'customer', 'CUSTOMER')
      ].filter(Boolean)
    : [];
