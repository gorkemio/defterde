import type { FastifyInstance } from 'fastify';
import { registry } from '../lib/catalog.js';
import type { Database } from './database.js';
export const istanbulDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export function eligible(
  method: string,
  path: string,
  status: number,
  headers: Record<string, unknown>,
) {
  return (
    method === 'GET' &&
    status === 200 &&
    registry.some(
      (g) =>
        path === `/oyunlar/${g.slug}/` ||
        path === `/oyunlar/${g.slug}/index.html`,
    ) &&
    !/prefetch|prerender/i.test(
      String(headers.purpose || '') +
        ' ' +
        String(headers['sec-purpose'] || '') +
        ' ' +
        String(headers['x-purpose'] || '') +
        ' ' +
        String(headers['x-moz'] || ''),
    ) &&
    !/bot|crawler|spider|healthcheck/i.test(String(headers['user-agent'] || ''))
  );
}
export function registerMetrics(app: FastifyInstance, db?: Database) {
  const pending = new Map<string, number>();
  let flushing = false;
  app.addHook('onResponse', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (db && eligible(req.method, path, reply.statusCode, req.headers)) {
      const key = `${istanbulDay()}:${path.split('/')[2]}`;
      pending.set(key, (pending.get(key) || 0) + 1);
    }
  });
  const flush = async () => {
    if (flushing || !db) return;
    flushing = true;
    const batch = [...pending];
    pending.clear();
    try {
      for (const [key, count] of batch) {
        const [day, slug] = key.split(':');
        await db.count(day, slug, count);
      }
    } catch {
      app.log.warn(
        'Daily page totals could not be stored; this batch was dropped',
      );
    } finally {
      flushing = false;
    }
  };
  const timer = setInterval(() => void flush(), 10_000);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    await flush();
  });
  return flush;
}
