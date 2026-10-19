import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load server/.env regardless of the directory the process was started from.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { connectDB, isDbConnected } from './config/db.js';
import { isDemoMode, getDemoLogins } from './config/demo.js';
import { seedDatabase } from './seed.js';

import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import engineerRoutes from './routes/engineerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import partRoutes from './routes/partRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(helmet());
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

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Server error' });
});

const start = async () => {
  try {
    await connectDB();
    await seedDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Welpack Engineering API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
