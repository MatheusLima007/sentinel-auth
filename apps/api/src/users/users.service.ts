import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

type MeContext = {
  userId?: string;
  appId?: string;
  permissions?: string[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(context: MeContext) {
    if (!context.userId || !context.appId) {
      throw new UnauthorizedException('Contexto de usuário inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    return {
      user,
      appId: context.appId,
      permissions: context.permissions || [],
    };
  }
}
