import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw = exception.getResponse();
    const message =
      typeof raw === 'object' && raw !== null && 'message' in raw
        ? (raw as Record<string, unknown>)['message']
        : exception.message;

    response.status(status).json({
      statusCode: status,
      ...(exception instanceof AppException ? { code: exception.code } : {}),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
