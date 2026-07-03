# System Design: Healthcare Appointment & Follow-up Manager

## Overview

This system manages the full lifecycle of a healthcare appointment: discovery → booking → pre-visit preparation → clinical visit → post-visit follow-up → medication reminders. The central design challenge is concurrency safety during booking (multiple patients racing for the same slot), combined with reliability requirements for external services (LLM, email, Google Calendar) that must never block core booking flows.

---

## Double-Booking Prevention

The system treats slot booking as a two-phase process — *hold* then *confirm* — rather than a single insert. When a patient selects a slot, the API opens a database transaction at SERIALIZABLE isolation level, takes a row-level lock on any existing booking for that doctor/slot (`SELECT ... FOR UPDATE`), and inserts a new `Appointment` row with `status=HELD`. A partial unique index on `(doctorId, slotStart)` scoped to `status IN ('HELD','CONFIRMED')` acts as a last line of defense: even if two requests race past the application-level check, PostgreSQL rejects the second insert and the API translates the constraint violation into a `409 Conflict`. The frontend responds to a 409 by immediately refreshing the slot grid rather than showing a generic error, so the patient can pick another time without manual intervention. A client-supplied idempotency key (UUID per booking attempt) prevents duplicate holds from network retries. Because the hold is time-boxed to 5 minutes and a delayed BullMQ job automatically cancels expired holds, slots can never be permanently "stuck" — availability self-heals without manual intervention.

---

## Doctor Leave Conflict Handling

Leave is modeled as its own table (`DoctorLeave`, one row per date) rather than a field on the doctor profile. This keeps availability generation simple — working hours minus leave dates minus already-booked slots — and makes leave auditable. When an admin marks a leave day, the system runs a single atomic transaction that: (1) creates the `DoctorLeave` row, (2) finds every `HELD`/`CONFIRMED` appointment for that doctor on that date, (3) cancels each one, and (4) creates a `LEAVE_CONFLICT` notification row for each affected patient. Wrapping the cascade in one transaction avoids a half-applied state — emails are queued for appointments that actually got cancelled. Google Calendar event deletion runs outside the transaction via `setImmediate`, so a calendar API failure cannot roll back the leave or the cancellations. Leave-marking is idempotent: the unique constraint `(doctorId, date)` prevents duplicate leave rows.

---

## Slot Hold Mechanism

The hold state exists to give patients time to fill in their symptom form without losing the slot to another patient, while guaranteeing the slot is not permanently reserved if they abandon the flow. A hold is created with an expiry timestamp (`holdExpiresAt = now() + 5 minutes`), and a delayed BullMQ job fires at that timestamp to flip the row from `HELD` to `CANCELLED` if it has not yet been confirmed. This means slot state is enforced server-side regardless of what the browser does — there is no client heartbeat or polling requirement. Confirming within the window is an atomic status transition (`HELD → CONFIRMED`) protected by the same row-level lock used at hold creation, so a hold cannot be confirmed twice or confirmed after it has already expired and been recycled.

---

## Notification Reliability

No user-visible action (booking confirmation, cancellation, leave cascade) waits on an external service. Every notification is written as a `Notification` row in the same database transaction as the domain change, then processed asynchronously by a BullMQ email worker. This decouples "the booking succeeded" from "the email was sent," so an email provider outage never blocks a booking from completing. Failed sends are retried with exponential backoff (1 min, 2 min, 4 min, 8 min, 16 min) up to 5 attempts; each attempt is logged (`attempts`, `lastError`) for observability. After 5 failures the notification is marked `FAILED` and remains queryable by admins for manual follow-up. Appointment reminders (24 hours pre-visit) and medication reminders are generated as scheduled `Notification` rows and processed by periodic cron-style BullMQ workers rather than fired inline — same durability guarantee.

---

## LLM Integration and Graceful Degradation

Both the pre-visit and post-visit LLM calls (Google Gemini 1.5 Flash, free tier) are wrapped in a 10-second timeout with one retry and exponential backoff. Critically, both calls run in `setImmediate` callbacks — they are completely decoupled from the primary booking and notes-submission HTTP responses. The appointment is confirmed and marked `COMPLETED` before the LLM is even called, so a slow or unavailable LLM provider cannot block the appointment lifecycle. On failure after retry, the system falls back to a deterministic result: for pre-visit, an "Unknown" urgency placeholder built from the raw symptom text; for post-visit, a templated summary constructed directly from the structured `prescription` JSON without any LLM call. A `generationFailed` flag is stored on the record so the UI can signal the fallback to the doctor. Failed LLM jobs are also queued in `llm-retry` for background reprocessing. This "never break the core flow" principle — async notifications, async LLM, deterministic fallbacks — is the throughline of the entire design.

---

*(Word count: ~730)*
