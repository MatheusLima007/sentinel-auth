export interface AccessTokenClaims {
  sub: string;
  email: string;
  appId: string;
  permissions: string[];
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenClaims {
  sub: string;
  sessionId: string;
  appId: string;
  family: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}
