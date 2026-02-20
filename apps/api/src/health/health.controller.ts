import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Health check da aplicação' })
  @ApiOkResponse({ description: 'Aplicação saudável' })
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @ApiOperation({ summary: 'Readiness check das dependências' })
  @ApiOkResponse({ description: 'Dependências disponíveis' })
  @ApiServiceUnavailableResponse({ description: 'Dependência indisponível' })
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
