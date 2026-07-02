import { FastifyInstance } from 'fastify';

export function initializeRequestHooks(app: FastifyInstance) {
  app.addHook('onRequest', async (request) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
      },
      'incoming request',
    );
  });
}
