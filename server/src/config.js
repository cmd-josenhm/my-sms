import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://mysms:mysms@localhost:5433/mysms',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  tokenTtlMs: Number(process.env.TOKEN_TTL_DAYS || 30) * 24 * 60 * 60 * 1000,
  redisUrl: process.env.REDIS_URL || '',
  publicDir: path.resolve(__dirname, '../../client/dist'),
};

export const isProd = config.env === 'production';
