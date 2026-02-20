import { AuditEventType } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { RequestMeta } from '../auth/types';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listUserSessions(userId: string, appId: string) {
    return this.prisma.refreshSession.findMany({
      where: {
        userId,
        appId,
        revokedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ip: true,
      },
    });
  }

  async revokeSession(userId: string, appId: string, sessionId: string, meta: RequestMeta) {
    const updated = await this.prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        userId,
        appId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Sessão não encontrada');
    }

    await this.auditService.log({
      type: AuditEventType.LOGOUT,
      userId,
      appId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      metadata: { action: 'session_revoke', sessionId },
    });

    return { success: true };
  }
}
