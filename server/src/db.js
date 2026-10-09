import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDb() {
  try {
    await mongoose.connect(config.mongoUri);
  } catch (err) {
    console.error(`\nCould not connect to MongoDB at MONGODB_URI.\n${err.message}\n`);
    process.exit(1);
  }
}

export function disconnectDb() {
  return mongoose.disconnect();
}
