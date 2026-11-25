import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
// Oyun listesi teknik manifestten gelir; yeni oyun için ayrıca kayıt gerekmez.
const slugs = JSON.parse(await readFile('config/games.json', 'utf8')).map(
  (game) => game.slug,
);
let failed = false;
for (const slug of slugs) {
  const cwd = `games/${slug}`;
  const testDir = slug === 'domino' ? 'tests' : 'test';
  const files = (await readdir(`${cwd}/${testDir}`))
    .filter((f) => /\.test\.(js|mjs|cjs)$/.test(f))
    .map((f) => `${testDir}/${f}`);
  const r = spawnSync(process.execPath, ['--test', ...files], {
    cwd,
    encoding: 'utf8',
  });
  console.log(
    `\n${slug}\n${r.stdout
      .split('\n')
      .filter(
        (l) => l.startsWith('ℹ') || l.startsWith('#') || l.startsWith('✖'),
      )
      .slice(-12)
      .join('\n')}`,
  );
  if (r.status !== 0) {
    failed = true;
    console.error(r.stderr, r.stdout.slice(-6000));
  }
}
process.exitCode = failed ? 1 : 0;
