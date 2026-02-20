import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/authenticated-request.type';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Retornar dados do usuário autenticado' })
  @ApiOkResponse({ description: 'Dados do usuário retornados com sucesso' })
  @ApiForbiddenResponse({ description: 'Usuário sem permissão user.read' })
  @Get('me')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('user.read')
  async me(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMe({
      userId: req.user?.sub,
      appId: req.user?.appId,
      permissions: req.user?.permissions,
    });
  }
}
