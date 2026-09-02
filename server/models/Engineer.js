import mongoose from 'mongoose';

const engineerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  specialty: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, default: 'Available' },
  activeJobs: { type: Number, default: 0 },
  hourlyRate: { type: Number, required: true, default: 100 }
}, {
  timestamps: true
});

export const Engineer = mongoose.model('Engineer', engineerSchema);
