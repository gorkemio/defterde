import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  bigserial,
  bigint,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { CatalogItem } from '../lib/catalog.js';
export const catalogState = pgTable('catalog_state', {
  id: integer().primaryKey(),
  version: integer().notNull().default(0),
  draft: jsonb().$type<CatalogItem[]>().notNull(),
  publishedRevision: integer('published_revision').notNull().default(0),
});
export const revisions = pgTable('catalog_revisions', {
  id: integer().primaryKey(),
  items: jsonb().$type<CatalogItem[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actor: text().notNull(),
});
export const sessions = pgTable('admin_sessions', {
  hash: text().primaryKey(),
  userId: text('user_id').notNull(),
  csrf: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const oauthStates = pgTable('oauth_states', {
  hash: text().primaryKey(),
  verifier: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const dailyOpens = pgTable(
  'daily_opens',
  {
    day: date().notNull(),
    slug: text().notNull(),
    count: bigint({ mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.slug] })],
);
export const audit = pgTable('admin_audit', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  action: text().notNull(),
  actor: text().notNull(),
  revision: integer(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
