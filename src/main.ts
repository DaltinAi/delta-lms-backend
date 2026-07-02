process.loadEnvFile?.();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCors from '@fastify/cors';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './utils/http-exception';
import fastifyMultipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import { randomUUID } from 'crypto';
import { initializeRequestHooks } from './utils/logger';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV === 'development',
      trustProxy: true,
      genReqId: () => randomUUID(),
    }),
    {
      logger:
        process.env.NODE_ENV === 'development'
          ? ['debug', 'error', 'warn']
          : ['error', 'warn'],
    },
  );

  initializeRequestHooks(app.getHttpAdapter().getInstance());

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'cdn.jsdelivr.net'],
      },
    },
    frameguard: { action: 'sameorigin' },
  });

  const options = new DocumentBuilder()
    .setTitle('Delta CRM API')
    .setDescription('Delta CRM API Documentation')
    .setVersion('1.0')
    .addServer('http://localhost:5000/', 'Local environment')
    .addTag('Delta CRM')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);

  await app.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
    credentials: true,
    exposedHeaders: ['Authorization'],
    preflight: true,
    optionsSuccessStatus: 204,
  });

  await app.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1048576,
      fields: 10,
      fileSize: 5242880,
      files: 1,
      headerPairs: 2000,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = Number(process.env.PORT) || 8080;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
