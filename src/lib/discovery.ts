export const categories = [
  { value: 'strateji', label: 'Strateji' },
  { value: 'bulmaca', label: 'Bulmaca' },
  { value: 'kelime', label: 'Kelime' },
  { value: 'yaris', label: 'Yarış' },
  { value: 'yaraticilik', label: 'Yaratıcılık' },
] as const;
export type Category = (typeof categories)[number]['value'];
export const players = [
  { value: '', label: 'Hepsi' },
  { value: 'solo', label: 'Tek başına' },
  { value: 'together', label: 'Birlikte' },
] as const;
export type Player = 'solo' | 'together';
export interface DiscoveryMeta {
  categories: readonly Category[];
  players: readonly Player[];
}
const solo: readonly Player[] = ['solo'];
const both: readonly Player[] = ['solo', 'together'];
export const discoveryMeta: Record<string, DiscoveryMeta> = {
  amiralbatti: { categories: ['strateji'], players: solo },
  alankapmaca: { categories: ['strateji'], players: both },
  kagitfutbolu: { categories: ['strateji'], players: both },
  sos: { categories: ['strateji'], players: both },
  kagithangar: { categories: ['yaraticilik'], players: both },
  adamasmaca: { categories: ['kelime'], players: both },
  kagitrallisi: { categories: ['yaris'], players: both },
  dokuztas: { categories: ['strateji'], players: both },
  xox: { categories: ['strateji'], players: both },
  noktaoyunu: { categories: ['strateji', 'bulmaca'], players: both },
  sayibulma: { categories: ['bulmaca'], players: both },
  turkdamasi: { categories: ['strateji'], players: both },
  kibrit: { categories: ['bulmaca'], players: both },
  labirent: { categories: ['bulmaca'], players: solo },
  tangram: { categories: ['bulmaca', 'yaraticilik'], players: solo },
  kakuro: { categories: ['bulmaca'], players: solo },
  domino: { categories: ['strateji'], players: both },
  mangala: { categories: ['strateji'], players: both },
  nonogram: { categories: ['bulmaca', 'yaraticilik'], players: solo },
  besharf: { categories: ['kelime'], players: both },
};
export interface Filters {
  q: string;
  category: Category | '';
  player: Player | '';
}
export function readFilters(params: URLSearchParams): Filters {
  const category = params.get('tur') || '';
  const player = params.get('oyuncu') || '';
  return {
    q: (params.get('q') || '').trim().slice(0, 180),
    category: categories.find((c) => c.value === category)?.value || '',
    player: player === 'solo' || player === 'together' ? player : '',
  };
}
export function filterParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('tur', filters.category);
  if (filters.player) params.set('oyuncu', filters.player);
  return params;
}
export function searchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/['’]/g, '');
}
export function matchesGame(
  game: DiscoveryMeta & { title: string; description: string },
  filters: Filters,
): boolean {
  if (filters.category && !game.categories.includes(filters.category))
    return false;
  if (filters.player && !game.players.includes(filters.player)) return false;
  const haystack = searchText(`${game.title} ${game.description}`);
  return searchText(filters.q)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
export function chooseGame<T extends { slug: string }>(
  games: readonly T[],
  previous?: string,
  random = Math.random,
): T | undefined {
  const pool =
    games.length > 1 ? games.filter((g) => g.slug !== previous) : games;
  return pool[Math.floor(random() * pool.length)];
}
