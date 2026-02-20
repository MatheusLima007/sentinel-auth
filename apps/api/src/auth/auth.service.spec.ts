import { AuditEventType, UserStatus } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

const bcrypt = jest.requireMock('bcryptjs') as {
  compare: jest.Mock;
};

describe('AuthService', () => {
  const prismaMock = {
    app: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    userRole: { findMany: jest.fn() },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const tokenServiceMock = {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    hashToken: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const meta = {
    ip: '127.0.0.1',
    userAgent: 'jest',
    correlationId: 'corr-1',
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prismaMock as never,
      tokenServiceMock as never,
      auditServiceMock as never,
    );
  });

  it('login deve retornar access e refresh token', async () => {
    const dto: LoginDto = {
      email: 'demo@local.dev',
      password: 'Demo@12345',
      appId: 'demo-web',
    };

    prismaMock.app.findUnique.mockResolvedValue({ id: 'app-1', slug: 'demo-web' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: dto.email,
      name: 'Demo',
      status: UserStatus.ACTIVE,
      passwordHash: 'hash',
    });
    bcrypt.compare.mockResolvedValue(true);
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          rolePermissions: [
            { permission: { key: 'user.read' } },
            { permission: { key: 'orders.read' } },
          ],
        },
      },
    ]);

    tokenServiceMock.generateRefreshToken.mockResolvedValue('refresh-token');
    tokenServiceMock.verifyRefreshToken.mockResolvedValue({
      sessionId: 'session-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    tokenServiceMock.hashToken.mockReturnValue('refresh-hash');
    tokenServiceMock.generateAccessToken.mockResolvedValue('access-token');

    const result = await service.login(dto, meta);

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'demo@local.dev',
        name: 'Demo',
      },
    });

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: AuditEventType.LOGIN_SUCCESS }),
    );
  });

  it('refresh deve rotacionar sessão', async () => {
    tokenServiceMock.verifyRefreshToken.mockResolvedValue({
      sessionId: 'session-old',
      sub: 'user-1',
      appId: 'app-1',
      family: 'family-1',
    });
    tokenServiceMock.hashToken.mockReturnValue('hash-old');

    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-old',
      tokenHash: 'hash-old',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 300_000),
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'demo@local.dev',
      name: 'Demo',
    });

    prismaMock.userRole.findMany.mockResolvedValue([
      {
        role: {
          rolePermissions: [{ permission: { key: 'user.read' } }],
        },
      },
    ]);

    tokenServiceMock.generateRefreshToken.mockResolvedValue('refresh-new');
    tokenServiceMock.verifyRefreshToken.mockResolvedValueOnce({
      sessionId: 'session-old',
      sub: 'user-1',
      appId: 'app-1',
      family: 'family-1',
    });
    tokenServiceMock.verifyRefreshToken.mockResolvedValueOnce({
      sessionId: 'session-new',
      sub: 'user-1',
      appId: 'app-1',
      family: 'family-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    tokenServiceMock.generateAccessToken.mockResolvedValue('access-new');
    tokenServiceMock.hashToken.mockReturnValueOnce('hash-old').mockReturnValueOnce('hash-new');

    const result = await service.refresh('refresh-old', meta);

    expect(prismaMock.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session-old' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prismaMock.refreshSession.create).toHaveBeenCalled();
    expect(result).toEqual({ accessToken: 'access-new', refreshToken: 'refresh-new' });
  });

  it('refresh reutilizado deve revogar família e lançar erro 401', async () => {
    tokenServiceMock.verifyRefreshToken.mockResolvedValue({
      sessionId: 'session-1',
      sub: 'user-1',
      appId: 'app-1',
      family: 'family-1',
    });
    tokenServiceMock.hashToken.mockReturnValue('hash-sent');
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tokenHash: 'hash-original',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 300_000),
    });

    await expect(service.refresh('refresh-reused', meta)).rejects.toThrow(UnauthorizedException);

    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { family: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ type: AuditEventType.REFRESH_REUSE_DETECTED }),
    );
  });
});
