import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
config({path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true});
export const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));
export const env = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().default(3001),
  HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development','test','production']).default('development'),
}).parse(process.env);
