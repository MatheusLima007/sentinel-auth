import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const demoWeb = await prisma.app.upsert({
    where: { slug: 'demo-web' },
    update: { name: 'Demo Web' },
    create: { slug: 'demo-web', name: 'Demo Web' },
  });

  const demoMobile = await prisma.app.upsert({
    where: { slug: 'demo-mobile' },
    update: { name: 'Demo Mobile' },
    create: { slug: 'demo-mobile', name: 'Demo Mobile' },
  });

  const passwordHash = await bcrypt.hash('Demo@12345', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@local.dev' },
    update: {
      name: 'Demo User',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: 'Demo User',
      email: 'demo@local.dev',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const webPermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoWeb.id,
        key: 'user.read',
      },
    },
    update: {},
    create: {
      appId: demoWeb.id,
      key: 'user.read',
    },
  });

  const webSessionsReadPermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoWeb.id,
        key: 'sessions.read',
      },
    },
    update: {},
    create: {
      appId: demoWeb.id,
      key: 'sessions.read',
    },
  });

  const webSessionsRevokePermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoWeb.id,
        key: 'sessions.revoke',
      },
    },
    update: {},
    create: {
      appId: demoWeb.id,
      key: 'sessions.revoke',
    },
  });

  const mobilePermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoMobile.id,
        key: 'user.read',
      },
    },
    update: {},
    create: {
      appId: demoMobile.id,
      key: 'user.read',
    },
  });

  const mobileSessionsReadPermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoMobile.id,
        key: 'sessions.read',
      },
    },
    update: {},
    create: {
      appId: demoMobile.id,
      key: 'sessions.read',
    },
  });

  const mobileSessionsRevokePermission = await prisma.permission.upsert({
    where: {
      appId_key: {
        appId: demoMobile.id,
        key: 'sessions.revoke',
      },
    },
    update: {},
    create: {
      appId: demoMobile.id,
      key: 'sessions.revoke',
    },
  });

  const webRole = await prisma.role.upsert({
    where: {
      appId_name: {
        appId: demoWeb.id,
        name: 'user',
      },
    },
    update: {},
    create: {
      appId: demoWeb.id,
      name: 'user',
    },
  });

  const mobileRole = await prisma.role.upsert({
    where: {
      appId_name: {
        appId: demoMobile.id,
        name: 'user',
      },
    },
    update: {},
    create: {
      appId: demoMobile.id,
      name: 'user',
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: webRole.id,
        permissionId: webPermission.id,
      },
    },
    update: {},
    create: {
      roleId: webRole.id,
      permissionId: webPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: webRole.id,
        permissionId: webSessionsReadPermission.id,
      },
    },
    update: {},
    create: {
      roleId: webRole.id,
      permissionId: webSessionsReadPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: webRole.id,
        permissionId: webSessionsRevokePermission.id,
      },
    },
    update: {},
    create: {
      roleId: webRole.id,
      permissionId: webSessionsRevokePermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: mobileRole.id,
        permissionId: mobilePermission.id,
      },
    },
    update: {},
    create: {
      roleId: mobileRole.id,
      permissionId: mobilePermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: mobileRole.id,
        permissionId: mobileSessionsReadPermission.id,
      },
    },
    update: {},
    create: {
      roleId: mobileRole.id,
      permissionId: mobileSessionsReadPermission.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: mobileRole.id,
        permissionId: mobileSessionsRevokePermission.id,
      },
    },
    update: {},
    create: {
      roleId: mobileRole.id,
      permissionId: mobileSessionsRevokePermission.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: webRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: webRole.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: mobileRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: mobileRole.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
