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

const customerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  leadId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().max(100).optional(),
});

const updateCustomerSchema = customerSchema.partial();

router.get('/', authenticate, authorize('Customer', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { page = 1, limit = 50, search, leadId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const cappedLimit = Math.min(Number(limit), 100);

    const skip = (Number(page) - 1) * cappedLimit;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(leadId && { leadId: leadId as string }),
      ...(search && {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { [sortBy as string]: sortOrder },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, status: true } },
          _count: { select: { bookings: true, payments: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const response: PaginatedResponse<typeof customers[0]> = {
      success: true,
      data: customers,
      pagination: {
        page: Number(page),
        limit: cappedLimit,
        total,
        totalPages: Math.ceil(total / cappedLimit),
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

router.get('/:id', authenticate, authorize('Customer', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, status: true } },
        bookings: { select: { id: true, unitId: true, status: true, bookingDate: true } },
        payments: { select: { id: true, amount: true, status: true, paymentDate: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch customer' });
  }
});

router.post('/', authenticate, authorize('Customer', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const data = customerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        ...data,
        tenantId,
      },
    });

    await auditLog(tenantId, userId, 'CREATE', 'Customer', customer.id, null, { firstName: data.firstName, lastName: data.lastName });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

router.put('/:id', authenticate, authorize('Customer', 'edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;
    const data = updateCustomerSchema.parse(req.body);

    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });

    await auditLog(tenantId, userId, 'UPDATE', 'Customer', id, null, data);

    res.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update customer' });
  }
});

router.delete('/:id', authenticate, authorize('Customer', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;

    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    await prisma.customer.delete({ where: { id } });

    await auditLog(tenantId, userId, 'DELETE', 'Customer', id, { firstName: existing.firstName, lastName: existing.lastName }, null);

    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete customer' });
  }
});

export default router;
