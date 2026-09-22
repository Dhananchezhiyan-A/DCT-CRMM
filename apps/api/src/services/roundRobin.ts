import { prisma } from '@dct-crm/db';

export interface RoundRobinResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

async function getProfileUsers(tenantId: string, profileName: string): Promise<RoundRobinResult[]> {
  const profile = await prisma.profile.findFirst({
    where: { tenantId, name: profileName },
  });
  if (!profile) return [];

  return prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      profileId: profile.id,
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
}

async function pickNextUser(users: RoundRobinResult[], tenantId: string, queueType: string): Promise<RoundRobinResult | null> {
  if (users.length === 0) return null;

  const queue = await prisma.queue.findFirst({
    where: { tenantId, type: queueType },
  });

  let lastIndex = -1;
  if (queue && queue.description) {
    const parsed = parseInt(queue.description, 10);
    if (!isNaN(parsed)) lastIndex = parsed;
  }

  const nextIndex = (lastIndex + 1) % users.length;

  if (queue) {
    await prisma.queue.update({
      where: { id: queue.id },
      data: { description: String(nextIndex) },
    });
  } else {
    await prisma.queue.create({
      data: {
        tenantId,
        name: `${queueType.replace('_', ' ')} Queue`,
        type: queueType,
        isActive: true,
        description: String(nextIndex),
      },
    });
  }

  return users[nextIndex];
}

export async function getNextSVCUser(tenantId: string): Promise<RoundRobinResult | null> {
  const users = await getProfileUsers(tenantId, 'SVC');
  return pickNextUser(users, tenantId, 'SVC_ROUND_ROBIN');
}

export async function getNextSalesUser(tenantId: string): Promise<RoundRobinResult | null> {
  const users = await getProfileUsers(tenantId, 'Sales');
  return pickNextUser(users, tenantId, 'SALES_ROUND_ROBIN');
}

export async function getNextPresalesUser(tenantId: string): Promise<RoundRobinResult | null> {
  const users = await getProfileUsers(tenantId, 'Presales');
  return pickNextUser(users, tenantId, 'PRESALES_ROUND_ROBIN');
}
