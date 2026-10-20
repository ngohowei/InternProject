import mongoose from 'mongoose';

// A photo a customer attached to a service request. Kept in its own collection (not inside the
// request) so loading the request list never drags image data along.
const photoSchema = new mongoose.Schema({
  requestId: { type: String, required: true, index: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: String, default: '' }
}, { timestamps: true });

export const Photo = mongoose.model('Photo', photoSchema);
