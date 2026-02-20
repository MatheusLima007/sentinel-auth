import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { LogoutAllDto } from './dto/logout-all.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    appId: string;
  };
  correlationId?: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refresh(@Headers('authorization') authorization: string | undefined, @Req() req: AuthenticatedRequest) {
    const refreshToken = this.extractBearerToken(authorization);
    return this.authService.refresh(refreshToken, this.extractMeta(req));
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Headers('authorization') authorization: string | undefined, @Req() req: AuthenticatedRequest) {
    const refreshToken = this.extractBearerToken(authorization);
    return this.authService.logout(refreshToken, this.extractMeta(req));
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logoutAll(@Body() dto: LogoutAllDto, @Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    const appId = dto.appId || req.user?.appId;

    if (!userId || !appId) {
      throw new UnauthorizedException('Contexto de usuário inválido');
    }

    return this.authService.logoutAll(userId, appId, this.extractMeta(req));
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization bearer token não informado');
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Bearer token inválido');
    }

    return token;
  }

  private extractMeta(req: AuthenticatedRequest) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    };
  }
}
