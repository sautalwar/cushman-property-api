import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { propertyRouter } from './routes/properties';
import { tenantRouter } from './routes/tenants';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global rate limiter — 500 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(globalLimiter);

// Public routes
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/properties', authMiddleware, propertyRouter);
app.use('/api/tenants', authMiddleware, tenantRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Cushman Property API running on port ${PORT}`);
});

export default app;
