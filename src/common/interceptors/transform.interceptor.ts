import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  statusCode: number;
  message: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();

        // If the controller already returned an object with status, message, and data
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'status' in data
        ) {
          return {
            statusCode: data.status,
            message: data.message || 'Success',
            data: data.data,
            timestamp: new Date().toISOString(),
          };
        }

        // Default transformation
        return {
          statusCode: response.statusCode,
          message: data?.message || 'Success',
          data: data?.message && Object.keys(data).length === 1 ? null : data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
