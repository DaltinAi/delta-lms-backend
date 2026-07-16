import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const { method, originalUrl, body, query, params, ip } = req;

    // Log Request
    const requestMessage = `Incoming Request: ${method} ${originalUrl} - IP: ${ip}`;
    this.logger.log(requestMessage);

    if (Object.keys(body).length) {
      this.logger.debug(`Body: ${JSON.stringify(body)}`);
    }
    if (Object.keys(query).length) {
      this.logger.debug(`Query: ${JSON.stringify(query)}`);
    }
    if (Object.keys(params).length) {
      this.logger.debug(`Params: ${JSON.stringify(params)}`);
    }

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const res = ctx.getResponse();
          const delay = Date.now() - now;
          this.logger.log(
            `Outgoing Response: ${method} ${originalUrl} - Status: ${res.statusCode} - Time: ${delay}ms`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `Error Response: ${method} ${originalUrl} - Status: ${error?.status || 500} - Time: ${delay}ms`,
            error.stack,
          );
        },
      }),
    );
  }
}
