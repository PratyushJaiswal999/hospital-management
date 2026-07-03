import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import doctorRoutes from './modules/doctors/doctors.routes';
import appointmentRoutes from './modules/appointments/appointments.routes';
import notificationRoutes from './modules/notifications/notifications.routes';

import { rateLimiter } from './middleware/rateLimit';

const app = express();

// Configure Rate Limiters
const authLimiter = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Max 15 authentication attempts per minute
  message: 'Too many authentication attempts. Please try again in a minute.',
});

const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Max 200 requests per 15 minutes
  message: 'Too many requests from this client. Please try again after 15 minutes.',
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/admin', apiLimiter, adminRoutes);
app.use('/doctors', apiLimiter, doctorRoutes);
app.use('/appointments', apiLimiter, appointmentRoutes);
app.use('/notifications', apiLimiter, notificationRoutes);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() }),
);

// ── Error Handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '4000', 10);
app.listen(PORT, () => {
  console.log(`🏥 Healthcare API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
