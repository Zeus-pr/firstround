import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(__dirname, '../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { validateEnv } from './env.js';

async function main() {
  validateEnv();
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.PORT ?? 4000);
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`First Round API on http://localhost:${port}`);
}

void main();
