import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@dct-crm/db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { authorize } from '../middleware/authorization';
import { auditLog } from '../middleware/audit';
import { ApiResponse, PaginatedResponse } from '../types';
import { Prisma } from '@prisma/client';

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  annualRevenue: z.number().optional(),
  numberOfEmployees: z.number().int().optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

const updateAccountSchema = accountSchema.partial();

router.get('/', authenticate, authorize('Account', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { page = 1, limit = 50, search, industry, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const cappedLimit = Math.min(Number(limit), 100);

    const skip = (Number(page) - 1) * cappedLimit;

    const where: Prisma.AccountWhereInput = {
      tenantId,
      ...(industry && { industry: industry as string }),
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { industry: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const [accounts, total] = await Promise.all([
      prisma.account.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { [sortBy as string]: sortOrder },
        include: {
          _count: { select: { contacts: true, customers: true } },
        },
      }),
      prisma.account.count({ where }),
    ]);

    const response: PaginatedResponse<typeof accounts[0]> = {
      success: true,
      data: accounts,
      pagination: {
        page: Number(page),
        limit: cappedLimit,
        total,
        totalPages: Math.ceil(total / cappedLimit),
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch accounts' });
  }
});

router.get('/:id', authenticate, authorize('Account', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const account = await prisma.account.findFirst({
      where: { id, tenantId },
      include: {
        contacts: { select: { id: true, firstName: true, lastName: true, email: true } },
        customers: { select: { id: true, firstName: true, lastName: true, phone: true }, take: 10 },
      },
    });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch account' });
  }
});

router.post('/', authenticate, authorize('Account', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const data = accountSchema.parse(req.body);

    const account = await prisma.account.create({
      data: {
        ...data,
        tenantId,
      },
    });

    await auditLog(tenantId, userId, 'CREATE', 'Account', account.id, null, { name: data.name });

    res.status(201).json({ success: true, data: account });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

router.put('/:id', authenticate, authorize('Account', 'edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;
    const data = updateAccountSchema.parse(req.body);

    const existing = await prisma.account.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const account = await prisma.account.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });

    await auditLog(tenantId, userId, 'UPDATE', 'Account', id, null, data);

    res.json({ success: true, data: account });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update account' });
  }
});

router.delete('/:id', authenticate, authorize('Account', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;

    const existing = await prisma.account.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    await prisma.account.delete({ where: { id } });

    await auditLog(tenantId, userId, 'DELETE', 'Account', id, { name: existing.name }, null);

    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

export default router;
