import prisma from '../../lib/prisma';

export interface PrescriptionItem {
  drug: string;
  dose: string;
  frequency: string; // e.g. "once daily", "twice daily", "three times daily"
  durationDays: number;
}

// Map frequency string to times-per-day count
function frequencyToTimesPerDay(frequency: string): number {
  const lower = frequency.toLowerCase();
  if (lower.includes('once') || lower.includes('1')) return 1;
  if (lower.includes('twice') || lower.includes('2')) return 2;
  if (lower.includes('three') || lower.includes('3') || lower.includes('thrice')) return 3;
  if (lower.includes('four') || lower.includes('4')) return 4;
  return 1; // Default to once daily
}

// Map times-per-day to starting hours of day (UTC)
const DOSE_TIMES: Record<number, number[]> = {
  1: [9],           // 09:00
  2: [9, 21],       // 09:00, 21:00
  3: [8, 14, 20],   // 08:00, 14:00, 20:00
  4: [8, 12, 16, 20], // 08:00, 12:00, 16:00, 20:00
};

/**
 * Generate MedicationReminder rows from a prescription.
 * Called after doctor submits notes.
 */
export async function generateMedicationReminders(
  appointmentId: string,
  patientId: string,
  prescription: PrescriptionItem[],
  baseDate: Date = new Date(),
): Promise<void> {
  if (!prescription || prescription.length === 0) return;

  const reminders = [];

  for (const item of prescription) {
    const timesPerDay = frequencyToTimesPerDay(item.frequency);
    const doseTimes = DOSE_TIMES[timesPerDay] ?? DOSE_TIMES[1];

    // First reminder: tomorrow at the first dose time
    const tomorrow = new Date(baseDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const firstDoseHour = doseTimes[0];
    tomorrow.setUTCHours(firstDoseHour, 0, 0, 0);

    reminders.push({
      appointmentId,
      patientId,
      drug: item.drug,
      dose: item.dose,
      scheduledTime: tomorrow,
      frequencyPerDay: timesPerDay,
      remainingDays: item.durationDays,
      active: true,
    });
  }

  await prisma.medicationReminder.createMany({ data: reminders });
  console.log(`[Medication] Created ${reminders.length} reminder(s) for appointment ${appointmentId}`);
}
