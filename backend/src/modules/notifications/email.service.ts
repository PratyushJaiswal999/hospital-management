import nodemailer, { Transporter } from 'nodemailer';
import prisma from '../../lib/prisma';
import { NotificationStatus } from '@prisma/client';
import { emailQueue } from '../../jobs/queues';

let _transporter: Transporter | null = null;

// ── Get or create Nodemailer transporter ───────────────────────────────────
async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  // If SMTP credentials are provided in env, use them (Gmail or any SMTP)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[Email] Using configured SMTP server:', process.env.SMTP_HOST);
  } else {
    // Auto-create Ethereal test account (local dev fallback)
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log(`[Email] Using Ethereal test account: ${testAccount.user}`);
    console.log(`[Email] Preview URL will appear after each email send`);
  }

  return _transporter;
}

// ── Shared HTML wrapper ────────────────────────────────────────────────────
function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Healthcare App</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
            <span style="display:inline-block;background:#024ad8;color:#fff;font-size:22px;font-weight:700;padding:8px 18px;border-radius:6px;">+ HealthCare</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;color:#1a1a1a;font-size:15px;line-height:1.7;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7f7f7;padding:20px 40px;text-align:center;font-size:12px;color:#888;border-top:1px solid #e8e8e8;">
            <p style="margin:0;">Healthcare Appointment Manager &nbsp;|&nbsp; <a href="${process.env.FRONTEND_URL}" style="color:#024ad8;text-decoration:none;">Open App</a></p>
            <p style="margin:6px 0 0;">This is an automated notification. Please do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Build email HTML for each notification type ────────────────────────────
function buildEmailContent(
  type: string,
  payload: Record<string, unknown>,
): { subject: string; html: string } {
  switch (type) {

    case 'WELCOME_PATIENT':
      return {
        subject: `👋 Welcome to HealthCare, ${payload.name}!`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Welcome, ${payload.name}! 🎉</h2>
          <p>Your patient account has been created successfully. You can now book appointments with our doctors.</p>
          <div style="background:#f0f6ff;border-left:4px solid #024ad8;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 6px;"><strong>Your Login Details</strong></p>
            <p style="margin:0;">📧 Email: <strong>${payload.email}</strong></p>
          </div>
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/login"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Log In to Your Account →
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Search for doctors by specialisation, book a slot, and describe your symptoms — your doctor will receive an AI-generated pre-visit summary.</p>
        `),
      };

    case 'DOCTOR_CREDENTIALS':
      return {
        subject: `🏥 Your Doctor Account Has Been Created`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Hello, Dr. ${payload.name}!</h2>
          <p>Your doctor account has been set up by the clinic administrator. Here are your login credentials:</p>
          <div style="background:#f0f6ff;border-left:4px solid #024ad8;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 8px;"><strong>Your Login Credentials</strong></p>
            <p style="margin:0 0 4px;">📧 Email: <strong>${payload.email}</strong></p>
            <p style="margin:0 0 4px;">🔑 Temporary Password: <strong style="font-family:monospace;background:#e8e8e8;padding:2px 6px;border-radius:4px;">${payload.password}</strong></p>
          </div>
          <div style="background:#fff8e6;border-left:4px solid #d97706;padding:12px 16px;border-radius:6px;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;color:#92400e;">⚠️ Please change your password after your first login for security.</p>
          </div>
          <div style="background:#f7f7f7;padding:16px 20px;border-radius:6px;margin:0 0 20px;">
            <p style="margin:0 0 6px;font-weight:600;">Your Profile</p>
            <p style="margin:0 0 4px;font-size:14px;">🩺 Specialisation: <strong>${payload.specialisation}</strong></p>
            <p style="margin:0 0 4px;font-size:14px;">⏰ Working Hours: <strong>${payload.workingHoursStart} – ${payload.workingHoursEnd}</strong></p>
            <p style="margin:0;font-size:14px;">📅 Slot Duration: <strong>${payload.slotDurationMinutes} minutes</strong></p>
          </div>
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/login"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Log In Now →
            </a>
          </p>
        `),
      };

    case 'BOOKING_CONFIRM':
      return {
        subject: `✅ Appointment Confirmed — ${payload.doctorName}`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Appointment Confirmed ✅</h2>
          <p>Dear <strong>${payload.recipientName}</strong>,</p>
          <p>Your appointment has been successfully confirmed.</p>
          <div style="background:#f0f6ff;border-left:4px solid #024ad8;padding:16px 20px;border-radius:6px;margin:20px 0;">
            ${payload.patientName ? `<p style="margin:0 0 6px;">👤 Patient: <strong>${payload.patientName}</strong></p>` : ''}
            <p style="margin:0 0 6px;">👨‍⚕️ Doctor: <strong>${payload.doctorName}</strong></p>
            <p style="margin:0 0 6px;">📅 Date &amp; Time: <strong>${new Date(payload.slotStart as string).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>
            <p style="margin:0;">⏱ Duration: <strong>${payload.durationMinutes} minutes</strong></p>
          </div>
          <p style="color:#666;font-size:13px;">A Google Calendar event has been added to your calendar (if you have connected your Google account).</p>
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/patient/appointments"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              View Appointment →
            </a>
          </p>
        `),
      };

    case 'REMINDER':
      return {
        subject: `⏰ Reminder: Appointment Tomorrow with ${payload.doctorName}`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Upcoming Appointment Reminder ⏰</h2>
          <p>Dear <strong>${payload.patientName}</strong>,</p>
          <p>This is a reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
          <div style="background:#f0f6ff;border-left:4px solid #024ad8;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 6px;">👨‍⚕️ Doctor: <strong>${payload.doctorName}</strong></p>
            <p style="margin:0;">📅 Date &amp; Time: <strong>${new Date(payload.slotStart as string).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>
          </div>
          <p style="color:#666;font-size:13px;">Please arrive a few minutes early. If you need to cancel or reschedule, you can do so from the app.</p>
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/patient/appointments"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              View Appointment →
            </a>
          </p>
        `),
      };

    case 'CANCELLATION':
      return {
        subject: `❌ Appointment Cancelled`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Appointment Cancelled ❌</h2>
          <p>Dear <strong>${payload.recipientName}</strong>,</p>
          <p>The following appointment has been cancelled${payload.patientName ? ` by the patient` : ''}:</p>
          <div style="background:#fff0f0;border-left:4px solid #b3262b;padding:16px 20px;border-radius:6px;margin:20px 0;">
            ${payload.patientName ? `<p style="margin:0 0 6px;">👤 Patient: <strong>${payload.patientName}</strong></p>` : ''}
            <p style="margin:0 0 6px;">👨‍⚕️ Doctor: <strong>${payload.doctorName}</strong></p>
            <p style="margin:0;">📅 Was Scheduled: <strong>${new Date(payload.slotStart as string).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>
          </div>
          <p>Any Google Calendar events have been automatically removed.</p>
          ${!payload.patientName ? `
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/patient/search"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Book a New Appointment →
            </a>
          </p>` : ''}
        `),
      };

    case 'LEAVE_CONFLICT':
      return {
        subject: `⚠️ Appointment Cancelled — Doctor on Leave`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Appointment Cancelled ⚠️</h2>
          <p>Dear <strong>${payload.patientName}</strong>,</p>
          <p>We regret to inform you that your appointment has been cancelled because your doctor is on leave.</p>
          <div style="background:#fff8e6;border-left:4px solid #d97706;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 6px;">👨‍⚕️ Doctor: <strong>${payload.doctorName}</strong></p>
            <p style="margin:0 0 6px;">📅 Was Scheduled: <strong>${new Date(payload.slotStart as string).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>
            <p style="margin:0 0 6px;">🗓 Leave Date: <strong>${payload.leaveDate}</strong></p>
            ${payload.reason ? `<p style="margin:0;">📝 Reason: ${payload.reason}</p>` : ''}
          </div>
          <p>We apologise for the inconvenience. Please book a new appointment with another available doctor.</p>
          <p style="margin:20px 0;">
            <a href="${process.env.FRONTEND_URL}/patient/search"
               style="display:inline-block;background:#024ad8;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Find Another Doctor →
            </a>
          </p>
        `),
      };

    case 'MEDICATION_REMINDER':
      return {
        subject: `💊 Medication Reminder — ${payload.drug}`,
        html: wrapHtml(`
          <h2 style="margin:0 0 16px;font-size:24px;color:#1a1a1a;">Time to Take Your Medication 💊</h2>
          <p>Dear <strong>${payload.patientName}</strong>,</p>
          <p>This is a reminder to take your prescribed medication:</p>
          <div style="background:#f0f6ff;border-left:4px solid #024ad8;padding:16px 20px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 6px;">💊 Drug: <strong>${payload.drug}</strong></p>
            <p style="margin:0 0 6px;">📏 Dose: <strong>${payload.dose}</strong></p>
            <p style="margin:0;">⏰ Time: <strong>${new Date(payload.scheduledTime as string).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></p>
          </div>
          <p style="color:#666;font-size:13px;">Take your medication with water as prescribed by your doctor. Contact your doctor if you experience any side effects.</p>
        `),
      };

    default:
      return {
        subject: 'Healthcare App Notification',
        html: wrapHtml(`<pre style="background:#f7f7f7;padding:16px;border-radius:6px;overflow:auto;">${JSON.stringify(payload, null, 2)}</pre>`),
      };
  }
}

// ── Send a single notification ─────────────────────────────────────────────
export async function sendNotification(notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!notification) throw new Error(`Notification ${notificationId} not found`);

  const transporter = await getTransporter();
  const payload = notification.payload as Record<string, unknown>;
  const { subject, html } = buildEmailContent(notification.type, payload);

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"HealthCare App" <no-reply@healthcare.local>',
    to: notification.user.email,
    subject,
    html,
  });

  // Log Ethereal preview URL (only in test/dev mode)
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[Email] Preview: ${previewUrl}`);
  } else {
    console.log(`[Email] Sent to ${notification.user.email}: ${subject}`);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { status: NotificationStatus.SENT, sentAt: new Date(), attempts: { increment: 1 } },
  });
}

// ── Send a direct transactional email (no DB row needed) ───────────────────
// Used for welcome/credentials emails that don't need retry tracking
export async function sendDirectEmail(opts: {
  to: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const transporter = await getTransporter();
    const { subject, html } = buildEmailContent(opts.type, opts.payload);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"HealthCare App" <no-reply@healthcare.local>',
      to: opts.to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email] Preview (${opts.type}): ${previewUrl}`);
    } else {
      console.log(`[Email] Sent (${opts.type}) to ${opts.to}`);
    }
  } catch (err) {
    // Never block the main flow for a welcome email failure
    console.error(`[Email] Direct send failed for ${opts.type}:`, err);
  }
}

// ── Enqueue email: trigger the BullMQ email queue ─────────────────────────
export async function enqueueEmail(notificationId?: string): Promise<void> {
  if (notificationId) {
    await emailQueue.add('send-email', { notificationId }, { attempts: 5 });
  } else {
    // Signal the queue to pick up all pending notifications
    await emailQueue.add('send-pending', {}, { attempts: 1 });
  }
}

// ── Create a notification row and enqueue it ───────────────────────────────
export async function createAndEnqueueNotification(data: {
  userId: string;
  appointmentId?: string;
  type: string;
  payload: Record<string, unknown>;
  scheduledFor?: Date;
}): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      appointmentId: data.appointmentId,
      channel: 'EMAIL',
      type: data.type as any,
      payload: data.payload as any,
      scheduledFor: data.scheduledFor ?? new Date(),
    },
  });
  await enqueueEmail(notification.id);
}
