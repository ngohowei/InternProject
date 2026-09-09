import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null }
}, {
  timestamps: true
});

// Hash the password whenever it is set/changed (skips values already hashed).
accountSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  if (this.password.startsWith('$2')) return next(); // already a bcrypt hash
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

accountSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

// Never leak secrets when a document is serialised to JSON.
accountSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.otpCode;
    delete ret.otpExpiresAt;
    delete ret.__v;
    return ret;
  }
});

export const Account = mongoose.model('Account', accountSchema);

export const hashPasswordValue = (plain) => bcrypt.hash(plain, 10);
