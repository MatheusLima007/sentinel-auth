import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  static handle(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    const headerCorrelationId = req.header('x-correlation-id');
    const correlationId = headerCorrelationId || randomUUID();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }

  use(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    CorrelationIdMiddleware.handle(req, res, next);
  }
}
