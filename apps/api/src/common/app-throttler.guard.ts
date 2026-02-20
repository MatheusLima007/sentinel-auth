import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type ThrottlerRequestLike = {
  method?: string;
  route?: {
    path?: string;
  };
  path?: string;
  originalUrl?: string;
  body?: {
    email?: unknown;
  };
  ip?: string;
};

const LOGIN_ROUTE = '/auth/login';

export function resolveThrottleTracker(request: ThrottlerRequestLike) {
  const method = request.method?.toUpperCase();
  const routePath = request.route?.path;
  const path = request.path || request.originalUrl || routePath;

  if (method === 'POST' && path?.startsWith(LOGIN_ROUTE)) {
    const email = request.body?.email;

    if (typeof email === 'string' && email.trim()) {
      return `login-email:${email.trim().toLowerCase()}`;
    }
  }

  return request.ip || 'unknown';
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>) {
    return resolveThrottleTracker(req as ThrottlerRequestLike);
  }
}
