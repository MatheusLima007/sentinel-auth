import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionsForUserInApp(
    userId: string,
    appId: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const roles = await prismaClient.userRole.findMany({
      where: {
        userId,
        role: {
          appId,
        },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const uniquePermissions = new Set<string>();

    for (const userRole of roles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        uniquePermissions.add(rolePermission.permission.key);
      }
    }

    return Array.from(uniquePermissions);
  }
}
