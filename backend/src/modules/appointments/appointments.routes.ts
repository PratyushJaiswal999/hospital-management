import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { verifyToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { Role, AppointmentStatus, Prisma } from '@prisma/client';
import { holdExpiryQueue, llmRetryQueue } from '../../jobs/queues';
import { createAndEnqueueNotification } from '../notifications/email.service';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  createMedicationCalendarEvents,
} from '../calendar/calendar.service';
import { generatePreVisitSummary, generatePostVisitSummary } from '../llm/llm.service';
import { generateMedicationReminders, PrescriptionItem } from '../medications/medications.service';

const router = Router();
router.use(verifyToken);

const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ── Schemas ────────────────────────────────────────────────────────────────
const holdSchema = z.object({
  doctorId: z.string().uuid(),
  slotStart: z.string().datetime(),
  idempotencyKey: z.string().optional(),
});

const confirmSchema = z.object({
  symptomText: z.string().min(10),
});

const rescheduleSchema = z.object({
  newSlotStart: z.string().datetime(),
});

const notesSchema = z.object({
  doctorNotes: z.string().min(5),
  prescription: z
    .array(
      z.object({
        drug: z.string(),
        dose: z.string(),
        frequency: z.string(),
        durationDays: z.number().int().positive(),
      }),
    )
    .default([]),
});

// ── Helper: get appointment or throw ──────────────────────────────────────
async function getAppointment(id: string) {
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      medicationReminders: true,
    },
  });
  if (!appt) throw new AppError(404, 'Appointment not found', 'APPT_NOT_FOUND');
  return appt;
}

// ── POST /appointments/hold ────────────────────────────────────────────────
/**
 * CRITICAL — Double-booking prevention:
 * 1. Uses DB transaction with SERIALIZABLE isolation
 * 2. SELECT ... FOR UPDATE on any existing booking for the slot
 * 3. Unique partial index on (doctorId, slotStart) WHERE status IN (HELD, CONFIRMED)
 *    enforced at DB level (see migration SQL)
 * 4. Idempotency key prevents duplicate network retries
 */
router.post(
  '/hold',
  requireRole(Role.PATIENT),
  async (req: AuthenticatedRequest, res) => {
    const body = holdSchema.parse(req.body);
    const patientId = req.user!.id;
    const idempotencyKey = body.idempotencyKey ?? undefined;

    // Check idempotency: if this key was already used, return existing appointment
    if (idempotencyKey) {
      const existing = await prisma.appointment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        res.json({ appointment: existing, message: 'Idempotent response' });
        return;
      }
    }

    const slotStart = new Date(body.slotStart);
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);

    // Verify doctor exists and compute slotEnd
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: body.doctorId } });
    if (!doctor) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

    const slotEnd = new Date(slotStart.getTime() + doctor.slotDurationMinutes * 60 * 1000);

    // Transaction with SERIALIZABLE isolation + row lock
    let appointment;
    try {
      appointment = await prisma.$transaction(
        async (tx) => {
          // Lock any existing booking for this doctor/slot to serialize concurrent requests
          const existing = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Appointment"
            WHERE "doctorId" = ${body.doctorId}
              AND "slotStart" = ${slotStart}::timestamptz
              AND status IN ('HELD', 'CONFIRMED')
            LIMIT 1
            FOR UPDATE
          `;

          if (existing.length > 0) {
            throw new AppError(
              409,
              'Slot no longer available — please pick another time',
              'SLOT_CONFLICT',
            );
          }

          return tx.appointment.create({
            data: {
              patientId,
              doctorId: body.doctorId,
              slotStart,
              slotEnd,
              status: AppointmentStatus.HELD,
              holdExpiresAt,
              ...(idempotencyKey && { idempotencyKey }),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Prisma unique constraint = race condition caught at DB level
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        throw new AppError(409, 'Slot no longer available — please pick another time', 'SLOT_CONFLICT');
      }
      throw err;
    }

    // Schedule hold-expiry job
    await holdExpiryQueue.add(
      'expire-hold',
      { appointmentId: appointment.id },
      { delay: HOLD_DURATION_MS },
    );

    res.status(201).json({ appointment, holdExpiresAt });
  },
);

// ── POST /appointments/:id/confirm ─────────────────────────────────────────
router.post(
  '/:id/confirm',
  requireRole(Role.PATIENT),
  async (req: AuthenticatedRequest, res) => {
    const body = confirmSchema.parse(req.body);
    const appt = await getAppointment(req.params.id as string);

    if (appt.patientId !== req.user!.id)
      throw new AppError(403, 'Not your appointment', 'FORBIDDEN');
    if (appt.status !== AppointmentStatus.HELD)
      throw new AppError(400, 'Appointment is not in HELD status', 'INVALID_STATUS');
    if (appt.holdExpiresAt && appt.holdExpiresAt < new Date())
      throw new AppError(400, 'Hold has expired — please select a new slot', 'HOLD_EXPIRED');

    // Flip to CONFIRMED (row lock to prevent double-confirm)
    const confirmed = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Appointment" WHERE id = ${appt.id} FOR UPDATE
      `;
      if (locked[0]?.status !== 'HELD') {
        throw new AppError(409, 'Appointment status changed — please try again', 'STATUS_CHANGED');
      }

      return tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: AppointmentStatus.CONFIRMED,
          symptomText: body.symptomText,
          holdExpiresAt: null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // ── Async side-effects (don't block response) ──────────────────────
    setImmediate(async () => {
      try {
        // 1. Generate pre-visit LLM summary
        const preVisitSummary = await generatePreVisitSummary(body.symptomText);
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { preVisitSummary: preVisitSummary as any },
        });

        // If generation failed, queue retry
        if (preVisitSummary.generationFailed) {
          await llmRetryQueue.add('retry-pre-visit', { appointmentId: appt.id, type: 'pre-visit' }, { delay: 60000 });
        }
      } catch (e) {
        console.error('[LLM] Pre-visit generation failed:', e);
      }

      try {
        // 2. Send booking confirmation emails (patient + doctor)
        await createAndEnqueueNotification({
          userId: appt.patientId,
          appointmentId: appt.id,
          type: 'BOOKING_CONFIRM',
          payload: {
            recipientName: appt.patient.name,
            doctorName: appt.doctor.user.name,
            slotStart: appt.slotStart,
            durationMinutes: appt.doctor.slotDurationMinutes,
          },
        });

        await createAndEnqueueNotification({
          userId: appt.doctor.user.id,
          appointmentId: appt.id,
          type: 'BOOKING_CONFIRM',
          payload: {
            recipientName: appt.doctor.user.name,
            doctorName: appt.doctor.user.name,
            patientName: appt.patient.name,
            slotStart: appt.slotStart,
            durationMinutes: appt.doctor.slotDurationMinutes,
          },
        });
      } catch (e) {
        console.error('[Email] Booking confirm enqueue failed:', e);
      }

      try {
        // 3. Create Google Calendar events (patient + doctor)
        const [eventIdPatient, eventIdDoctor] = await Promise.all([
          createCalendarEvent(appt.patientId, {
            summary: `Appointment with ${appt.doctor.user.name}`,
            description: `Healthcare appointment\nSymptoms: ${body.symptomText}`,
            startTime: appt.slotStart,
            endTime: appt.slotEnd,
          }),
          createCalendarEvent(appt.doctor.user.id, {
            summary: `Patient: ${appt.patient.name}`,
            description: `Healthcare appointment with patient ${appt.patient.name}`,
            startTime: appt.slotStart,
            endTime: appt.slotEnd,
          }),
        ]);

        if (eventIdPatient || eventIdDoctor) {
          await prisma.appointment.update({
            where: { id: appt.id },
            data: {
              ...(eventIdPatient && { googleEventIdPatient: eventIdPatient }),
              ...(eventIdDoctor && { googleEventIdDoctor: eventIdDoctor }),
            },
          });
        }
      } catch (e) {
        console.error('[Calendar] Event creation failed:', e);
      }
    });

    res.json({ appointment: confirmed });
  },
);

// ── POST /appointments/:id/cancel ──────────────────────────────────────────
router.post('/:id/cancel', async (req: AuthenticatedRequest, res) => {
  const appt = await getAppointment(req.params.id as string);

  // Patient can cancel their own, doctor/admin can cancel any
  const isPatient = req.user!.role === Role.PATIENT && appt.patientId === req.user!.id;
  const isDoctorOrAdmin =
    req.user!.role === Role.DOCTOR || req.user!.role === Role.ADMIN;
  if (!isPatient && !isDoctorOrAdmin) throw new AppError(403, 'Forbidden', 'FORBIDDEN');

  if (!(['HELD', 'CONFIRMED'] as string[]).includes(appt.status)) {
    throw new AppError(400, 'Cannot cancel an appointment with status: ' + appt.status, 'INVALID_STATUS');
  }

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: AppointmentStatus.CANCELLED },
  });

  // Async: delete calendar events + send cancellation emails to both parties
  setImmediate(async () => {
    try {
      if (appt.googleEventIdPatient)
        await deleteCalendarEvent(appt.patientId, appt.googleEventIdPatient);
      if (appt.googleEventIdDoctor)
        await deleteCalendarEvent(appt.doctor.user.id, appt.googleEventIdDoctor);
    } catch (e) {
      console.error('[Calendar] Delete on cancel failed:', e);
    }

    try {
      // Notify patient
      await createAndEnqueueNotification({
        userId: appt.patientId,
        appointmentId: appt.id,
        type: 'CANCELLATION',
        payload: {
          recipientName: appt.patient.name,
          doctorName: appt.doctor.user.name,
          slotStart: appt.slotStart,
        },
      });
      // Notify doctor
      await createAndEnqueueNotification({
        userId: appt.doctor.user.id,
        appointmentId: appt.id,
        type: 'CANCELLATION',
        payload: {
          recipientName: appt.doctor.user.name,
          doctorName: appt.doctor.user.name,
          patientName: appt.patient.name,
          slotStart: appt.slotStart,
        },
      });
    } catch (e) {
      console.error('[Email] Cancellation email failed:', e);
    }
  });

  res.json({ message: 'Appointment cancelled' });
});

// ── POST /appointments/:id/reschedule ──────────────────────────────────────
router.post(
  '/:id/reschedule',
  requireRole(Role.PATIENT),
  async (req: AuthenticatedRequest, res) => {
    const body = rescheduleSchema.parse(req.body);
    const appt = await getAppointment(req.params.id as string);

    if (appt.patientId !== req.user!.id) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    if (appt.status !== AppointmentStatus.CONFIRMED)
      throw new AppError(400, 'Can only reschedule CONFIRMED appointments', 'INVALID_STATUS');

    const newSlotStart = new Date(body.newSlotStart);
    const newSlotEnd = new Date(
      newSlotStart.getTime() + appt.doctor.slotDurationMinutes * 60 * 1000,
    );

    // Check new slot availability (row lock)
    const updated = await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Appointment"
          WHERE "doctorId" = ${appt.doctorId}
            AND "slotStart" = ${newSlotStart}::timestamptz
            AND status IN ('HELD', 'CONFIRMED')
            AND id != ${appt.id}
          LIMIT 1
          FOR UPDATE
        `;

        if (conflict.length > 0) {
          throw new AppError(409, 'New slot is not available', 'SLOT_CONFLICT');
        }

        return tx.appointment.update({
          where: { id: appt.id },
          data: {
            slotStart: newSlotStart,
            slotEnd: newSlotEnd,
            // Reset to CONFIRMED so the doctor can still complete the appointment
            status: AppointmentStatus.CONFIRMED,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Async: update calendar events
    setImmediate(async () => {
      try {
        if (appt.googleEventIdPatient)
          await updateCalendarEvent(appt.patientId, appt.googleEventIdPatient, newSlotStart, newSlotEnd);
        if (appt.googleEventIdDoctor)
          await updateCalendarEvent(appt.doctor.user.id, appt.googleEventIdDoctor, newSlotStart, newSlotEnd);
      } catch (e) {
        console.error('[Calendar] Update on reschedule failed:', e);
      }
    });

    res.json({ appointment: updated });
  },
);

// ── GET /appointments/mine ─────────────────────────────────────────────────
router.get('/mine', requireRole(Role.PATIENT), async (req: AuthenticatedRequest, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { patientId: req.user!.id },
    include: {
      doctor: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { slotStart: 'desc' },
  });
  res.json(appointments);
});

// ── GET /appointments/doctor-view ──────────────────────────────────────────
router.get(
  '/doctor-view',
  requireRole(Role.DOCTOR),
  async (req: AuthenticatedRequest, res) => {
    const { date } = req.query as { date?: string };

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!doctorProfile) throw new AppError(404, 'Doctor profile not found', 'PROFILE_NOT_FOUND');

    const where: Prisma.AppointmentWhereInput = { doctorId: doctorProfile.id };

    if (date) {
      const day = new Date(date);
      const dayStart = new Date(day); dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(day); dayEnd.setUTCHours(23, 59, 59, 999);
      where.slotStart = { gte: dayStart, lte: dayEnd };
    } else {
      // Default: today
      const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);
      where.slotStart = { gte: todayStart, lte: todayEnd };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { slotStart: 'asc' },
    });

    res.json(appointments);
  },
);

// ── GET /appointments/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const appt = await getAppointment(req.params.id as string);

  // Patient can only see their own
  if (
    req.user!.role === Role.PATIENT &&
    appt.patientId !== req.user!.id
  ) {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  }

  res.json(appt);
});

// ── POST /appointments/:id/notes ───────────────────────────────────────────
router.post(
  '/:id/notes',
  requireRole(Role.DOCTOR),
  async (req: AuthenticatedRequest, res) => {
    const body = notesSchema.parse(req.body);
    const appt = await getAppointment(req.params.id as string);

    // Verify doctor owns this appointment
    if (appt.doctor.user.id !== req.user!.id)
      throw new AppError(403, 'Not your appointment', 'FORBIDDEN');
    if (appt.status !== AppointmentStatus.CONFIRMED && appt.status !== AppointmentStatus.RESCHEDULED)
      throw new AppError(400, 'Appointment must be CONFIRMED to add notes', 'INVALID_STATUS');

    // Mark as COMPLETED immediately (don't wait for LLM)
    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: AppointmentStatus.COMPLETED,
        doctorNotes: body.doctorNotes,
        prescription: body.prescription,
      },
    });

    // Generate medication reminders (DB rows for email worker)
    if (body.prescription.length > 0) {
      await generateMedicationReminders(appt.id, appt.patientId, body.prescription as PrescriptionItem[]);

      // Create Google Calendar recurring events for each medication dose
      setImmediate(async () => {
        try {
          await createMedicationCalendarEvents(appt.patientId, body.prescription as PrescriptionItem[]);
        } catch (e) {
          console.error('[Calendar] Medication events creation failed:', e);
        }
      });
    }

    // Async: LLM post-visit summary
    setImmediate(async () => {
      try {
        const postVisitSummary = await generatePostVisitSummary(
          body.doctorNotes,
          body.prescription as PrescriptionItem[],
        );
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { postVisitSummary },
        });

        // Send post-visit summary email to patient
        await createAndEnqueueNotification({
          userId: appt.patientId,
          appointmentId: appt.id,
          type: 'BOOKING_CONFIRM', // reuse type — payload carries summary
          payload: {
            recipientName: appt.patient.name,
            doctorName: appt.doctor.user.name,
            slotStart: appt.slotStart,
            durationMinutes: appt.doctor.slotDurationMinutes,
            postVisitSummary,
          },
        });
      } catch (e) {
        console.error('[LLM] Post-visit generation failed:', e);
        // Queue retry
        await llmRetryQueue.add(
          'retry-post-visit',
          { appointmentId: appt.id, type: 'post-visit' },
          { delay: 60000 },
        );
      }
    });

    res.json({ appointment: updated, message: 'Notes saved. Post-visit summary being generated.' });
  },
);

export default router;
