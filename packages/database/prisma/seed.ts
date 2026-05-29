import { PrismaClient, UserRole, TicketStatus, TicketPriority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Admin@123', 12);

  const master = await prisma.user.upsert({
    where: { email: 'master@supporthub.com' },
    update: {},
    create: {
      email: 'master@supporthub.com',
      name: 'Master Admin',
      passwordHash,
      isMasterAdmin: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme',
    },
  });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: master.id, organizationId: org.id } },
    update: {},
    create: {
      userId: master.id,
      organizationId: org.id,
      role: UserRole.ORG_ADMIN,
      acceptedAt: new Date(),
    },
  });

  const project = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      organizationId: org.id,
      name: 'Website',
      description: 'Suporte ao website institucional',
    },
  });

  await prisma.sLAPolicy.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      organizationId: org.id,
      projectId: project.id,
      name: 'Default SLA',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@supporthub.com' },
    update: {},
    create: {
      email: 'agent@supporthub.com',
      name: 'Support Agent',
      passwordHash,
    },
  });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: agent.id, organizationId: org.id } },
    update: {},
    create: {
      userId: agent.id,
      organizationId: org.id,
      role: UserRole.SUPPORT_AGENT,
      acceptedAt: new Date(),
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'client@supporthub.com' },
    update: {},
    create: {
      email: 'client@supporthub.com',
      name: 'Client User',
      passwordHash,
    },
  });

  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: client.id, organizationId: org.id } },
    update: {},
    create: {
      userId: client.id,
      organizationId: org.id,
      role: UserRole.CLIENT,
      acceptedAt: new Date(),
    },
  });

  await prisma.ticket.upsert({
    where: { organizationId_number: { organizationId: org.id, number: 1 } },
    update: {},
    create: {
      number: 1,
      organizationId: org.id,
      projectId: project.id,
      title: 'Página inicial não carrega no mobile',
      description: 'Ao acessar o site pelo celular, a página inicial trava e não renderiza corretamente.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      createdById: client.id,
    },
  });

  console.log('Seed completed.');
  console.log('Master Admin: master@supporthub.com / Admin@123');
  console.log('Support Agent: agent@supporthub.com / Admin@123');
  console.log('Client: client@supporthub.com / Admin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
