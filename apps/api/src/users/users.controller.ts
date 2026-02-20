import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';

type RequestWithUser = {
  user?: {
    sub: string;
    appId: string;
    email: string;
    permissions: string[];
  };
};

@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user.read')
  async me(@Req() req: RequestWithUser) {
    const userId = req.user?.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    return {
      user,
      appId: req.user?.appId,
      permissions: req.user?.permissions || [],
    };
  }
}
