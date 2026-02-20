import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const CORRELATION_ID_MAX_LENGTH = 64;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  static handle(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    const headerCorrelationId = req.header('x-correlation-id');
    const correlationId = CorrelationIdMiddleware.resolveCorrelationId(headerCorrelationId);

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }

  use(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    CorrelationIdMiddleware.handle(req, res, next);
  }

  private static resolveCorrelationId(headerCorrelationId?: string) {
    if (!headerCorrelationId) {
      return randomUUID();
    }

    const candidate = headerCorrelationId.trim();

    if (
      !candidate ||
      candidate.length > CORRELATION_ID_MAX_LENGTH ||
      !CORRELATION_ID_PATTERN.test(candidate)
    ) {
      return randomUUID();
    }

    return candidate;
  }
}
