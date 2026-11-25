import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY wajib diisi'),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY harus berupa 64 karakter hex (32 bytes untuk AES-256)')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Konfigurasi Environment tidak valid:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;