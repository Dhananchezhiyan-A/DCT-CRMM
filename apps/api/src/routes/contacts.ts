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

const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(20),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(100).optional(),
  leadId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

const updateContactSchema = contactSchema.partial();

router.get('/', authenticate, authorize('Contact', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { page = 1, limit = 50, search, leadId, accountId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const cappedLimit = Math.min(Number(limit), 100);

    const skip = (Number(page) - 1) * cappedLimit;

    const where: Prisma.ContactWhereInput = {
      tenantId,
      ...(leadId && { leadId: leadId as string }),
      ...(accountId && { accountId: accountId as string }),
      ...(search && {
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: cappedLimit,
        orderBy: { [sortBy as string]: sortOrder },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    const response: PaginatedResponse<typeof contacts[0]> = {
      success: true,
      data: contacts,
      pagination: {
        page: Number(page),
        limit: cappedLimit,
        total,
        totalPages: Math.ceil(total / cappedLimit),
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

router.get('/:id', authenticate, authorize('Contact', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const contact = await prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
      },
    });

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contact' });
  }
});

router.post('/', authenticate, authorize('Contact', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contact.create({
      data: {
        ...data,
        tenantId,
      },
    });

    await auditLog(tenantId, userId, 'CREATE', 'Contact', contact.id, null, { firstName: data.firstName, lastName: data.lastName });

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create contact' });
  }
});

router.put('/:id', authenticate, authorize('Contact', 'edit'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;
    const data = updateContactSchema.parse(req.body);

    const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });

    await auditLog(tenantId, userId, 'UPDATE', 'Contact', id, null, data);

    res.json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update contact' });
  }
});

router.delete('/:id', authenticate, authorize('Contact', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId, id: userId } = req.user!;
    const { id } = req.params;

    const existing = await prisma.contact.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    await prisma.contact.delete({ where: { id } });

    await auditLog(tenantId, userId, 'DELETE', 'Contact', id, { firstName: existing.firstName, lastName: existing.lastName }, null);

    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete contact' });
  }
});

export default router;
