import { DoctorProfile } from '@prisma/client';
import prisma from '../../lib/prisma';

interface TimeSlot {
  slotStart: string; // ISO string
  slotEnd: string;
}

/**
 * Generate all free slots for a given doctor on a given date.
 * Slots are computed (not stored): working hours − leaves − booked slots.
 */
export async function getAvailableSlots(
  doctorId: string,
  dateStr: string, // YYYY-MM-DD
): Promise<TimeSlot[]> {
  const date = new Date(dateStr);
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat

  const profile = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!profile) return [];

  // Doctor doesn't work this day
  if (!profile.workingDays.includes(dayOfWeek)) return [];

  // Check for leave on this date
  const leaveDate = new Date(dateStr);
  leaveDate.setUTCHours(0, 0, 0, 0);

  const leave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      date: leaveDate,
    },
  });
  if (leave) return []; // Doctor is on leave

  // Generate all candidate slots for the day
  const candidates = generateCandidateSlots(profile, date);

  // Fetch already booked/held slots for this day
  const dayStart = new Date(dateStr);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dateStr);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: dayStart, lte: dayEnd },
      status: { in: ['HELD', 'CONFIRMED'] },
    },
    select: { slotStart: true },
  });

  const bookedTimes = new Set(booked.map((b) => b.slotStart.toISOString()));

  // Filter out booked slots and past slots
  const now = new Date();
  return candidates.filter(
    (slot) => !bookedTimes.has(slot.slotStart) && new Date(slot.slotStart) > now,
  );
}

/**
 * Generate all possible slots for a doctor on a given day based on their profile.
 */
function generateCandidateSlots(
  profile: DoctorProfile,
  date: Date,
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const [startH, startM] = profile.workingHoursStart.split(':').map(Number);
  const [endH, endM] = profile.workingHoursEnd.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  for (
    let mins = startMinutes;
    mins + profile.slotDurationMinutes <= endMinutes;
    mins += profile.slotDurationMinutes
  ) {
    const slotStart = new Date(date);
    slotStart.setUTCHours(Math.floor(mins / 60), mins % 60, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + profile.slotDurationMinutes);

    slots.push({
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
    });
  }

  return slots;
}
