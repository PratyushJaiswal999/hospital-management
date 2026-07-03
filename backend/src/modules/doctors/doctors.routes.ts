import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { verifyToken } from '../../middleware/auth';
import { getAvailableSlots } from './availability.service';

const router = Router();

// ── GET /doctors ──────────────────────────────────────────────────────────
// Public — no auth required for search
router.get('/', async (req, res) => {
  const { specialisation, name } = req.query as {
    specialisation?: string;
    name?: string;
  };

  const doctors = await prisma.doctorProfile.findMany({
    where: {
      ...(specialisation && {
        specialisation: { contains: specialisation, mode: 'insensitive' },
      }),
      ...(name && {
        user: { name: { contains: name, mode: 'insensitive' } },
      }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { specialisation: 'asc' },
  });

  res.json(doctors);
});

// ── GET /doctors/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doctor) {
    res.status(404).json({ error: 'Doctor not found', code: 'DOCTOR_NOT_FOUND' });
    return;
  }
  res.json(doctor);
});

// ── GET /doctors/:id/availability ─────────────────────────────────────────
// Query: ?date=YYYY-MM-DD
router.get('/:id/availability', async (req, res) => {
  const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
  const date = dateSchema.parse(req.query.date as string);

  const slots = await getAvailableSlots(req.params.id, date);
  res.json({ doctorId: req.params.id, date, slots });
});

export default router;
