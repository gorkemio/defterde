import { readFileSync } from 'node:fs';
import { z } from 'zod';
// config/games.json yol ve rota üretiminde kullanılır; biçimi açılışta doğrulanır.
const registrySchema = z
  .array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string().min(1),
      description: z.string().min(1),
      mode: z.string(),
      runtime: z.array(z.string()).min(1),
    }),
  )
  .min(1)
  .refine(
    (games) => new Set(games.map((g) => g.slug)).size === games.length,
    'Oyun kısa adları benzersiz olmalı.',
  );
export const registry = registrySchema.parse(
  JSON.parse(readFileSync('config/games.json', 'utf8')),
);
export const catalogItem = z
  .object({
    slug: z.string(),
    title: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(180),
    visible: z.boolean(),
  })
  .strict();
export const catalogItems = z
  .array(catalogItem)
  .length(registry.length)
  .refine(
    (items) =>
      new Set(items.map((i) => i.slug)).size === registry.length &&
      items.every((i) => registry.some((g) => g.slug === i.slug)),
    'Her oyun tam bir kez bulunmalı.',
  );
export type CatalogItem = z.infer<typeof catalogItem>;
export interface Snapshot {
  revision: number;
  items: CatalogItem[];
  publishedAt: string | null;
}
export const seed: Snapshot = {
  revision: 0,
  publishedAt: null,
  items: registry.map(({ slug, title, description }) => ({
    slug,
    title,
    description,
    visible: true,
  })),
};
// Accept only complete historical registries; never silently repair malformed data.
// Her yayın adımı (migration 002–012) kataloğa eklenen oyunları sırayla listeler.
// Yeni oyun eklerken önceki tam kataloğu da kabul etmek için bu listeye bir adım eklenir.
const releases: string[][] = [
  [
    'amiralbatti',
    'alankapmaca',
    'kagitfutbolu',
    'sos',
    'kagithangar',
    'adamasmaca',
  ],
  ['kagitrallisi'],
  ['dokuztas'],
  ['xox', 'noktaoyunu', 'sayibulma'],
  ['turkdamasi'],
  ['kibrit'],
  ['labirent'],
  ['kakuro'],
  ['tangram'],
  ['domino'],
  ['mangala'],
  ['nonogram'],
];
function historicalCatalog(slugs: string[]) {
  return z
    .array(catalogItem)
    .length(slugs.length)
    .refine(
      (items) =>
        new Set(items.map((i) => i.slug)).size === slugs.length &&
        items.every((i) => slugs.includes(i.slug)),
    )
    .transform((items) => [
      ...items,
      ...structuredClone(seed.items.filter((i) => !slugs.includes(i.slug))),
    ]);
}
const historical = releases.map((_, i) =>
  historicalCatalog(releases.slice(0, i + 1).flat()),
);
export const persistedCatalogItems = z.union([
  catalogItems,
  historical[0],
  ...historical.slice(1),
]);
export function decorate(items: CatalogItem[]) {
  return items.map((item) => ({
    ...item,
    mode: registry.find((g) => g.slug === item.slug)!.mode,
  }));
}
