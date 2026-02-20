import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();

  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy === 'true' ? 1 : trustProxy);
  }

  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins =
    corsOrigins.length > 0
      ? corsOrigins
      : ['http://localhost:3001', 'http://localhost:8081', 'http://localhost:19006'];

  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
