import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });

    return this.assertAccessClaims(payload);
  }

  async verifyRefreshToken(token: string) {
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });

    return this.assertRefreshClaims(payload);
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertAccessClaims(payload: unknown): AccessTokenClaims {
    const claims = this.assertJwtObject(payload);

    if (claims.type !== 'access') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Access token inválido',
      });
    }

    this.assertStringClaim(claims.sub, 'sub');
    this.assertStringClaim(claims.email, 'email');
    this.assertStringClaim(claims.appId, 'appId');

    if (
      !Array.isArray(claims.permissions) ||
      claims.permissions.some((permission) => typeof permission !== 'string')
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_CLAIMS',
        message: 'Claims de access token inválidas',
      });
    }

    return claims as AccessTokenClaims;
  }

  private assertRefreshClaims(payload: unknown): RefreshTokenClaims {
    const claims = this.assertJwtObject(payload);

    if (claims.type !== 'refresh') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Refresh token inválido',
      });
    }

    this.assertStringClaim(claims.sub, 'sub');
    this.assertStringClaim(claims.sessionId, 'sessionId');
    this.assertStringClaim(claims.appId, 'appId');
    this.assertStringClaim(claims.family, 'family');

    return claims as RefreshTokenClaims;
  }

  private assertJwtObject(payload: unknown): Record<string, any> {
    if (!payload || typeof payload !== 'object') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_CLAIMS',
        message: 'Formato de token inválido',
      });
    }

    return payload as Record<string, any>;
  }

  private assertStringClaim(value: unknown, claimName: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_CLAIMS',
        message: `Claim ${claimName} inválida`,
      });
    }
  }
}
