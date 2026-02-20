import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaMock as never);
  });

  it('deve retornar user, appId e permissions no /me', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Demo',
      email: 'demo@local.dev',
      status: 'ACTIVE',
    });

    const result = await service.getMe({
      userId: 'user-1',
      appId: 'app-1',
      permissions: ['user.read'],
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    expect(result).toEqual({
      user: {
        id: 'user-1',
        name: 'Demo',
        email: 'demo@local.dev',
        status: 'ACTIVE',
      },
      appId: 'app-1',
      permissions: ['user.read'],
    });
  });

  it('deve lançar UnauthorizedException quando contexto for inválido', async () => {
    await expect(
      service.getMe({
        userId: undefined,
        appId: 'app-1',
        permissions: ['user.read'],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
