import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const createContext = (permissions?: string[]) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            permissions,
          },
        }),
      }),
    }) as never;

  let guard: PermissionsGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsGuard(reflectorMock);
  });

  it('deve permitir quando rota não exige permissões', () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const canActivate = guard.canActivate(createContext(['user.read']));

    expect(canActivate).toBe(true);
  });

  it('deve bloquear quando usuário não possui todas as permissões', () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue(['sessions.revoke']);

    expect(() => guard.canActivate(createContext(['sessions.read']))).toThrow(ForbiddenException);
  });

  it('deve permitir quando usuário possui todas as permissões requeridas', () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue([
      'sessions.read',
      'sessions.revoke',
    ]);

    const canActivate = guard.canActivate(createContext(['sessions.read', 'sessions.revoke']));

    expect(canActivate).toBe(true);
  });
});
