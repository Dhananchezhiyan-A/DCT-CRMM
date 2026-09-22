import { Router, Response } from 'express';
import { prisma } from '@dct-crm/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

const VALID_POOL_TYPES = ['PRESALES', 'SVC', 'SALES'];

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user?.isSuperAdmin) {
    const isAdmin = (req as any).effectivePermissions?.some(
      (p: any) => p.objectName === 'Setup' && p.permission === 'configure'
    );
    if (!isAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return false;
    }
  }
  return true;
}

router.get('/:poolType', async (req: AuthRequest, res: Response) => {
  try {
    const { poolType } = req.params;
    if (!VALID_POOL_TYPES.includes(poolType)) {
      return res.status(400).json({ success: false, error: 'Invalid pool type' });
    }

    const members = await prisma.roundRobinMember.findMany({
      where: { tenantId: req.tenantId!, poolType },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true, isActive: true,
            profile: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: members });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.roundRobinMember.findMany({
      where: { tenantId: req.tenantId! },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, email: true, isActive: true,
            profile: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ poolType: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped: Record<string, any[]> = { PRESALES: [], SVC: [], SALES: [] };
    for (const m of members) {
      if (grouped[m.poolType]) grouped[m.poolType].push(m);
    }

    return res.json({ success: true, data: grouped });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { userId, poolType } = req.body;
    if (!userId || !poolType) {
      return res.status(400).json({ success: false, error: 'userId and poolType required' });
    }
    if (!VALID_POOL_TYPES.includes(poolType)) {
      return res.status(400).json({ success: false, error: 'Invalid pool type' });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: req.tenantId!, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existing = await prisma.roundRobinMember.findUnique({
      where: { tenantId_userId_poolType: { tenantId: req.tenantId!, userId, poolType } },
    });
    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.roundRobinMember.update({
          where: { id: existing.id },
          data: { isActive: true },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profile: { select: { id: true, name: true } } } },
          },
        });
        return res.json({ success: true, data: updated });
      }
      return res.status(409).json({ success: false, error: 'User already in this Round Robin pool' });
    }

    const member = await prisma.roundRobinMember.create({
      data: { tenantId: req.tenantId!, userId, poolType },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profile: { select: { id: true, name: true } } } },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'CREATE',
        objectType: 'RoundRobinMember',
        objectId: member.id,
        newValues: { userId, poolType, userName: `${user.firstName} ${user.lastName}` },
      },
    });

    return res.json({ success: true, data: member });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!requireAdmin(req, res)) return;

    const member = await prisma.roundRobinMember.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    await prisma.roundRobinMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'DELETE',
        objectType: 'RoundRobinMember',
        objectId: member.id,
        oldValues: { userId: member.userId, poolType: member.poolType, userName: `${member.user.firstName} ${member.user.lastName}` },
      },
    });

    return res.json({ success: true, message: 'Member removed from Round Robin' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/eligible/:poolType', async (req: AuthRequest, res: Response) => {
  try {
    const { poolType } = req.params;
    if (!VALID_POOL_TYPES.includes(poolType)) {
      return res.status(400).json({ success: false, error: 'Invalid pool type' });
    }

    const profileNameMap: Record<string, string> = {
      PRESALES: 'Presales',
      SVC: 'SVC',
      SALES: 'Sales',
    };

    const profile = await prisma.profile.findFirst({
      where: { tenantId: req.tenantId!, name: profileNameMap[poolType] },
    });

    if (!profile) {
      return res.json({ success: true, data: [] });
    }

    const existingMemberUserIds = await prisma.roundRobinMember.findMany({
      where: { tenantId: req.tenantId!, poolType, isActive: true },
      select: { userId: true },
    }).then((ms) => new Set(ms.map((m) => m.userId)));

    const eligibleUsers = await prisma.user.findMany({
      where: {
        tenantId: req.tenantId!,
        isActive: true,
        profileId: profile.id,
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        profile: { select: { id: true, name: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    const result = eligibleUsers.filter((u) => !existingMemberUserIds.has(u.id));

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
