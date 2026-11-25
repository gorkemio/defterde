import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory, copyNew } from './import-lib.mjs';
const games = JSON.parse(
  await readFile(new URL('../config/games.json', import.meta.url), 'utf8'),
);
const parent = resolve(process.argv[2] || '..');
const onlyIndex = process.argv.indexOf('--only');
const selected =
  onlyIndex < 0
    ? games
    : games.filter((g) => g.slug === process.argv[onlyIndex + 1]);
if (!selected.length) throw new Error('Unknown game slug');
await mkdir('docs/imports', { recursive: true });
for (const game of selected) {
  const source = join(parent, game.slug),
    target = resolve('games', game.slug);
  const files = await inventory(source);
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', ['-C', source, 'status', '--porcelain'], {
    encoding: 'utf8',
  });
  for (const file of game.runtime)
    if (!files[file]) throw new Error(`Missing runtime ${game.slug}/${file}`);
  try {
    const existing = await inventory(target);
    console.error(
      JSON.stringify(
        {
          slug: game.slug,
          added: Object.keys(files).filter((f) => !existing[f]),
          changed: Object.keys(files).filter(
            (f) => existing[f] && existing[f] !== files[f],
          ),
          removed: Object.keys(existing).filter((f) => !files[f]),
        },
        null,
        2,
      ),
    );
    throw new Error(
      'Target exists; no files were changed. Use scripts/update-game.mjs stage.',
    );
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await copyNew(source, target, files);
  if (JSON.stringify(await inventory(source)) !== JSON.stringify(files))
    throw new Error('Source changed during import');
  const after = execFileSync('git', ['-C', source, 'status', '--porcelain'], {
    encoding: 'utf8',
  });
  if (after !== status) throw new Error('Source git state changed');
  await writeFile(
    `docs/imports/${game.slug}.json`,
    JSON.stringify(
      {
        slug: game.slug,
        source,
        commit,
        status,
        importedAt: new Date().toISOString(),
        files,
        runtime: Object.fromEntries(game.runtime.map((f) => [f, files[f]])),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${game.slug}: ${Object.keys(files).length} files copied; ${game.runtime.length} runtime hashes verified; ${commit.slice(0, 7)}`,
  );
}
