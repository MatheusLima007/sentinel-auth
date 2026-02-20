import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { PrismaModule } from './common/prisma.module';
import { RedisThrottlerStorage } from './common/redis-throttler.storage';
import { HealthModule } from './health/health.module';
import { RbacModule } from './rbac/rbac.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
          remove: true,
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            correlationId: req.headers['x-correlation-id'],
          }),
        },
        ...(process.env.NODE_ENV !== 'production'
          ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
          : {}),
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = new Redis(configService.getOrThrow<string>('REDIS_URL'));

        return {
          throttlers: [
            {
              ttl: 60_000,
              limit: 30,
              blockDuration: 60_000,
            },
          ],
          storage: new RedisThrottlerStorage(redis),
        };
      },
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    RbacModule,
    SessionsModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware.handle).forRoutes('*');
  }
}
