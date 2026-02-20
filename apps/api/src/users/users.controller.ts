import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { UsersService } from './users.service';

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
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user.read')
  async me(@Req() req: RequestWithUser) {
    return this.usersService.getMe({
      userId: req.user?.sub,
      appId: req.user?.appId,
      permissions: req.user?.permissions,
    });
  }
}
