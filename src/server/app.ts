import Fastify, { LogController } from 'fastify';
import cookie from '@fastify/cookie';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import compression from 'compression';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { registerGames } from './static.js';
import { registerMetrics } from './metrics.js';
import { registerAPI } from './api.js';
import { Auth, type AuthConfig, type GitHubIdentity } from './auth.js';
import { Database, HttpError } from './database.js';
import { CatalogStore } from './catalog-store.js';
import { registry } from '../lib/catalog.js';
// Log satırlarına yalnız hata sınıfı yazılır; mesajlar bağlantı dizesi gibi sırlar içerebilir.
const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error;
export type SSR = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (err?: unknown) => void,
  locals?: object,
) => Promise<void> | void;
export async function createApp(options: {
  db?: Database;
  store: CatalogStore;
  auth: AuthConfig;
  identity?: GitHubIdentity;
  ssr?: SSR;
  logger?: boolean;
  /** Fastify trustProxy: güvenilen ters vekil hop sayısı veya CIDR listesi. */
  trustProxy?: boolean | string | ((address: string, hop: number) => boolean);
}) {
  const { db, store } = options;
  const app = Fastify({
    logger: options.logger
      ? { level: 'info', redact: ['req', 'res', 'headers', 'body', 'err'] }
      : false,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: options.trustProxy ?? false,
    bodyLimit: 32 * 1024,
  });
  const auth = new Auth(db, options.auth, options.identity);
  await app.register(cookie);
  await app.register(compress, { global: true, threshold: 512 });
  await app.register(rateLimit, { global: false });
  const publicCSP =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  // Oyunlar bağımsız belgelerdir; kendi betik/stil kaynaklarını kırmayan asgari politika.
  const gameCSP = "object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (options.auth.secure)
      reply.header('Strict-Transport-Security', 'max-age=31536000');
    reply.header(
      'Content-Security-Policy',
      req.url.startsWith('/oyunlar/') ? gameCSP : publicCSP,
    );
    if (
      req.url.startsWith('/api/v1/admin') ||
      req.url.startsWith('/auth/') ||
      req.url.startsWith('/yonetim')
    )
      reply
        .header('Cache-Control', 'no-store')
        .header('X-Robots-Tag', 'noindex, nofollow');
  });
  registerMetrics(app, db);
  await registerGames(app);
  await app.register(fastifyStatic, {
    root: resolve('dist/site/client'),
    prefix: '/',
    decorateReply: false,
    wildcard: false,
    index: false,
    dotfiles: 'deny',
    maxAge: 0,
    etag: true,
    setHeaders(reply, path) {
      reply.header(
        'Cache-Control',
        path.includes('/_astro/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      );
    },
  });
  app.get('/healthz', () => ({ status: 'ok' }));
  registerAPI(app, store, auth, db);
  auth.register(app);
  const pages = [
    '/',
    '/nasil-oynanir/',
    '/hakkinda/',
    '/gizlilik/',
    '/kaynaklar/',
    ...registry.map((g) => `/nasil-oynanir/${g.slug}/`),
    ...registry.map((g) => `/oyunlar/${g.slug}/`),
  ];
  app.get('/robots.txt', (_req, reply) =>
    reply
      .type('text/plain')
      .send(
        `User-agent: *\nAllow: /\nDisallow: /yonetim/\nDisallow: /api/\nDisallow: /auth/\nSitemap: ${options.auth.origin}/sitemap.xml\n`,
      ),
  );
  app.get('/sitemap.xml', (_req, reply) =>
    reply
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((p) => `<url><loc>${options.auth.origin}${p}</loc></url>`).join('')}</urlset>`,
      ),
  );
  const htmlCompress = compression({ threshold: 512 });
  app.setNotFoundHandler(async (req, reply) => {
    if (
      req.url.startsWith('/oyunlar/') ||
      req.url.startsWith('/api/') ||
      req.url.startsWith('/auth/') ||
      req.url.startsWith('/assets/') ||
      req.url.startsWith('/_astro/')
    )
      return reply.code(404).send({ error: 'Sayfa bulunamadı.' });
    if (!['GET', 'HEAD'].includes(req.method))
      return reply.code(405).send({ error: 'Bu yöntem desteklenmiyor.' });
    const path = req.url.split('?')[0];
    if (!path.endsWith('/') && !path.includes('.')) {
      // "//ornek.com" gibi yollar protokol-göreli dış adrese dönüşmesin.
      const target = new URL(
        path.replace(/^[/\\]+/, '/') + '/',
        options.auth.origin,
      );
      if (target.origin !== new URL(options.auth.origin).origin)
        return reply.code(404).send({ error: 'Sayfa bulunamadı.' });
      const query = req.url.includes('?')
        ? '?' + req.url.split('?').slice(1).join('?')
        : '';
      return reply
        .code(308)
        .header('location', target.pathname + query)
        .send();
    }
    if (!options.ssr)
      return reply.code(404).send({ error: 'Sayfa bulunamadı.' });
    let admin: Awaited<ReturnType<Auth['optional']>>;
    let draft: import('../lib/catalog.js').CatalogItem[] | undefined;
    if (path.startsWith('/yonetim/')) {
      try {
        admin = await auth.optional(req);
        if (admin && path === '/yonetim/onizleme/')
          draft = (await db!.catalog()).draft;
      } catch {
        throw new HttpError(
          503,
          'Yönetim veritabanına erişilemiyor. Oyunlar açık; lütfen daha sonra tekrar dene.',
        );
      }
    }
    reply.header(
      'Cache-Control',
      path.startsWith('/yonetim/')
        ? 'no-store'
        : 'public, max-age=0, must-revalidate',
    );
    for (const [key, value] of Object.entries(reply.getHeaders()))
      if (value !== undefined) reply.raw.setHeader(key, value);
    reply.raw.statusCode = 200;
    reply.hijack();
    htmlCompress(
      req.raw as Parameters<typeof htmlCompress>[0],
      reply.raw as Parameters<typeof htmlCompress>[1],
      () => {
        const fail = (error?: unknown) => {
          if (error) app.log.error({ name: errorName(error) }, 'SSR failed');
          if (reply.raw.writableEnded) return;
          if (!reply.raw.headersSent) {
            reply.raw.statusCode = error ? 500 : 404;
            reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
          }
          reply.raw.end(
            error
              ? 'Sayfa şu anda gösterilemiyor. Lütfen tekrar dene.'
              : 'Sayfa bulunamadı.',
          );
        };
        Promise.resolve(
          options.ssr!(req.raw, reply.raw, fail, {
            catalog: store.current,
            origin: options.auth.origin,
            // Oturum özeti SSR'a gerekmez; yalnız sayfanın kullandığı alanlar.
            admin: admin && { userId: admin.userId, csrf: admin.csrf },
            draft,
            authReady: auth.ready,
          }),
        ).catch(fail);
      },
    );
  });
  app.setErrorHandler((error, _req, reply) => {
    const status =
      error instanceof HttpError
        ? error.statusCode
        : error instanceof ZodError
          ? 400
          : typeof (error as { statusCode?: unknown }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : 503; // Beklenmeyen hatalar burada çoğunlukla veritabanı kesintisidir.
    if (status >= 500)
      app.log.error({ name: errorName(error) }, 'Request failed');
    return reply
      .code(status)
      .header('Cache-Control', 'no-store')
      .send({
        error:
          error instanceof HttpError
            ? error.message
            : status === 400
              ? 'Gönderilen bilgiler geçersiz.'
              : status === 429
                ? 'Çok fazla deneme. Biraz sonra tekrar dene.'
                : status === 404
                  ? 'Sayfa bulunamadı.'
                  : status === 413
                    ? 'Gönderilen içerik çok büyük.'
                    : status === 415
                      ? 'Bu içerik türü desteklenmiyor.'
                      : status < 500
                        ? 'İstek işlenemedi.'
                        : 'Hizmete şu anda erişilemiyor. Lütfen tekrar dene.',
      });
  });
  return app;
}
