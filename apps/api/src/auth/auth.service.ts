import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditEventType, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';
import { RequestMeta } from './types';

const DUMMY_PASSWORD_HASH = '$2b$10$KYVbZ5JFVfqu0oV98LnF5eTk4QTe2e4PQG7QNYfhumEpGdi/867AO';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
  ) {}

  async login(input: LoginDto, meta: RequestMeta) {
    const app = await this.prisma.app.findUnique({ where: { slug: input.appId } });
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const passwordValid = await bcrypt.compare(input.password, passwordHash);

    if (!app || !user || user.status !== UserStatus.ACTIVE || !passwordValid) {
      const reason = !app
        ? 'app_not_found'
        : !user
          ? 'user_not_found'
          : user.status !== UserStatus.ACTIVE
            ? 'user_not_active'
            : 'password_mismatch';

      await this.auditService.log({
        type: AuditEventType.LOGIN_FAIL,
        appId: app?.id,
        userId: user?.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        metadata: { reason, email: input.email, appSlug: input.appId },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const permissions = await this.rbacService.getPermissionsForUserInApp(user.id, app.id);

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

    let refreshContext: {
      user: { id: string; email: string };
      permissions: string[];
      previousSessionId: string;
    };

    try {
      refreshContext = await this.prisma.$transaction(async (transaction) => {
        const currentSession = await transaction.refreshSession.findUnique({
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
          await transaction.refreshSession.updateMany({
            where: { family: claims.family, revokedAt: null },
            data: { revokedAt: new Date() },
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

        const revoked = await transaction.refreshSession.updateMany({
          where: {
            id: currentSession.id,
            revokedAt: null,
            tokenHash,
          },
          data: { revokedAt: new Date() },
        });

        if (revoked.count === 0) {
          await transaction.refreshSession.updateMany({
            where: { family: claims.family, revokedAt: null },
            data: { revokedAt: new Date() },
          });

          throw new UnauthorizedException({
            code: 'REFRESH_REUSE_DETECTED',
            message: 'Refresh token reutilizado',
          });
        }

        const user = await transaction.user.findUnique({ where: { id: claims.sub } });

        if (!user) {
          throw new UnauthorizedException('Usuário não encontrado');
        }

        const permissions = await this.rbacService.getPermissionsForUserInApp(
          user.id,
          claims.appId,
          transaction,
        );

        return {
          user: {
            id: user.id,
            email: user.email,
          },
          permissions,
          previousSessionId: currentSession.id,
        };
      });
    } catch (error) {
      const code = this.getExceptionCode(error);

      if (code === 'REFRESH_REUSE_DETECTED') {
        await this.auditService.log({
          type: AuditEventType.REFRESH_REUSE_DETECTED,
          userId: claims.sub,
          appId: claims.appId,
          ip: meta.ip,
          userAgent: meta.userAgent,
          correlationId: meta.correlationId,
          metadata: { sessionId: claims.sessionId, family: claims.family },
        });
      }

      throw error;
    }

    const newRefreshToken = await this.tokenService.generateRefreshToken({
      sub: refreshContext.user.id,
      appId: claims.appId,
      family: claims.family,
      sessionId: randomUUID(),
    });

    const newRefreshClaims = await this.tokenService.verifyRefreshToken(newRefreshToken);

    await this.prisma.refreshSession.create({
      data: {
        id: newRefreshClaims.sessionId,
        family: claims.family,
        userId: refreshContext.user.id,
        appId: claims.appId,
        tokenHash: this.tokenService.hashToken(newRefreshToken),
        expiresAt: new Date((newRefreshClaims.exp || 0) * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: refreshContext.user.id,
      email: refreshContext.user.email,
      appId: claims.appId,
      permissions: refreshContext.permissions,
    });

    await this.auditService.log({
      type: AuditEventType.REFRESH,
      userId: refreshContext.user.id,
      appId: claims.appId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      metadata: {
        previousSessionId: refreshContext.previousSessionId,
        newSessionId: newRefreshClaims.sessionId,
      },
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

  private getExceptionCode(error: unknown) {
    if (!(error instanceof UnauthorizedException)) {
      return undefined;
    }

    const response = error.getResponse();

    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const responseCode = (response as { code?: unknown }).code;

    return typeof responseCode === 'string' ? responseCode : undefined;
  }
}
