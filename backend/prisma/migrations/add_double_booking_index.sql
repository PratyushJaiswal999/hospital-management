-- This migration adds the partial unique index that prevents double-booking at the DB level.
-- Prisma does not support partial unique indexes natively, so this is applied as raw SQL.

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_no_double_booking"
ON "Appointment" ("doctorId", "slotStart")
WHERE status IN ('HELD', 'CONFIRMED');
