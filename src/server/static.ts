import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { registry } from '../lib/catalog.js';
export async function registerGames(app: FastifyInstance) {
  for (const game of registry)
    app.get(`/oyunlar/${game.slug}`, async (request, reply) => {
      const query = request.url.includes('?')
        ? request.url.slice(request.url.indexOf('?'))
        : '';
      return reply
        .code(308)
        .header('location', `/oyunlar/${game.slug}/${query}`)
        .send();
    });
  await app.register(fastifyStatic, {
    root: resolve('dist/games'),
    prefix: '/oyunlar/',
    decorateReply: false,
    index: ['index.html'],
    redirect: false,
    etag: true,
    lastModified: true,
    cacheControl: true,
    maxAge: 0,
    immutable: false,
    dotfiles: 'deny',
    setHeaders(res) {
      // Unversioned game modules must be revalidated even if a CDN raises max-age.
      res.header(
        'Cache-Control',
        'public, no-cache, max-age=0, must-revalidate',
      );
    },
  });
}
