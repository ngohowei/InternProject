import mongoose from 'mongoose';

/**
 * Parts catalog. Admins maintain it; engineers pick items from it when logging work.
 * The unit price lives here, so engineers only ever enter a quantity.
 *
 * A report line stores a SNAPSHOT of the code / name / price at the time it was added, so editing
 * or deleting a catalog item later never changes work that was already logged or invoiced.
 */
export const PART_CATEGORIES = ['Electrical', 'HVAC', 'Automation', 'Mechanical', 'Software', 'General'];

const partSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: PART_CATEGORIES, default: 'General', index: true },
  unitPrice: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Fast name lookups / sorting for large catalogs
partSchema.index({ name: 1 });

export const Part = mongoose.model('Part', partSchema);

export const PART_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,29}$/;

/** Match free text ("hvac", " Electrical ") to a canonical category. '' -> '', unknown -> null. */
export const matchCategory = (value) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return '';
  return PART_CATEGORIES.find((c) => c.toLowerCase() === s) || null;
};
