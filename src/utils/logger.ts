import * as winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { FastifyInstance } from 'fastify';

interface RequestContext {
  requestId: string;
}
export const requestContext = new AsyncLocalStorage<RequestContext>();

// Attach requestId to log entries
const addRequestContext = winston.format((info) => {
  const context = requestContext.getStore();
  if (context) {
    info.requestId = context.requestId;
  }
  return info;
});

// Color-coded console format (pretty)
const colorConsoleFormat = winston.format.combine(
  addRequestContext(),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
    const reqPart = requestId ? `[reqId=${requestId}]` : '';
    const metaPart = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${reqPart} ${message} ${metaPart}`;
  }),
);

const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console({
      format: colorConsoleFormat,
    }),

    // Example: file logs remain JSON (for production aggregation)
    // new winston.transports.File({
    //   filename: 'logs/combined.log',
    //   format: winston.format.combine(
    //     addRequestContext(),
    //     winston.format.timestamp(),
    //     winston.format.json(),
    //   ),
    // }),
  ],
});

export const Logger = {
  log: (message: string, meta?: any) => {
    logger.log('info', message, meta);
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  error: (message: string, meta?: any) => {
    logger.error(message, meta);
  },

  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
};

export const initializeRequestHooks = (app: FastifyInstance) => {
  app.addHook('onRequest', (request, reply, done) => {
    requestContext.run({ requestId: request.id }, () => {
      done();
    });
  });
};
