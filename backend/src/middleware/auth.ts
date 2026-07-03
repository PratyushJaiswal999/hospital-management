import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: Role };
}

// ── verifyToken middleware ─────────────────────────────────────────────────
export function verifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    return;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
      id: string;
      email: string;
      role: Role;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}

// ── requireRole middleware factory ─────────────────────────────────────────
export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
