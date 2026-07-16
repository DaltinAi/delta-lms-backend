import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from './logger';

interface ErrorResponse {
  statusCode: number;
  message: string;
  errorCode?: string;
  details?: any;
  timestamp: string;
  path?: string;
}

export class AppException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    private readonly errorCode?: string,
    private readonly details?: any,
    private readonly requestId?: string,
  ) {
    super(
      {
        message,
        statusCode,
        errorCode,
        details,
        requestId,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const userInput = {
      body: request.body,
      query: request.query,
      params: request.params,
    };
    let statusCode: number;
    let payload: Record<string, any> = {};
    const timestamp = new Date().toISOString();

    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as any;
      payload = {
        statusCode,
        message: res.message,
        errorCode: res.errorCode,
        details: res.details,
        timestamp: res.timestamp || timestamp,
        path: request?.url || undefined,
        input: userInput,
        requestId: res.requestId || request.id,
      };
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as any;
      payload = {
        statusCode,
        message:
          typeof res === 'string' ? res : res.message || 'Unexpected error',
        errorCode:
          typeof res === 'object' && res.errorCode
            ? res.errorCode
            : `ERR_DELTA_${statusCode}`,
        timestamp,
        path: request?.url || undefined,
        input: userInput,
        requestId: res.requestId || request.id,
      };
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      payload = {
        statusCode,
        message: 'Internal server error',
        input: userInput,
        timestamp,
        path: request?.url || undefined,
        details:
          process.env.NODE_ENV === 'production'
            ? undefined
            : exception instanceof Error
              ? exception.stack
              : String(exception),
        requestId: request.id,
      };
    }

    Logger.error(`[${statusCode}] ${payload.message}`, JSON.stringify(payload));
    const anyRes: any = response;

    if (
      anyRes &&
      typeof anyRes.code === 'function' &&
      typeof anyRes.send === 'function'
    ) {
      anyRes.code(statusCode).send(payload);
      return;
    }

    if (
      anyRes &&
      typeof anyRes.status === 'function' &&
      typeof anyRes.json === 'function'
    ) {
      anyRes.status(statusCode).json(payload);
      return;
    }

    const raw = anyRes && (anyRes.raw || anyRes.req || anyRes._originalRes);
    if (
      raw &&
      typeof raw.writeHead === 'function' &&
      typeof raw.end === 'function'
    ) {
      raw.writeHead(statusCode, { 'Content-Type': 'application/json' });
      raw.end(JSON.stringify(payload));
      return;
    }

    if (
      anyRes &&
      typeof anyRes.writeHead === 'function' &&
      typeof anyRes.end === 'function'
    ) {
      anyRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
      anyRes.end(JSON.stringify(payload));
      return;
    }

    if (typeof anyRes.send === 'function') {
      anyRes.send(payload);
      return;
    }
    if (typeof anyRes.json === 'function') {
      anyRes.json(payload);
      return;
    }

    Logger.error('Unable to send error response: unknown response adapter', {
      adapter: typeof anyRes,
    });
  }
}
