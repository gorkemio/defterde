import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origin = new URL(process.argv[2] || 'https://defterde.com').origin;
const headers = {
  'User-Agent': 'DefterdeDeployHealthCheck',
  'Cache-Control': 'no-cache',
};
const registry = JSON.parse(await readFile('config/games.json', 'utf8'));
const results = [];
async function request(path, expected = 200) {
  const response = await fetch(origin + path, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  results.push({ path, status: response.status });
  if (response.status !== expected)
    throw new Error(`${path}: ${response.status}, expected ${expected}`);
  return response;
}
await request('/healthz');
const home = await (await request('/')).text();
if ((home.match(/class="discovery-game"/g) || []).length !== registry.length)
  throw new Error('Catalog links missing');
for (const path of [
  '/nasil-oynanir/',
  '/hakkinda/',
  '/gizlilik/',
  '/kaynaklar/',
  '/yonetim/',
  '/robots.txt',
  '/sitemap.xml',
])
  await request(path);
for (const game of registry) {
  const imported = JSON.parse(
    await readFile(`docs/imports/${game.slug}.json`, 'utf8'),
  );
  await request(`/oyunlar/${game.slug}/`);
  for (let offset = 0; offset < game.runtime.length; offset += 6) {
    await Promise.all(
      game.runtime.slice(offset, offset + 6).map(async (file) => {
        const response = await request(`/oyunlar/${game.slug}/${file}`);
        const digest = createHash('sha256')
          .update(Buffer.from(await response.arrayBuffer()))
          .digest('hex');
        if (digest !== imported.runtime[file])
          throw new Error(`Runtime hash mismatch: ${game.slug}/${file}`);
      }),
    );
  }
}
await request('/api/v1/admin/catalog', 401);
await request('/oyunlar/sos/test/game.test.js', 404);
await request('/oyunlar/adamasmaca/ham/', 404);
const redirect = await request('/oyunlar/kagithangar?kontrol=dagitim', 308);
if (
  redirect.headers.get('location') !== '/oyunlar/kagithangar/?kontrol=dagitim'
)
  throw new Error('Query lost during redirect');
const login = await request('/auth/github', 302);
const authorization = new URL(login.headers.get('location'));
if (
  authorization.origin !== 'https://github.com' ||
  authorization.searchParams.get('scope') ||
  authorization.searchParams.get('code_challenge_method') !== 'S256'
)
  throw new Error('OAuth authorization configuration mismatch');
await mkdir('test-results', { recursive: true });
const report = {
  origin,
  checkedAt: new Date().toISOString(),
  runtimeFiles: registry.reduce((n, g) => n + g.runtime.length, 0),
  results,
};
await writeFile(
  'test-results/production-smoke.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    origin,
    runtimeFiles: report.runtimeFiles,
    requests: results.length,
    passed: true,
  }),
);
