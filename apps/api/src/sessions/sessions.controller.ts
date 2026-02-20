import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestMeta } from '../auth/types';
import { AuthenticatedRequest } from '../common/authenticated-request.type';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @ApiOperation({ summary: 'Listar sessões ativas do usuário' })
  @ApiOkResponse({ description: 'Lista de sessões retornada com sucesso' })
  @ApiForbiddenResponse({ description: 'Usuário sem permissão sessions.read' })
  @Get()
  @RequirePermissions('sessions.read')
  list(@Req() req: AuthenticatedRequest) {
    return this.sessionsService.listUserSessions(req.user!.sub, req.user!.appId);
  }

  @ApiOperation({ summary: 'Revogar uma sessão específica do usuário' })
  @ApiBody({ type: RevokeSessionDto })
  @ApiOkResponse({ description: 'Sessão revogada com sucesso' })
  @ApiForbiddenResponse({ description: 'Usuário sem permissão sessions.revoke' })
  @Post('revoke')
  @RequirePermissions('sessions.revoke')
  revoke(@Body() dto: RevokeSessionDto, @Req() req: AuthenticatedRequest) {
    return this.sessionsService.revokeSession(
      req.user!.sub,
      req.user!.appId,
      dto.sessionId,
      this.extractMeta(req),
    );
  }

  private extractMeta(req: AuthenticatedRequest): RequestMeta {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    };
  }
}
