import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { MongoMemoryServer } from 'mongodb-memory-server';

import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import engineerRoutes from './routes/engineerRoutes.js';
import { seedDatabase } from './seed.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect MongoDB with Automatic Fallback
const connectMongoDB = async () => {
  const LOCAL_URI = 'mongodb://localhost:27017/apex_fieldeng';
  try {
    console.log('🍃 Attempting connection to local MongoDB database...');
    await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to MongoDB Database at mongodb://localhost:27017/apex_fieldeng');
  } catch (err) {
    console.log('⚠️ Local MongoDB service not detected on port 27017. Initializing Embedded MongoDB Server...');
    const mongoServer = await MongoMemoryServer.create();
    const memoryUri = mongoServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`✅ Embedded MongoDB Instance Ready at ${memoryUri}`);
  }

  // Seed default data if database is empty
  await seedDatabase();
};

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/engineers', engineerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'MongoDB Connected', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  await connectMongoDB();
  console.log(`🚀 Welpack Engineering MongoDB Backend API Server running on http://localhost:${PORT}`);
});
