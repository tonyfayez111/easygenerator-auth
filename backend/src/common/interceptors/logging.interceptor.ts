import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json(),
  ),
  transports: [new transports.Console()],
});

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        logger.info({
          message: `${method} ${url}`,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
        });
      }),
    );
  }
}
