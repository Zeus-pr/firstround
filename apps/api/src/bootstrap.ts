import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import { webOrigins } from './env.js';

export const isProd = () => process.env.NODE_ENV === 'production';

/** Shared app configuration used by main.ts and tests. */
export function configureApp(app: INestApplication) {
  const server = app.getHttpAdapter().getInstance() as Express;
  // Railway sits behind a reverse proxy; trust one hop in production so rate limits see real client IPs.
  server.set('trust proxy', process.env.TRUST_PROXY ?? (isProd() ? 1 : 'loopback'));
  server.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd() ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  app.enableCors({
    origin: webOrigins(),
    credentials: true,
  });

  return app;
}
