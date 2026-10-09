import mongoose from 'mongoose';

// Stores MSAL's serialized token cache (access + refresh tokens) so the
// Outlook connection survives server restarts. There is only ever one document.
const tokenCacheSchema = new mongoose.Schema(
  {
    _id: { type: String },
    data: { type: String, required: true },
  },
  { timestamps: true }
);

export const TokenCache = mongoose.model('TokenCache', tokenCacheSchema);
