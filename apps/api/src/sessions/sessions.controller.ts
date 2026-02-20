import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestMeta } from '../auth/types';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { SessionsService } from './sessions.service';

type RequestWithUser = {
  user?: {
    sub: string;
    appId: string;
  };
  ip?: string;
  headers: {
    'user-agent'?: string;
  };
  correlationId?: string;
};

@Controller('sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @RequirePermissions('sessions.read')
  list(@Req() req: RequestWithUser) {
    return this.sessionsService.listUserSessions(req.user!.sub, req.user!.appId);
  }

  @Post('revoke')
  @RequirePermissions('sessions.revoke')
  revoke(@Body() dto: RevokeSessionDto, @Req() req: RequestWithUser) {
    return this.sessionsService.revokeSession(
      req.user!.sub,
      req.user!.appId,
      dto.sessionId,
      this.extractMeta(req),
    );
  }

  private extractMeta(req: RequestWithUser): RequestMeta {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    };
  }
}
