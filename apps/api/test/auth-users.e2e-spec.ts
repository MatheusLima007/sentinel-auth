import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/rbac/permissions.guard';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

describe('Auth + Users (e2e)', () => {
  let app: INestApplication;

  const authServiceMock = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
  };

  const usersServiceMock = {
    getMe: jest.fn(),
  };

  const jwtGuardMock = {
    canActivate: (context: ExecutionContext) => {
      const requestContext = context.switchToHttp().getRequest<{
        user?: { sub: string; appId: string; permissions: string[] };
      }>();
      requestContext.user = {
        sub: 'user-1',
        appId: 'app-1',
        permissions: ['user.read'],
      };
      return true;
    },
  };

  const permissionsGuardMock = {
    canActivate: () => true,
  };

  beforeEach(async () => {
    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    });

    moduleFixtureBuilder.overrideGuard(JwtAuthGuard).useValue(jwtGuardMock);
    moduleFixtureBuilder.overrideGuard(PermissionsGuard).useValue(permissionsGuardMock);

    const moduleFixture: TestingModule = await moduleFixtureBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('/auth/login (POST) deve delegar para AuthService.login', async () => {
    authServiceMock.login.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'demo@local.dev', name: 'Demo' },
    });

    const body = {
      email: 'demo@local.dev',
      password: 'Demo@12345',
      appId: 'demo-web',
    };

    const response = await request(app.getHttpServer()).post('/auth/login').send(body).expect(200);

    expect(authServiceMock.login).toHaveBeenCalledWith(
      body,
      expect.objectContaining({
        ip: expect.any(String),
        correlationId: undefined,
      }),
    );

    expect(response.body).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    );
  });

  it('/me (GET) deve delegar para UsersService.getMe com contexto do usuário autenticado', async () => {
    usersServiceMock.getMe.mockResolvedValueOnce({
      user: {
        id: 'user-1',
        name: 'Demo',
        email: 'demo@local.dev',
        status: 'ACTIVE',
      },
      appId: 'app-1',
      permissions: ['user.read'],
    });

    const response = await request(app.getHttpServer()).get('/me').expect(200);

    expect(usersServiceMock.getMe).toHaveBeenCalledWith({
      userId: 'user-1',
      appId: 'app-1',
      permissions: ['user.read'],
    });

    expect(response.body).toEqual(
      expect.objectContaining({
        appId: 'app-1',
        permissions: ['user.read'],
      }),
    );
  });

  it('/auth/refresh (POST) deve retornar erro padronizado sem bearer token', async () => {
    const response = await request(app.getHttpServer()).post('/auth/refresh').expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authorization bearer token não informado',
      }),
    );
  });
});
