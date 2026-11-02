import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/authRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

dotenv.config();

// Startup Environment Sanity Verification
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`FATAL: Missing critical environment variable(s): ${missingVars.join(', ')}`);
  process.exit(1);
}

await connectDB();
const app = express();

// Secure CORS configuration
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:5173',
];

const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    // Native mobile apps and server-to-server requests have no Origin header
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Remindly API is live!' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in http://localhost:${PORT}`);
});
