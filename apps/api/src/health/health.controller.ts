import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('readiness')
  async readiness() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Dependências indisponíveis',
      });
    }
  }
}
