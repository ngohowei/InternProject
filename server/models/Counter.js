import mongoose from 'mongoose';

/**
 * Atomic sequence generator. One document per named sequence, e.g. { _id: 'request', seq: 12 }.
 * findOneAndUpdate with $inc is atomic, so concurrent requests never get the same number.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Return the next integer in a named sequence.
 * @param {string} name  e.g. 'request', 'customerAccount', 'engineer'
 */
export const nextSeq = async (name) => {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

/**
 * Make sure a sequence is at least `value` (used after seeding fixed IDs).
 */
export const ensureSeqAtLeast = async (name, value) => {
  const doc = await Counter.findById(name);
  if (!doc || doc.seq < value) {
    await Counter.findByIdAndUpdate(name, { seq: value }, { upsert: true });
  }
};

export default Counter;
