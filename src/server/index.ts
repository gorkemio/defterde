import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createApp, type SSR } from './app.js';
import { Database } from './database.js';
import { CatalogStore } from './catalog-store.js';
import { migrate } from './migrate.js';
const origin = new URL(process.env.PUBLIC_ORIGIN || 'http://localhost:4321')
  .origin;
if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))
  throw new Error('Production PUBLIC_ORIGIN must use HTTPS');
const store = new CatalogStore(
  resolve(process.env.SNAPSHOT_DIR || 'var', 'catalog.json'),
);
await store.load();
const db = process.env.DATABASE_URL
  ? new Database(process.env.DATABASE_URL)
  : undefined;
// TRUST_PROXY: boş → kapalı, sayı → güvenilen vekil hop sayısı, diğer → IP/CIDR listesi.
function parseTrustProxy(value?: string) {
  if (!value) return false;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    return (_address: string, hop: number) => hop < hops;
  }
  return value;
}
let initialized = false;
let lastCleanup = 0;
async function refresh() {
  if (!db) return;
  try {
    if (!initialized) {
      await migrate(process.env.DATABASE_URL!);
      await db.initialize();
      initialized = true;
    }
    // Veritabanı erişilebilirken yayımlanmış katalog için tek doğruluk kaynağıdır.
    await store.sync(() => db.published());
    if (Date.now() - lastCleanup > 3_600_000) {
      await db.cleanup();
      lastCleanup = Date.now();
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Migration checksum changed'))
      console.error(`${message}; migrations were not applied`);
    else
      console.warn(
        `Database unavailable (${name}); serving last saved catalog and static games`,
      );
  }
}
await refresh();
const { handler } = (await import(
  pathToFileURL(resolve('dist/site/server/entry.mjs')).href
)) as { handler: SSR };
const app = await createApp({
  db,
  store,
  ssr: handler,
  logger: true,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  auth: {
    origin,
    secure: origin.startsWith('https://'),
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    ownerId: process.env.GITHUB_OWNER_ID,
  },
});
const interval = setInterval(() => void refresh(), 30_000);
interval.unref();
await app.listen({
  port: Number(process.env.PORT || 4321),
  host: process.env.HOST || '127.0.0.1',
});
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    clearInterval(interval);
    void app
      .close()
      .then(() => db?.close())
      .then(() => process.exit(0));
  });
