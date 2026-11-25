import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, gt, desc, and, lt, sql } from 'drizzle-orm';
import {
  catalogState,
  revisions,
  sessions,
  oauthStates,
  dailyOpens,
  audit,
} from './schema.js';
import {
  persistedCatalogItems,
  seed,
  type CatalogItem,
  type Snapshot,
} from '../lib/catalog.js';
/** Yönetici oturumu ve OAuth durumu ömürleri (saniye). */
export const SESSION_TTL_SECONDS = 8 * 3600;
export const OAUTH_TTL_SECONDS = 600;
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export class Database {
  client;
  db;
  constructor(url: string) {
    this.client = postgres(url, {
      max: 5,
      connect_timeout: 2,
      idle_timeout: 20,
      connection: { statement_timeout: 4000 },
      onnotice: () => {},
    });
    this.db = drizzle(this.client);
  }
  async initialize() {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(revisions)
        .values({ id: 0, items: seed.items, actor: 'initial' })
        .onConflictDoNothing();
      await tx
        .insert(catalogState)
        .values({ id: 1, draft: seed.items, publishedRevision: 0 })
        .onConflictDoNothing();
    });
  }
  async published(): Promise<Snapshot> {
    const [row] = await this.db
      .select({
        id: revisions.id,
        items: revisions.items,
        createdAt: revisions.createdAt,
      })
      .from(catalogState)
      .innerJoin(revisions, eq(revisions.id, catalogState.publishedRevision))
      .where(eq(catalogState.id, 1));
    if (!row) throw new Error('Database not initialized');
    return {
      revision: row.id,
      items: row.items,
      publishedAt: row.createdAt.toISOString(),
    };
  }
  async catalog() {
    const [state] = await this.db
      .select()
      .from(catalogState)
      .where(eq(catalogState.id, 1));
    if (!state) throw new Error('Database not initialized');
    const history = await this.db
      .select({ id: revisions.id, createdAt: revisions.createdAt })
      .from(revisions)
      .orderBy(desc(revisions.id))
      .limit(50);
    return { ...state, history };
  }
  async change(
    kind: 'save' | 'publish' | 'restore',
    version: number,
    actor: string,
    items?: CatalogItem[],
    restoreId?: number,
  ) {
    return this.db.transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(catalogState)
        .where(eq(catalogState.id, 1))
        .for('update');
      if (!state) throw new Error('Database not initialized');
      if (state.version !== version)
        throw new HttpError(
          409,
          'Katalog başka bir sekmede değişti. Güncel taslağı yükle; değişikliklerin otomatik olarak üzerine yazılmadı.',
        );
      let draft = items || state.draft,
        publishedRevision = state.publishedRevision;
      const next = state.version + 1;
      if (kind === 'restore') {
        const [old] = await tx
          .select()
          .from(revisions)
          .where(eq(revisions.id, restoreId!));
        if (!old) throw new HttpError(404, 'Revizyon bulunamadı.');
        draft = persistedCatalogItems.parse(old.items);
      }
      let snapshot: Snapshot | undefined;
      if (kind !== 'save') {
        const [rev] = await tx
          .insert(revisions)
          .values({ id: next, items: draft, actor })
          .returning();
        publishedRevision = next;
        snapshot = {
          revision: next,
          items: draft,
          publishedAt: rev.createdAt.toISOString(),
        };
      }
      await tx
        .update(catalogState)
        .set({ version: next, draft, publishedRevision })
        .where(eq(catalogState.id, 1));
      await tx.insert(audit).values({ action: kind, actor, revision: next });
      return { version: next, snapshot };
    });
  }
  async createOAuth(hash: string, verifier: string) {
    await this.db.insert(oauthStates).values({
      hash,
      verifier,
      expiresAt: new Date(Date.now() + OAUTH_TTL_SECONDS * 1000),
    });
  }
  async consumeOAuth(hash: string) {
    const [state] = await this.db
      .delete(oauthStates)
      .where(
        and(eq(oauthStates.hash, hash), gt(oauthStates.expiresAt, new Date())),
      )
      .returning();
    return state;
  }
  async createSession(hash: string, userId: string, csrf: string) {
    await this.db.insert(sessions).values({
      hash,
      userId,
      csrf,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    });
    await this.db.insert(audit).values({ action: 'login', actor: userId });
  }
  async session(hash: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.hash, hash), gt(sessions.expiresAt, new Date())));
    return session;
  }
  async logout(hash: string, actor: string) {
    await this.db.delete(sessions).where(eq(sessions.hash, hash));
    await this.db.insert(audit).values({ action: 'logout', actor });
  }
  async count(day: string, slug: string, count: number) {
    await this.db
      .insert(dailyOpens)
      .values({ day, slug, count })
      .onConflictDoUpdate({
        target: [dailyOpens.day, dailyOpens.slug],
        set: { count: sql`${dailyOpens.count}+${count}` },
      });
  }
  async metrics() {
    return this.db
      .select()
      .from(dailyOpens)
      .where(
        sql`${dailyOpens.day} >= (now() AT TIME ZONE 'Europe/Istanbul')::date - 29`,
      )
      .orderBy(desc(dailyOpens.day));
  }
  async audit() {
    return this.db.select().from(audit).orderBy(desc(audit.id)).limit(100);
  }
  async cleanup() {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await this.db
      .delete(oauthStates)
      .where(lt(oauthStates.expiresAt, new Date()));
    await this.db
      .delete(dailyOpens)
      .where(
        sql`${dailyOpens.day} < (now() AT TIME ZONE 'Europe/Istanbul')::date - interval '13 months'`,
      );
    await this.db
      .delete(audit)
      .where(sql`${audit.createdAt} < now() - interval '13 months'`);
  }
  async close() {
    await this.client.end({ timeout: 2 });
  }
}
