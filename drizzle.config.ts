import { defineConfig } from 'drizzle-kit';

function cleanDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return url;
  }
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  throw new Error('DATABASE_URL is required to run drizzle commands');
}

export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: cleanDbUrl(raw),
    ssl: 'require',
  },
});
