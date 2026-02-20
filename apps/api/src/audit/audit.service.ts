import { Injectable, Logger } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export interface CreateAuditEventInput {
  type: AuditEventType;
  userId?: string;
  appId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditEventInput) {
    try {
      return await this.prisma.auditEvent.create({
        data: {
          type: input.type,
          userId: input.userId,
          appId: input.appId,
          ip: input.ip,
          userAgent: input.userAgent,
          correlationId: input.correlationId,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      const exception = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Falha ao persistir evento de auditoria', exception.stack);
      return null;
    }
  }
}
