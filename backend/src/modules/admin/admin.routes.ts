import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { verifyToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { Role, AppointmentStatus } from '@prisma/client';
import { enqueueEmail, sendDirectEmail } from '../notifications/email.service';
import { deleteCalendarEvent } from '../calendar/calendar.service';

const router = Router();

// All admin routes require ADMIN role
router.use(verifyToken, requireRole(Role.ADMIN));

// ── Schemas ────────────────────────────────────────────────────────────────
const createDoctorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).default('Doctor@1234'),
  phone: z.string().optional(),
  specialisation: z.string().min(2),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(5).max(120).default(30),
  workingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
});

const updateDoctorSchema = z.object({
  name: z.string().min(2).optional(),
  specialisation: z.string().min(2).optional(),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDurationMinutes: z.number().int().min(5).max(120).optional(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
});

const leaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().optional(),
});

import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

// ── GET /admin/stats ──────────────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  const [doctorCount, patientCount, appointmentGroups] = await Promise.all([
    prisma.user.count({ where: { role: 'DOCTOR' } }),
    prisma.user.count({ where: { role: 'PATIENT' } }),
    prisma.appointment.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const appointments: Record<string, number> = {};
  for (const group of appointmentGroups) {
    appointments[group.status] = group._count.id;
  }

  res.json({ doctors: doctorCount, patients: patientCount, appointments });
});

// ── POST /admin/trigger-reminders ─────────────────────────────────────
router.post('/trigger-reminders', async (_req, res) => {
  // 1. Set all active medication reminders scheduledTime to now (so they are due)
  await prisma.medicationReminder.updateMany({
    where: { active: true },
    data: { scheduledTime: new Date() },
  });

  // 2. Trigger both cron queues immediately
  const appointmentReminderQueue = new Queue('appointment-reminder', { connection });
  const medicationReminderQueue = new Queue('medication-reminder', { connection });

  await appointmentReminderQueue.add('check-reminders', {});
  await medicationReminderQueue.add('check-medications', {});

  await appointmentReminderQueue.close();
  await medicationReminderQueue.close();

  res.json({ message: 'Reminders triggered successfully' });
});

// ── GET /admin/doctors ─────────────────────────────────────────────────────
router.get('/doctors', async (_req, res) => {
  const doctors = await prisma.doctorProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      leaves: { orderBy: { date: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(doctors);
});

// ── POST /admin/doctors ────────────────────────────────────────────────────
router.post('/doctors', async (req: AuthenticatedRequest, res) => {
  const body = createDoctorSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new AppError(409, 'Email already registered', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: Role.DOCTOR,
      phone: body.phone,
      doctorProfile: {
        create: {
          specialisation: body.specialisation,
          workingHoursStart: body.workingHoursStart,
          workingHoursEnd: body.workingHoursEnd,
          slotDurationMinutes: body.slotDurationMinutes,
          workingDays: body.workingDays,
        },
      },
    },
    include: { doctorProfile: true },
  });

  res.status(201).json(user);

  // Send credentials email to the new doctor (non-blocking — fires after response)
  sendDirectEmail({
    to: body.email,
    type: 'DOCTOR_CREDENTIALS',
    payload: {
      name: body.name,
      email: body.email,
      password: body.password,
      specialisation: body.specialisation,
      workingHoursStart: body.workingHoursStart,
      workingHoursEnd: body.workingHoursEnd,
      slotDurationMinutes: body.slotDurationMinutes ?? 30,
    },
  });
});


// ── PATCH /admin/doctors/:id ───────────────────────────────────────────────
router.patch('/doctors/:id', async (req, res) => {
  const body = updateDoctorSchema.parse(req.body);
  const { name, specialisation, ...profileFields } = body;

  const profile = await prisma.doctorProfile.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!profile) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

  const [updatedProfile] = await prisma.$transaction([
    prisma.doctorProfile.update({
      where: { id: req.params.id },
      data: { ...(specialisation && { specialisation }), ...profileFields },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    ...(name
      ? [prisma.user.update({ where: { id: profile.userId }, data: { name } })]
      : []),
  ]);

  res.json(updatedProfile);
});

// ── DELETE /admin/doctors/:id ──────────────────────────────────────────────
router.delete('/doctors/:id', async (req, res) => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!profile) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

  // Delete user (cascades to doctorProfile, appointments, etc. via Prisma)
  await prisma.user.delete({ where: { id: profile.userId } });
  res.json({ message: 'Doctor deleted' });
});

// ── POST /admin/doctors/:id/leave ──────────────────────────────────────────
router.post('/doctors/:id/leave', async (req: AuthenticatedRequest, res) => {
  const body = leaveSchema.parse(req.body);
  const doctorId = req.params.id as string;

  const profile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
  });
  if (!profile) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

  const leaveDate = new Date(body.date);
  const dayStart = new Date(leaveDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(leaveDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Run everything in one transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create leave row (will throw if already exists due to @@unique)
    const leave = await tx.doctorLeave.create({
      data: { doctorId, date: leaveDate, reason: body.reason },
    });

    // 2. Find all affected appointments
    const affected = await tx.appointment.findMany({
      where: {
        doctorId,
        slotStart: { gte: dayStart, lte: dayEnd },
        status: { in: [AppointmentStatus.HELD, AppointmentStatus.CONFIRMED] },
      },
      include: {
        patient: { select: { id: true, email: true, name: true } },
        doctor: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });

    // 3. Cancel each appointment and enqueue notifications
    for (const appt of affected) {
      await tx.appointment.update({
        where: { id: appt.id },
        data: { status: AppointmentStatus.CANCELLED },
      });

      // Enqueue LEAVE_CONFLICT email to patient
      await tx.notification.create({
        data: {
          userId: appt.patientId,
          appointmentId: appt.id,
          channel: 'EMAIL',
          type: 'LEAVE_CONFLICT',
          payload: {
            patientName: appt.patient.name,
            patientEmail: appt.patient.email,
            doctorName: appt.doctor.user.name,
            slotStart: appt.slotStart.toISOString(),
            leaveDate: body.date,
            reason: body.reason ?? null,
          } as any,
          scheduledFor: new Date(),
        },
      });

      // Delete Google Calendar events (outside transaction — graceful failure)
      setImmediate(async () => {
        try {
          if (appt.googleEventIdPatient)
            await deleteCalendarEvent(appt.patientId, appt.googleEventIdPatient);
          if (appt.googleEventIdDoctor)
            await deleteCalendarEvent(appt.doctor.userId, appt.googleEventIdDoctor);
        } catch (e) {
          console.error('[Calendar] Failed to delete events on leave:', e);
        }
      });
    }

    return { leave, cancelledCount: affected.length };
  });

  // Trigger email worker (outside transaction)
  await enqueueEmail();

  res.status(201).json({
    leave: result.leave,
    cancelledAppointments: result.cancelledCount,
  });
});

// ── DELETE /admin/doctors/:id/leave/:leaveId ───────────────────────────────
router.delete('/doctors/:id/leave/:leaveId', async (req, res) => {
  const leave = await prisma.doctorLeave.findFirst({
    where: { id: req.params.leaveId, doctorId: req.params.id },
  });
  if (!leave) throw new AppError(404, 'Leave record not found', 'LEAVE_NOT_FOUND');

  await prisma.doctorLeave.delete({ where: { id: req.params.leaveId } });
  res.json({ message: 'Leave cancelled' });
});

export default router;
