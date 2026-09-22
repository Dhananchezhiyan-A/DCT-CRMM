const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst({ where: { email: 'admin@dctcrm.com', isActive: true }, select: { id: true, email: true, isActive: true, isSuperAdmin: true } }).then(u => { console.log('User:', JSON.stringify(u)); return p.$disconnect(); }).catch(e => { console.error('Error:', e.message); return p.$disconnect(); });
