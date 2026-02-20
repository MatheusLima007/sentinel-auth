import { Request } from 'express';

export type AuthenticatedUser = {
  sub: string;
  appId: string;
  email?: string;
  permissions?: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  correlationId?: string;
};
