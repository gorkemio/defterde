import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  Database,
  HttpError,
  OAUTH_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from './database.js';
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
const equal = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export interface AuthConfig {
  origin: string;
  secure: boolean;
  clientId?: string;
  clientSecret?: string;
  ownerId?: string;
}
export type GitHubIdentity = (
  code: string,
  verifier: string,
) => Promise<string>;
export function githubIdentity(config: AuthConfig): GitHubIdentity {
  return async (code, verifier) => {
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: `${config.origin}/auth/github/callback`,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    // GitHub hatalı kodda da 200 ve {"error": ...} döndürebilir.
    const token = z
      .object({ access_token: z.string().min(1) })
      .safeParse(await tokenResponse.json().catch(() => null));
    if (!tokenResponse.ok || !token.success)
      throw new HttpError(
        502,
        'GitHub giriş doğrulaması başarısız. Girişi yeniden başlat.',
      );
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.data.access_token}`,
        'User-Agent': 'Defterde',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok)
      throw new HttpError(502, 'GitHub hesabı doğrulanamadı.');
    const user = z
      .object({ id: z.number().int().positive() })
      .parse(await userResponse.json());
    return String(user.id);
  };
}
export class Auth {
  ready: boolean;
  cookieName: string;
  constructor(
    public db: Database | undefined,
    public config: AuthConfig,
    public identity: GitHubIdentity = githubIdentity(config),
  ) {
    this.ready = !!(
      db &&
      config.clientId &&
      config.clientSecret &&
      config.ownerId &&
      /^\d+$/.test(config.ownerId)
    );
    this.cookieName = config.secure ? '__Host-defterde' : 'defterde-session';
  }
  async optional(req: FastifyRequest) {
    if (!this.ready) return;
    const token = req.cookies[this.cookieName];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    const session = await this.db!.session(digest(token));
    if (session?.userId === this.config.ownerId)
      return { userId: session.userId, csrf: session.csrf, hash: session.hash };
  }
  async require(req: FastifyRequest) {
    const session = await this.optional(req);
    if (!session) throw new HttpError(401, 'Yönetici girişi gerekli.');
    return session;
  }
  async writable(req: FastifyRequest) {
    const session = await this.require(req);
    const token = req.headers['x-csrf-token'];
    if (
      req.headers.origin !== this.config.origin ||
      typeof token !== 'string' ||
      !equal(token, session.csrf)
    )
      throw new HttpError(
        403,
        'İstek doğrulanamadı. Yönetim sayfasını yenileyip tekrar dene.',
      );
    return session;
  }
  cookie(
    reply: FastifyReply,
    name: string,
    value: string,
    maxAge: number,
    path = '/',
  ) {
    reply.setCookie(name, value, {
      path,
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      maxAge,
    });
  }
  register(app: FastifyInstance) {
    // İstemci IP'si yalnız TRUST_PROXY ayarlıysa vekil başlığından okunur.
    const rate = { rateLimit: { max: 10, timeWindow: '1 minute' } };
    app.get('/auth/github', { config: rate }, async (_req, reply) => {
      if (!this.ready)
        throw new HttpError(503, 'Yönetici girişi henüz yapılandırılmadı.');
      const state = random(),
        verifier = random();
      await this.db!.createOAuth(digest(state), verifier);
      this.cookie(reply, 'defterde-oauth', state, OAUTH_TTL_SECONDS, '/auth');
      const url = new URL('https://github.com/login/oauth/authorize');
      url.search = new URLSearchParams({
        client_id: this.config.clientId!,
        redirect_uri: `${this.config.origin}/auth/github/callback`,
        state,
        code_challenge: createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
        allow_signup: 'false',
        scope: '',
      }).toString();
      return reply.redirect(url.href);
    });
    app.get('/auth/github/callback', { config: rate }, async (req, reply) => {
      if (!this.ready)
        throw new HttpError(503, 'Yönetici girişi henüz yapılandırılmadı.');
      const { code, state } = z
        .object({
          code: z.string().min(1).max(512),
          state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        })
        .parse(req.query);
      const cookie = req.cookies['defterde-oauth'];
      reply.clearCookie('defterde-oauth', {
        path: '/auth',
        secure: this.config.secure,
        httpOnly: true,
        sameSite: 'lax',
      });
      if (!cookie || !equal(cookie, state))
        throw new HttpError(
          403,
          'Giriş doğrulaması geçersiz. GitHub girişini yeniden başlat.',
        );
      const stored = await this.db!.consumeOAuth(digest(state));
      if (!stored)
        throw new HttpError(
          403,
          'Giriş doğrulamasının süresi doldu veya daha önce kullanıldı.',
        );
      const userId = await this.identity(code, stored.verifier);
      if (userId !== this.config.ownerId)
        throw new HttpError(403, 'Bu hesap yönetim alanına yetkili değil.');
      const token = random(),
        csrf = random();
      await this.db!.createSession(digest(token), userId, csrf);
      this.cookie(reply, this.cookieName, token, SESSION_TTL_SECONDS);
      return reply.redirect('/yonetim/');
    });
    app.post('/auth/logout', async (req, reply) => {
      const session = await this.writable(req);
      await this.db!.logout(session.hash, session.userId);
      reply.clearCookie(this.cookieName, {
        path: '/',
        secure: this.config.secure,
        httpOnly: true,
        sameSite: 'lax',
      });
      return { ok: true };
    });
  }
}
