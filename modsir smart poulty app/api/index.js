require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection (using Mongoose connection reuse for Serverless)
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;

  if (!process.env.MONGO_URI) {
    console.warn('⚠️ MONGO_URI is not defined. API will not work correctly.');
    throw new Error('MONGO_URI is missing');
  }
  
  const db = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  
  cachedDb = db;
  return db;
}

// Root route (function mounts at /api)
app.get('/', async (req, res) => {
    try {
        // Attempt DB connection but don't fail application if missing in non-DB endpoints
        if (process.env.MONGO_URI) await connectToDatabase();
        res.json({ message: 'ModSir Farm SaaS API Running (Vercel Serverless)' });
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Health route
app.get('/health', async (req, res) => {
    try {
        await connectToDatabase();
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: err.message });
    }
});

// Export as a Vercel-compatible handler
module.exports = serverless(app);
