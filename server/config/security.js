import bcrypt from 'bcryptjs';
import { Account } from '../models/Account.js';

// The sample passwords are published in the README and in the repository, so anyone can try them.
const PUBLIC_DEMO_PASSWORDS = ['admin123', 'staff123', 'cust123'];
const MAX_ACCOUNTS_CHECKED = 500;

/**
 * Emails of accounts that still use one of the public sample passwords.
 * Slow by design (a real password check per account), so call it in the background, not at request time.
 */
export const findAccountsWithPublicPasswords = async () => {
  const accounts = await Account.find({}, 'email password').limit(MAX_ACCOUNTS_CHECKED);
  const flagged = [];
  for (const account of accounts) {
    for (const candidate of PUBLIC_DEMO_PASSWORDS) {
      if (await bcrypt.compare(candidate, account.password)) {
        flagged.push(account.email);
        break;
      }
    }
  }
  return flagged;
};
