import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/common/prisma.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('/health (GET) deve retornar status ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
  });

  it('/readiness (GET) deve retornar ready quando banco responde', async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer())
      .get('/readiness')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ready',
      }),
    );
  });

  it('/readiness (GET) deve retornar 503 quando dependência falha', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValueOnce(new Error('db down'));

    const response = await request(app.getHttpServer())
      .get('/readiness')
      .expect(503);

    expect(response.body.message).toEqual('Dependências indisponíveis');
  });
});
