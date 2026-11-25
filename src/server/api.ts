import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { catalogItems, decorate, type CatalogItem } from '../lib/catalog.js';
import { Database, HttpError } from './database.js';
import type { CatalogStore } from './catalog-store.js';
import type { Auth } from './auth.js';
// PostgreSQL integer sütunlarının üst sınırı; aşan değer 503 yerine 400 alır.
const version = z.number().int().nonnegative().max(2147483647);
export function registerAPI(
  app: FastifyInstance,
  store: CatalogStore,
  auth: Auth,
  db?: Database,
) {
  app.get('/api/v1/catalog', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=0, must-revalidate');
    return {
      ...store.current,
      items: decorate(store.current.items.filter((i) => i.visible)),
    };
  });
  app.get('/api/v1/admin/catalog', async (req) => {
    await auth.require(req);
    return { ...(await db!.catalog()), published: store.current };
  });
  // The queue also orders durable snapshot writes after PostgreSQL transactions.
  let queue: Promise<unknown> = Promise.resolve();
  async function change(
    kind: 'save' | 'publish' | 'restore',
    req: Parameters<Auth['writable']>[0],
  ) {
    const actor = await auth.writable(req);
    const parsed = (
      kind === 'save'
        ? z.object({ version, items: catalogItems }).strict()
        : kind === 'restore'
          ? z.object({ version, revision: version }).strict()
          : z.object({ version }).strict()
    ).parse(req.body);
    const task = queue.then(async () => {
      const result = await db!.change(
        kind,
        parsed.version,
        actor.userId,
        'items' in parsed ? (parsed.items as CatalogItem[]) : undefined,
        'revision' in parsed ? (parsed.revision as number) : undefined,
      );
      if (result.snapshot) {
        try {
          await store.accept(result.snapshot);
        } catch {
          throw new HttpError(
            503,
            'Yayın veritabanına kaydedildi ancak katalog snapshot dosyası yazılamadı. Depolamayı kontrol edip sayfayı yenile.',
          );
        }
      }
      return { version: result.version, revision: result.snapshot?.revision };
    });
    queue = task.catch(() => {});
    return task;
  }
  app.patch('/api/v1/admin/catalog', (req) => change('save', req));
  app.post('/api/v1/admin/catalog/publish', (req) => change('publish', req));
  app.post('/api/v1/admin/catalog/restore', (req) => change('restore', req));
  app.get('/api/v1/admin/metrics', async (req) => {
    await auth.require(req);
    return {
      label: 'Oyun sayfası açılışı',
      timeZone: 'Europe/Istanbul',
      days: await db!.metrics(),
    };
  });
  app.get('/api/v1/admin/audit', async (req) => {
    await auth.require(req);
    return { entries: await db!.audit() };
  });
}
