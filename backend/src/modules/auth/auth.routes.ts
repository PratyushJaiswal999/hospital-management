import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { verifyToken, AuthenticatedRequest } from '../../middleware/auth';
import { Role } from '@prisma/client';
import { getGoogleAuthUrl, handleGoogleCallback } from '../calendar/calendar.service';
import { sendDirectEmail } from '../notifications/email.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// ── Helpers ────────────────────────────────────────────────────────────────
function signTokens(payload: { id: string; email: string; role: Role }) {
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as string,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
  } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

// ── POST /auth/register ────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: Role.PATIENT,
      phone: body.phone,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  const tokens = signTokens({ id: user.id, email: user.email, role: user.role });

  // Send welcome email (non-blocking)
  sendDirectEmail({
    to: user.email,
    type: 'WELCOME_PATIENT',
    payload: { name: user.name, email: user.email },
  });

  res.status(201).json({ user, ...tokens });
});

// ── POST /auth/login ───────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const tokens = signTokens({ id: user.id, email: user.email, role: user.role });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  });
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError(400, 'Refresh token required', 'MISSING_TOKEN');

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      id: string;
      email: string;
      role: Role;
    };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError(401, 'User not found', 'USER_NOT_FOUND');

    const tokens = signTokens({ id: user.id, email: user.email, role: user.role });
    res.json(tokens);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token', 'TOKEN_INVALID');
  }
});

// ── GET /auth/me ───────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
      googleCalendarToken: { select: { id: true } }, // just to know if connected
    },
  });
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  res.json({
    ...user,
    googleCalendarConnected: !!user.googleCalendarToken,
    googleCalendarToken: undefined,
  });
});

// ── GET /auth/google ───────────────────────────────────────────────────────
router.get('/google', verifyToken, (req: AuthenticatedRequest, res) => {
  const url = getGoogleAuthUrl(req.user!.id);
  res.redirect(url);
});

// ── GET /auth/google/callback ──────────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query as { code: string; state: string };
  if (!code || !state) throw new AppError(400, 'Missing OAuth params', 'OAUTH_ERROR');

  await handleGoogleCallback(code, state);
  res.redirect(`${process.env.FRONTEND_URL}/google-connected?success=true`);
});

export default router;
