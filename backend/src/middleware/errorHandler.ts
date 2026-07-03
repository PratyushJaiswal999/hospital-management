import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// ── Custom AppError ────────────────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Global error handler ───────────────────────────────────────────────────
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors,
    });
    return;
  }

  // Known application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Prisma unique constraint violation (double-booking guard)
  if (
    err instanceof Error &&
    err.message.includes('Unique constraint failed')
  ) {
    res.status(409).json({
      error: 'Slot no longer available — please pick another time',
      code: 'SLOT_CONFLICT',
    });
    return;
  }

  // Unknown error
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
