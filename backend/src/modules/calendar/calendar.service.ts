import { google } from 'googleapis';
import crypto from 'crypto';
import prisma from '../../lib/prisma';

// ── Encryption helpers (AES-256-CBC) ──────────────────────────────────────
const ALGO = 'aes-256-cbc';

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY || '0'.repeat(64);
  return Buffer.from(hex, 'hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data: string): string {
  const [ivHex, encHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── OAuth2 client factory ─────────────────────────────────────────────────
function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

// ── Generate auth URL ─────────────────────────────────────────────────────
export function getGoogleAuthUrl(userId: string): string {
  const oauth2Client = makeOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: userId, // pass userId through OAuth state param
    prompt: 'consent', // force refresh_token on every connect
  });
}

// ── Handle OAuth callback ─────────────────────────────────────────────────
export async function handleGoogleCallback(code: string, userId: string): Promise<void> {
  const oauth2Client = makeOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing tokens from Google OAuth');
  }

  await prisma.googleCalendarToken.upsert({
    where: { userId },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiryDate: new Date(tokens.expiry_date!),
    },
    create: {
      userId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiryDate: new Date(tokens.expiry_date!),
    },
  });
}

// ── Get authenticated OAuth2 client for a user ────────────────────────────
async function getAuthClient(userId: string) {
  const tokenRow = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!tokenRow) return null;

  const oauth2Client = makeOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(tokenRow.accessToken),
    refresh_token: decrypt(tokenRow.refreshToken),
    expiry_date: tokenRow.expiryDate.getTime(),
  });

  // Refresh tokens if needed
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await prisma.googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: encrypt(newTokens.access_token),
          ...(newTokens.refresh_token && {
            refreshToken: encrypt(newTokens.refresh_token),
          }),
          expiryDate: new Date(newTokens.expiry_date!),
        },
      });
    }
  });

  return oauth2Client;
}

// ── Create a calendar event ───────────────────────────────────────────────
export async function createCalendarEvent(
  userId: string,
  event: {
    summary: string;
    description: string;
    startTime: Date;
    endTime: Date;
    attendeeEmail?: string;
  },
): Promise<string | null> {
  try {
    const auth = await getAuthClient(userId);
    if (!auth) return null; // User hasn't connected Google Calendar

    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: event.endTime.toISOString(), timeZone: 'UTC' },
        ...(event.attendeeEmail && {
          attendees: [{ email: event.attendeeEmail }],
        }),
      },
    });

    return response.data.id ?? null;
  } catch (err) {
    console.error(`[Calendar] createCalendarEvent for ${userId} failed:`, err);
    return null;
  }
}

// ── Update a calendar event ───────────────────────────────────────────────
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  startTime: Date,
  endTime: Date,
): Promise<void> {
  try {
    const auth = await getAuthClient(userId);
    if (!auth) return;

    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
      },
    });
  } catch (err) {
    console.error(`[Calendar] updateCalendarEvent ${eventId} failed:`, err);
  }
}

// ── Delete a calendar event ───────────────────────────────────────────────
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  try {
    const auth = await getAuthClient(userId);
    if (!auth) return;

    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    // 410 Gone = already deleted, ignore
    if ((err as any)?.code !== 410) {
      console.error(`[Calendar] deleteCalendarEvent ${eventId} failed:`, err);
    }
  }
}

// ── Medication reminder calendar events ───────────────────────────────────
/**
 * For each prescribed medication, creates one recurring Google Calendar event
 * per daily dose using RRULE:FREQ=DAILY;COUNT=durationDays.
 * e.g. "Twice daily for 7 days" → 2 events, each repeating 7 times.
 * Silently skips if patient has not connected Google Calendar.
 */

interface MedPrescriptionItem {
  drug: string;
  dose: string;
  frequency: string;
  durationDays: number;
}

// Map frequency string → times per day
function freqToTimesPerDay(frequency: string): number {
  const lower = frequency.toLowerCase();
  if (lower.includes('once') || lower.includes('1')) return 1;
  if (lower.includes('twice') || lower.includes('2')) return 2;
  if (lower.includes('three') || lower.includes('3') || lower.includes('thrice')) return 3;
  if (lower.includes('four') || lower.includes('4')) return 4;
  return 1;
}

// UTC hours for each dose (morning / afternoon / evening / night)
const MED_DOSE_TIMES: Record<number, number[]> = {
  1: [9],            // 09:00
  2: [9, 21],        // 09:00, 21:00
  3: [8, 14, 20],    // 08:00, 14:00, 20:00
  4: [8, 12, 16, 20],// 08:00, 12:00, 16:00, 20:00
};

export async function createMedicationCalendarEvents(
  patientId: string,
  prescription: MedPrescriptionItem[],
): Promise<void> {
  try {
    const auth = await getAuthClient(patientId);
    if (!auth) {
      console.log('[Calendar] Patient has not connected Google Calendar — skipping med events');
      return;
    }

    const calendar = google.calendar({ version: 'v3', auth });

    // Start from tomorrow (first dose tomorrow morning)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    for (const item of prescription) {
      const timesPerDay = freqToTimesPerDay(item.frequency);
      const doseTimes = MED_DOSE_TIMES[timesPerDay] ?? [9];

      for (const hour of doseTimes) {
        // Build the first occurrence datetime
        const eventStart = new Date(tomorrow);
        eventStart.setUTCHours(hour, 0, 0, 0);

        const eventEnd = new Date(eventStart);
        eventEnd.setUTCMinutes(eventEnd.getUTCMinutes() + 15); // 15-min block

        try {
          await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: `💊 ${item.drug} ${item.dose}`,
              description:
                `Medication Reminder\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Drug        : ${item.drug}\n` +
                `Dose        : ${item.dose}\n` +
                `Frequency   : ${item.frequency}\n` +
                `Duration    : ${item.durationDays} day(s)\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Prescribed via HealthCare App`,
              start: {
                dateTime: eventStart.toISOString(),
                timeZone: 'Asia/Kolkata',
              },
              end: {
                dateTime: eventEnd.toISOString(),
                timeZone: 'Asia/Kolkata',
              },
              // Repeat every day for exactly durationDays occurrences
              recurrence: [`RRULE:FREQ=DAILY;COUNT=${item.durationDays}`],
              colorId: '7', // Teal/Peacock — stands out from regular appointments
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 10 },  // phone notification 10 min before
                  { method: 'email', minutes: 30 },  // email 30 min before
                ],
              },
            },
          });

          console.log(
            `[Calendar] Created med event: ${item.drug} @ ${hour}:00 × ${item.durationDays} days`,
          );
        } catch (innerErr) {
          console.error(`[Calendar] Failed to create event for ${item.drug} @${hour}:00:`, innerErr);
        }
      }
    }

    console.log(`[Calendar] ✅ Medication events created for patient ${patientId}`);
  } catch (err) {
    // Never throw — calendar failure must not break prescription save
    console.error('[Calendar] createMedicationCalendarEvents failed:', err);
  }
}

