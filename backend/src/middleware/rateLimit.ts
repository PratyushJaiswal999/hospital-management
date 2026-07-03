import { Request, Response, NextFunction } from 'express';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// In-memory request store
const store = new Map<string, RateLimitInfo>();

// Simple cleanup function to prevent memory leaks over time
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
}, 60000); // Clean up expired records every minute

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string; // Custom error message
}

export const rateLimiter = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting in test environment if needed
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    // Create a key scoped to the specific route prefix / client IP to avoid cross-route rate limit pollution
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
    }

    record.count++;
    store.set(key, record);

    const remaining = Math.max(0, options.max - record.count);
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.max) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Too many requests, please try again later.',
      });
      return;
    }

    next();
  };
};
