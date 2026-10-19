import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load server/.env regardless of the directory the process was started from.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { connectDB, isDbConnected } from './config/db.js';
import { isDemoMode, getDemoLogins } from './config/demo.js';
import { seedDatabase } from './seed.js';
import { findAccountsWithPublicPasswords } from './config/security.js';

import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import engineerRoutes from './routes/engineerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import partRoutes from './routes/partRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// The built website (npm run build -> dist/). When it exists this server serves it too, so one process
// is the whole site: share this port instead of the Vite development server. SERVE_CLIENT=false turns it off.
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const hasBuild = fs.existsSync(path.join(DIST_DIR, 'index.html'));
const serveClient = process.env.SERVE_CLIENT === 'false' ? false : hasBuild;

// Behind a reverse proxy / load balancer, set TRUST_PROXY (e.g. 1) so the visitor's real address is used.
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isInteger(n) ? n : process.env.TRUST_PROXY);
}

// CORS: allow the configured client origin(s), or all in development.
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: clientOrigins.length ? clientOrigins : true }));

app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Helmet's default forces every request to https, which breaks http://localhost
      'upgrade-insecure-requests': null,
      // The page uses Google Fonts; inline styles come from React's style props
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"]
    }
  }
}));
// The parts CSV import is the one endpoint that legitimately needs a bigger body (up to ~2000 rows).
// Its parser must come first: once a body is parsed, the global parser below skips it.
app.use('/api/parts/import', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/engineers', engineerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/parts', partRoutes);

// Public: tells the web app which demo-only features to show (sign-in shortcuts, Reset Demo)
app.get('/api/config', (req, res) => {
  res.json({ demoMode: isDemoMode(), demoLogins: getDemoLogins() });
});

app.get('/api/health', (req, res) => {
  const connected = isDbConnected();
  res.status(connected ? 200 : 503).json({
    status: connected ? 'OK' : 'DEGRADED',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Unknown /api paths get a JSON 404 - never the web page
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

if (serveClient) {
  // Files in /assets have a hash in their name and never change, so browsers may keep them for a year
  app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(DIST_DIR, { index: false }));

  // Any other page address (e.g. a bookmarked or refreshed link) loads the app, which then shows the right screen.
  // index.html is never cached, so a new release is picked up straight away.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/assets/') || path.extname(req.path)) return next(); // a missing file is a real 404
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// Fallback error handler: client mistakes (bad JSON, body too big) keep their 4xx status; the rest are 500s.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 500) {
    const message = status === 413 ? 'The request is too large' : 'Bad request';
    return res.status(status).json({ success: false, error: message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Server error' });
});

const start = async () => {
  try {
    await connectDB();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Welpack Engineering API running on http://localhost:${PORT}`);

      if (serveClient) {
        console.log(`🌐 Serving the built website from dist/ - open http://localhost:${PORT}`);
      } else if (process.env.NODE_ENV === 'production' && !hasBuild) {
        console.warn('⚠️  No website build found. Run "npm run build" first, or the site will not load.');
      }

      if (isDemoMode()) {
        console.log('🎭 Demo mode is ON (1-click sign-in buttons + Reset Demo are visible). Set DEMO_MODE=false before sharing the site.');
      } else {
        // Sharing the site? The sample passwords are public (README / GitHub), so flag any account still using one.
        findAccountsWithPublicPasswords()
          .then((emails) => {
            if (emails.length > 0) {
              console.warn(
                `⚠️  ${emails.length} account(s) still use a PUBLIC demo password: ${emails.join(', ')}. ` +
                'Anyone who has read the README can sign in as them. Change these passwords before sharing the site.'
              );
            }
          })
          .catch((err) => console.error('Could not check for default passwords:', err.message));
      }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
