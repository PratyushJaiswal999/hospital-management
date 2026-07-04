import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  ...(process.env.REDIS_TLS === 'true' && { tls: {} }),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

// ── Queues ─────────────────────────────────────────────────────────────────

/** Releases expired HELD slots back to available */
export const holdExpiryQueue = new Queue('hold-expiry', { connection });

/** Sends email notifications (with retry) */
export const emailQueue = new Queue('email', { connection });

/** Scheduled 24h/1h pre-visit reminder emails */
export const appointmentReminderQueue = new Queue('appointment-reminder', { connection });

/** Daily medication dose reminder emails */
export const medicationReminderQueue = new Queue('medication-reminder', { connection });

/** Retries failed LLM generation jobs */
export const llmRetryQueue = new Queue('llm-retry', { connection });
