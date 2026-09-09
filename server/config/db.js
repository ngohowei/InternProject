import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let memoryServer = null;

/**
 * Connect to MongoDB.
 *
 * Order of preference:
 *   1. process.env.MONGODB_URI (real, persistent database)
 *   2. In-memory MongoDB — ONLY when USE_MEMORY_DB=true is set explicitly.
 *
 * The in-memory database is wiped on every restart, so it is never used
 * silently: if MONGODB_URI is set but unreachable we throw, so the problem
 * is visible instead of hidden behind throwaway data.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const allowMemory = process.env.USE_MEMORY_DB === 'true';

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`✅ MongoDB connected: ${maskUri(uri)}`);
      return;
    } catch (err) {
      console.error(`❌ Could not connect to MONGODB_URI (${maskUri(uri)}): ${err.message}`);
      if (!allowMemory) {
        console.error('   Set USE_MEMORY_DB=true to fall back to a throwaway in-memory database.');
        throw err;
      }
      console.warn('⚠️  Falling back to in-memory MongoDB (USE_MEMORY_DB=true). Data will NOT persist.');
    }
  }

  if (!uri && !allowMemory) {
    throw new Error(
      'No database configured. Set MONGODB_URI in server/.env, or set USE_MEMORY_DB=true for a throwaway database.'
    );
  }

  memoryServer = await MongoMemoryServer.create();
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.warn(`⚠️  In-memory MongoDB ready at ${memUri} — data is lost on restart.`);
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};

export const isDbConnected = () => mongoose.connection.readyState === 1;

// Hide credentials when logging a connection string
function maskUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}
