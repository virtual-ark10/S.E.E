/**
 * Database Adapter
 * Handles MongoDB connection (used by app.js)
 * This file exists as a reference point; actual connection is in app.js
 */
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/see');
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
}

export default { connectDB };
