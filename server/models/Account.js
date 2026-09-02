import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'staff', 'customer'],
    default: 'customer'
  },
  customerName: { type: String, default: '' },
  engineerId: { type: String, default: '' },
  createdByAdmin: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null }
}, {
  timestamps: true
});

export const Account = mongoose.model('Account', accountSchema);
