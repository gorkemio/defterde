import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function migrate(url: string) {
  const client = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    await client.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(7524041)`;
      await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
      for (const name of (await readdir('deploy/migrations'))
        .filter((f) => f.endsWith('.sql'))
        .sort()) {
        const source = await readFile(`deploy/migrations/${name}`, 'utf8'),
          checksum = createHash('sha256').update(source).digest('hex');
        const [old] =
          await tx`SELECT checksum FROM schema_migrations WHERE name=${name}`;
        if (old) {
          if (old.checksum !== checksum)
            throw new Error(`Migration checksum changed: ${name}`);
          continue;
        }
        await tx.unsafe(source);
        await tx`INSERT INTO schema_migrations (name,checksum) VALUES (${name},${checksum})`;
      }
    });
  } finally {
    await client.end({ timeout: 2 });
  }
}
if (
  process.argv[1]?.endsWith('/migrate.js') ||
  process.argv[1]?.endsWith('/migrate.ts')
) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL gerekli');
  await migrate(process.env.DATABASE_URL);
  console.log('Migrations applied');
}
