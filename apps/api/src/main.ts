import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import { createCorsOriginValidator, resolveAllowedOrigins } from './common/utils/cors';
import { resolveUploadsDir } from './common/utils/uploads';
import { initApiSentry } from './common/monitoring/sentry';

if (initApiSentry()) {
  console.log('✅ Sentry error monitoring initialized');
}

async function bootstrap() {
  // Validate critical environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'GOOGLE_GENERATIVE_AI_API_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName]?.includes('PLACEHOLDER'),
  );

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing or invalid required environment variables:');
    missingEnvVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please check your .env.local file and ensure all required variables are set.');
    process.exit(1);
  }

  const fastifyAdapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  // Enable global validation pipe with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Enable transformation
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert types
      },
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: false, // Don't throw error for extra properties
    }),
  );

  // Register CORS plugin with strict origin allowlist
  const allowedOrigins = resolveAllowedOrigins();

  await app.register(fastifyCors as any, {
    origin: createCorsOriginValidator(allowedOrigins),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Device-Model',
      'X-OS-Version',
      'X-App-Version',
      'X-Platform',
    ],
  });

  // Register multipart for file uploads
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Serve static files (profile pictures, etc.) from persistent uploads root
  const uploadsPath = resolveUploadsDir();
  await app.register(fastifyStatic as any, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
    setHeaders: (res: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  // Serve public files (HTML pages, etc.)
  const publicPath = join(process.cwd(), 'public');
  await app.register(fastifyStatic as any, {
    root: publicPath,
    prefix: '/public/',
    decorateReply: false,
  });

  const port = process.env.PORT || 4000;
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';

  if (swaggerEnabled) {
    // Swagger/OpenAPI Documentation (disabled in production by default)
    const config = new DocumentBuilder()
      .setTitle('Wellness API')
      .setDescription("Women's Wellness Companion API")
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 API Server running on http://localhost:${port}`);
  if (swaggerEnabled) {
    console.log(`📚 API Documentation available at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
