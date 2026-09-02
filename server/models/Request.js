import mongoose from 'mongoose';

const workLogSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  author: { type: String, required: true },
  role: { type: String, required: true },
  text: { type: String, required: true }
}, { _id: false });

const partItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  qty: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true, default: 0 }
}, { _id: false });

const fieldReportSchema = new mongoose.Schema({
  hoursSpent: { type: Number, default: 0 },
  diagnosis: { type: String, default: '' },
  partsUsed: [partItemSchema],
  completedAt: { type: String, default: null }
}, { _id: false });

const billingSchema = new mongoose.Schema({
  baseCalloutFee: { type: Number, default: 150 },
  hourlyRate: { type: Number, default: 100 },
  totalHours: { type: Number, default: 0 },
  laborTotal: { type: Number, default: 0 },
  partsTotal: { type: Number, default: 0 },
  subtotal: { type: Number, default: 150 },
  tax: { type: Number, default: 12 },
  grandTotal: { type: Number, default: 162 },
  billingStatus: { type: String, default: 'Unbilled' }, // 'Unbilled' | 'Invoice Sent' | 'Paid'
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: String, default: null }
}, { _id: false });

const requestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  customerName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  dateSubmitted: { type: String, required: true },
  status: { type: String, required: true, default: 'Pending' }, // Pending, Assigned, En Route, In Progress, Completed, Billed, Paid
  assignedEngineerId: { type: String, default: '' },
  assignedEngineerName: { type: String, default: 'Unassigned' },
  workLog: [workLogSchema],
  fieldReport: { type: fieldReportSchema, default: () => ({}) },
  billing: { type: billingSchema, default: () => ({}) }
}, {
  timestamps: true
});

export const Request = mongoose.model('Request', requestSchema);
