import 'dotenv/config';
import { Queue } from 'bullmq';
import { startWorkers } from './src/jobs/workers';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ...(process.env.REDIS_TLS === 'true' && { tls: {} }),
};

console.log('⚙️  Starting BullMQ workers...');
startWorkers();

// ── Seed repeatable cron jobs ─────────────────────────────────────────────
// These fire the recurring workers on a schedule.
// Using "every" so they are idempotent — adding the same repeat key won't duplicate.

async function seedCronJobs() {
  const appointmentReminderQueue = new Queue('appointment-reminder', { connection });
  const medicationReminderQueue = new Queue('medication-reminder', { connection });

  // Check for upcoming appointments every hour and send 24h reminder emails
  await appointmentReminderQueue.add(
    'check-reminders',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // every hour
      jobId: 'appointment-reminder-cron', // idempotent key
    },
  );

  // Process due medication reminders every hour
  await medicationReminderQueue.add(
    'check-medications',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // every hour
      jobId: 'medication-reminder-cron', // idempotent key
    },
  );

  console.log('📅 Cron jobs seeded: appointment-reminder + medication-reminder (every hour)');
}

seedCronJobs().catch((err) => {
  console.error('[Worker] Failed to seed cron jobs:', err);
});

console.log('✅ Workers running. Press Ctrl+C to stop.');
