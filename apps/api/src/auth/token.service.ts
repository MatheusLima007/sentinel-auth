import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { AccessTokenClaims, RefreshTokenClaims } from './types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(payload: Omit<AccessTokenClaims, 'type'>) {
    const claims: AccessTokenClaims = { ...payload, type: 'access' };
    return this.jwtService.signAsync(claims, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TTL', '15m') as never,
    });
  }

  async generateRefreshToken(payload: Omit<RefreshTokenClaims, 'type'>) {
    const claims: RefreshTokenClaims = { ...payload, type: 'refresh' };
    return this.jwtService.signAsync(claims, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_TTL', '30d') as never,
    });
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService.verifyAsync<RefreshTokenClaims>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
