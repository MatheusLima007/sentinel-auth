import { AuditEventType, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditEventInput) {
    return this.prisma.auditEvent.create({
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
  }
}
