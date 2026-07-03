import { Router } from 'express';
import prisma from '../../lib/prisma';
import { verifyToken, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { Role, NotificationStatus } from '@prisma/client';

const router = Router();

// ── GET /notifications ─────────────────────────────────────────────────────
// Admin only — query ?status=FAILED|PENDING|SENT|RETRYING
router.get('/', verifyToken, requireRole(Role.ADMIN), async (req: AuthenticatedRequest, res) => {
  const { status, limit = '50', offset = '0' } = req.query as {
    status?: string;
    limit?: string;
    offset?: string;
  };

  const where = status ? { status: status as NotificationStatus } : {};

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } },
        appointment: { select: { id: true, slotStart: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({ notifications, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
});

export default router;
