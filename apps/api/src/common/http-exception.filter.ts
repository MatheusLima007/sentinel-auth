import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;

    const parsed = this.parseExceptionResponse(exceptionResponse, status);

    response.status(status).json({
      statusCode: status,
      code: parsed.code,
      message: parsed.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: request.correlationId,
    });
  }

  private parseExceptionResponse(
    exceptionResponse: string | object | undefined,
    status: number,
  ): { code: string; message: string | string[] } {
    if (!exceptionResponse) {
      return {
        code: this.defaultCode(status),
        message: 'Erro interno do servidor',
      };
    }

    if (typeof exceptionResponse === 'string') {
      return {
        code: this.defaultCode(status),
        message: exceptionResponse,
      };
    }

    const responseObject = exceptionResponse as {
      code?: unknown;
      message?: unknown;
      error?: unknown;
    };

    const message =
      typeof responseObject.message === 'string' || Array.isArray(responseObject.message)
        ? responseObject.message
        : 'Erro inesperado';

    const code =
      typeof responseObject.code === 'string'
        ? responseObject.code
        : typeof responseObject.error === 'string'
          ? responseObject.error.toUpperCase().replace(/\s+/g, '_')
          : this.defaultCode(status);

    return { code, message };
  }

  private defaultCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
