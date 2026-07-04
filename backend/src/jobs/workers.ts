import { Worker, Job } from 'bullmq';
import prisma from '../lib/prisma';
import { sendNotification } from '../modules/notifications/email.service';
import { generatePreVisitSummary, generatePostVisitSummary } from '../modules/llm/llm.service';
import { AppointmentStatus, NotificationStatus } from '@prisma/client';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ...(process.env.REDIS_TLS === 'true' && { tls: {} }),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

// ── 1. Hold-Expiry Worker ─────────────────────────────────────────────────
function startHoldExpiryWorker() {
  const worker = new Worker(
    'hold-expiry',
    async (job: Job) => {
      const { appointmentId } = job.data as { appointmentId: string };

      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appt || appt.status !== AppointmentStatus.HELD) return; // Already confirmed or cancelled

      // Check if hold actually expired
      if (appt.holdExpiresAt && appt.holdExpiresAt > new Date()) return;

      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CANCELLED },
      });

      console.log(`[HoldExpiry] Released expired hold: ${appointmentId}`);
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[HoldExpiry] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── 2. Email Worker ───────────────────────────────────────────────────────
function startEmailWorker() {
  const worker = new Worker(
    'email',
    async (job: Job) => {
      const { notificationId } = job.data as { notificationId?: string };

      if (notificationId) {
        // Send specific notification
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: NotificationStatus.RETRYING, attempts: { increment: 1 } },
        });

        try {
          await sendNotification(notificationId);
        } catch (err) {
          const notification = await prisma.notification.findUnique({
            where: { id: notificationId },
          });
          const attempts = (notification?.attempts ?? 0);

          if (attempts >= 5) {
            await prisma.notification.update({
              where: { id: notificationId },
              data: {
                status: NotificationStatus.FAILED,
                lastError: (err as Error).message,
              },
            });
            console.error(`[Email] Notification ${notificationId} permanently failed after ${attempts} attempts`);
          } else {
            await prisma.notification.update({
              where: { id: notificationId },
              data: {
                status: NotificationStatus.RETRYING,
                lastError: (err as Error).message,
              },
            });
            // Re-throw so BullMQ handles exponential backoff
            throw err;
          }
        }
      } else {
        // Pick up all pending notifications
        const pending = await prisma.notification.findMany({
          where: {
            status: { in: [NotificationStatus.PENDING, NotificationStatus.RETRYING] },
            scheduledFor: { lte: new Date() },
          },
          take: 50,
          orderBy: { scheduledFor: 'asc' },
        });

        for (const n of pending) {
          try {
            await sendNotification(n.id);
          } catch (err) {
            console.error(`[Email] Failed for notification ${n.id}:`, err);
          }
        }
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Email] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── 3. Appointment Reminder Worker (cron) ─────────────────────────────────
function startAppointmentReminderWorker() {
  const worker = new Worker(
    'appointment-reminder',
    async (_job: Job) => {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in24hPlus30 = new Date(in24h.getTime() + 30 * 60 * 1000);

      // Find appointments in ~24 hours
      const upcoming = await prisma.appointment.findMany({
        where: {
          status: AppointmentStatus.CONFIRMED,
          slotStart: { gte: in24h, lte: in24hPlus30 },
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      });

      for (const appt of upcoming) {
        // Check if reminder already sent
        const existing = await prisma.notification.findFirst({
          where: {
            appointmentId: appt.id,
            type: 'REMINDER',
            status: { in: [NotificationStatus.SENT, NotificationStatus.PENDING, NotificationStatus.RETRYING] },
          },
        });
        if (existing) continue;

        await prisma.notification.create({
          data: {
            userId: appt.patientId,
            appointmentId: appt.id,
            channel: 'EMAIL',
            type: 'REMINDER',
            payload: {
              patientName: appt.patient.name,
              doctorName: appt.doctor.user.name,
              slotStart: appt.slotStart,
            },
            scheduledFor: new Date(),
          },
        });
      }

      if (upcoming.length > 0) {
        console.log(`[AppointmentReminder] Queued reminders for ${upcoming.length} appointments`);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[AppointmentReminder] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── 4. Medication Reminder Worker (cron) ──────────────────────────────────
function startMedicationReminderWorker() {
  const worker = new Worker(
    'medication-reminder',
    async (_job: Job) => {
      const dueReminders = await prisma.medicationReminder.findMany({
        where: {
          active: true,
          scheduledTime: { lte: new Date() },
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
        },
        take: 100,
      });

      for (const reminder of dueReminders) {
        try {
          // Enqueue email notification
          await prisma.notification.create({
            data: {
              userId: reminder.patientId,
              appointmentId: reminder.appointmentId,
              channel: 'EMAIL',
              type: 'MEDICATION_REMINDER',
              payload: {
                patientName: reminder.patient.name,
                drug: reminder.drug,
                dose: reminder.dose,
                scheduledTime: reminder.scheduledTime,
              },
              scheduledFor: new Date(),
            },
          });

          // Advance to next dose
          const nextRemainingDays = reminder.remainingDays - (1 / reminder.frequencyPerDay);
          const nextTime = new Date(reminder.scheduledTime);
          nextTime.setHours(nextTime.getHours() + Math.floor(24 / reminder.frequencyPerDay));

          await prisma.medicationReminder.update({
            where: { id: reminder.id },
            data: {
              remainingDays: Math.max(0, nextRemainingDays),
              scheduledTime: nextTime,
              active: nextRemainingDays > 0,
            },
          });
        } catch (err) {
          console.error(`[MedReminder] Failed for reminder ${reminder.id}:`, err);
        }
      }

      if (dueReminders.length > 0) {
        console.log(`[MedReminder] Processed ${dueReminders.length} medication reminders`);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[MedReminder] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── 5. LLM Retry Worker ───────────────────────────────────────────────────
function startLlmRetryWorker() {
  const worker = new Worker(
    'llm-retry',
    async (job: Job) => {
      const { appointmentId, type } = job.data as {
        appointmentId: string;
        type: 'pre-visit' | 'post-visit';
      };

      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appt) return;

      if (type === 'pre-visit' && appt.symptomText) {
        const summary = await generatePreVisitSummary(appt.symptomText);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { preVisitSummary: summary as any },
        });
        console.log(`[LLMRetry] Pre-visit summary regenerated for ${appointmentId}`);
      } else if (type === 'post-visit' && appt.doctorNotes) {
        const prescription = (appt.prescription as any[]) || [];
        const summary = await generatePostVisitSummary(appt.doctorNotes, prescription);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { postVisitSummary: summary },
        });
        console.log(`[LLMRetry] Post-visit summary regenerated for ${appointmentId}`);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[LLMRetry] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── Start all workers ─────────────────────────────────────────────────────
export function startWorkers() {
  const workers = [
    startHoldExpiryWorker(),
    startEmailWorker(),
    startAppointmentReminderWorker(),
    startMedicationReminderWorker(),
    startLlmRetryWorker(),
  ];

  console.log(`✅ ${workers.length} BullMQ workers started`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Workers] Shutting down gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  });

  return workers;
}
