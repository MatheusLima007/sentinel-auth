import { AuditEventType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RequestMeta } from './types';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto, meta: RequestMeta) {
    const app = await this.prisma.app.findUnique({ where: { slug: input.appId } });

    if (!app) {
      await this.auditService.log({
        type: AuditEventType.LOGIN_FAIL,
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        metadata: { reason: 'app_not_found', email: input.email, appSlug: input.appId },
      });
      throw new NotFoundException('App não encontrada');
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.auditService.log({
        type: AuditEventType.LOGIN_FAIL,
        appId: app.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        metadata: { reason: 'user_not_active', email: input.email },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordValid) {
      await this.auditService.log({
        type: AuditEventType.LOGIN_FAIL,
        appId: app.id,
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        metadata: { reason: 'password_mismatch' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const permissions = await this.getPermissionsForUserInApp(user.id, app.id);

    const family = randomUUID();
    const refreshToken = await this.tokenService.generateRefreshToken({
      sub: user.id,
      appId: app.id,
      family,
      sessionId: randomUUID(),
    });

    const refreshClaims = await this.tokenService.verifyRefreshToken(refreshToken);

    await this.prisma.refreshSession.create({
      data: {
        id: refreshClaims.sessionId,
        family,
        userId: user.id,
        appId: app.id,
        tokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt: new Date((refreshClaims.exp || 0) * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      appId: app.id,
      permissions,
    });

    await this.auditService.log({
      type: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      appId: app.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const claims = await this.tokenService.verifyRefreshToken(refreshToken);
    const tokenHash = this.tokenService.hashToken(refreshToken);

    const currentSession = await this.prisma.refreshSession.findUnique({
      where: { id: claims.sessionId },
    });

    if (!currentSession) {
      throw new UnauthorizedException({
        code: 'REFRESH_SESSION_NOT_FOUND',
        message: 'Sessão de refresh inválida',
      });
    }

    const reused = currentSession.revokedAt !== null || currentSession.tokenHash !== tokenHash;

    if (reused) {
      await this.prisma.refreshSession.updateMany({
        where: { family: claims.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditService.log({
        type: AuditEventType.REFRESH_REUSE_DETECTED,
        userId: claims.sub,
        appId: claims.appId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        metadata: { sessionId: claims.sessionId, family: claims.family },
      });

      throw new UnauthorizedException({
        code: 'REFRESH_REUSE_DETECTED',
        message: 'Refresh token reutilizado',
      });
    }

    if (currentSession.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_EXPIRED',
        message: 'Refresh token expirado',
      });
    }

    await this.prisma.refreshSession.update({
      where: { id: currentSession.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const permissions = await this.getPermissionsForUserInApp(user.id, claims.appId);

    const newRefreshToken = await this.tokenService.generateRefreshToken({
      sub: user.id,
      appId: claims.appId,
      family: claims.family,
      sessionId: randomUUID(),
    });

    const newRefreshClaims = await this.tokenService.verifyRefreshToken(newRefreshToken);

    await this.prisma.refreshSession.create({
      data: {
        id: newRefreshClaims.sessionId,
        family: claims.family,
        userId: user.id,
        appId: claims.appId,
        tokenHash: this.tokenService.hashToken(newRefreshToken),
        expiresAt: new Date((newRefreshClaims.exp || 0) * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      appId: claims.appId,
      permissions,
    });

    await this.auditService.log({
      type: AuditEventType.REFRESH,
      userId: user.id,
      appId: claims.appId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      metadata: { previousSessionId: claims.sessionId, newSessionId: newRefreshClaims.sessionId },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string, meta: RequestMeta) {
    const claims = await this.tokenService.verifyRefreshToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: {
        id: claims.sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      type: AuditEventType.LOGOUT,
      userId: claims.sub,
      appId: claims.appId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      metadata: { sessionId: claims.sessionId },
    });

    return { success: true };
  }

  async logoutAll(userId: string, appId: string, meta: RequestMeta) {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        appId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.log({
      type: AuditEventType.LOGOUT_ALL,
      userId,
      appId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });

    return { success: true };
  }

  private async getPermissionsForUserInApp(userId: string, appId: string) {
    const roles = await this.prisma.userRole.findMany({
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
