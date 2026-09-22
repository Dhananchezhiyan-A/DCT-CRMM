const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'admin@dctcrm.com', isActive: true },
      include: {
        tenant: { select: { id: true, name: true, slug: true, isActive: true, companyStartDate: true, companyExpiryDate: true } },
        profile: { select: { id: true, name: true, description: true, leadStatusAccess: true } },
        roles: {
          include: {
            role: {
              include: {
                permissionSets: {
                  include: { permissionSet: true },
                },
              },
            },
          },
        },
      },
    });
    console.log('Step 1 - findFirst OK, user:', !!user);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    console.log('Step 2 - update OK');

    console.log('Step 3 - testing token generation');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user.id, email: user.email, tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
    console.log('Step 4 - token OK:', token.substring(0, 30));

    console.log('ALL STEPS PASSED');
  } catch (e) {
    console.error('FAILED at step:', e.message);
    console.error('Stack:', e.stack?.substring(0, 500));
  } finally {
    await prisma.$disconnect();
  }
}

test();
