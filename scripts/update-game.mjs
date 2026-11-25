// Oyun kopyaları için açık adımlar. dev/build sırasında hiç çağrılmaz; yalnız bu projeye yazar.
//   stage SLUG [KAYNAK]          ayrı bir kaynak deposundan güncellemeyi .imports/ altına hazırlar
//   apply SLUG REVIEW_SHA256     hazırlanan ve incelenen güncellemeyi games/SLUG yerine koyar
//   record SLUG                  games/SLUG içindeki incelenmiş yerel değişiklikleri rapora işler
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory, copyNew, hash } from './import-lib.mjs';
const [mode, slug, argument] = process.argv.slice(2);
const games = JSON.parse(await readFile('config/games.json', 'utf8')),
  game = games.find((g) => g.slug === slug);
if (!game || !['stage', 'apply', 'record'].includes(mode))
  throw new Error(
    'Usage: node scripts/update-game.mjs stage SLUG [SOURCE] | apply SLUG REVIEW_SHA256 | record SLUG',
  );
const old = JSON.parse(await readFile(`docs/imports/${slug}.json`, 'utf8'));
const current = await inventory(`games/${slug}`);
if (mode === 'record') {
  // games/ bu depoda asıl kaynaktır. Değişikliği inceledikten sonra envanter ve
  // runtime hash'leri yeniden kaydedilir; build yalnız kaydedilmiş hash'leri yayınlar.
  for (const file of game.runtime)
    if (!current[file]) throw new Error(`Runtime file missing: ${file}`);
  const changed = Object.keys(current).filter(
    (f) =>
      (old.runtime?.[f] ?? old.localFiles?.[f] ?? old.files?.[f]) !==
      current[f],
  );
  const removed = Object.keys(old.files ?? {}).filter((f) => !current[f]);
  const { localFiles: _localFiles, ...rest } = old;
  const report = {
    ...rest,
    recordedAt: new Date().toISOString(),
    files: current,
    runtime: Object.fromEntries(game.runtime.map((f) => [f, current[f]])),
  };
  await writeFile(
    `docs/imports/${slug}.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `${slug}: ${changed.length} changed/added, ${removed.length} removed file(s) recorded`,
  );
  process.exit(0);
}
if (JSON.stringify(current) !== JSON.stringify(old.files))
  throw new Error(
    'Local copy has edits; record them first: node scripts/update-game.mjs record ' +
      slug,
  );
if (mode === 'stage') {
  const source = resolve(argument || old.source),
    files = await inventory(source);
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', ['-C', source, 'status', '--porcelain'], {
    encoding: 'utf8',
  });
  for (const file of game.runtime)
    if (!files[file])
      throw new Error(`Runtime manifest needs review; missing: ${file}`);
  const diff = {
    added: Object.keys(files).filter((f) => !old.files[f]),
    changed: Object.keys(files).filter(
      (f) => old.files[f] && old.files[f] !== files[f],
    ),
    removed: Object.keys(old.files).filter((f) => !files[f]),
  };
  const report = {
    slug,
    source,
    commit,
    status,
    importedAt: new Date().toISOString(),
    files,
    runtime: Object.fromEntries(game.runtime.map((f) => [f, files[f]])),
  };
  const review = { previousCommit: old.commit, diff, report };
  const text = JSON.stringify(review, null, 2) + '\n',
    digest = hash(text);
  await mkdir('.imports', { recursive: true });
  await copyNew(source, `.imports/${slug}-${digest}`, files);
  await writeFile(`.imports/${slug}-${digest}.json`, text);
  console.log(text);
  console.log(
    `Review new runtime dependencies and config/games.json. Then: node scripts/update-game.mjs apply ${slug} ${digest}`,
  );
} else {
  if (!/^[a-f0-9]{64}$/.test(argument || ''))
    throw new Error('Exact review SHA256 required');
  const path = `.imports/${slug}-${argument}`,
    text = await readFile(path + '.json', 'utf8');
  if (hash(text) !== argument) throw new Error('Review changed');
  const review = JSON.parse(text);
  if (review.previousCommit !== old.commit)
    throw new Error('Baseline changed; stage again');
  if (
    JSON.stringify(await inventory(path)) !==
    JSON.stringify(review.report.files)
  )
    throw new Error('Staged files changed');
  for (const file of game.runtime)
    if (review.report.runtime[file] !== review.report.files[file])
      throw new Error('Manifest changed; stage again');
  await mkdir('.imports/backups', { recursive: true });
  const backup = `.imports/backups/${slug}-${Date.now()}`;
  await rename(`games/${slug}`, backup);
  try {
    await rename(path, `games/${slug}`);
    await writeFile(
      `docs/imports/${slug}.json`,
      JSON.stringify(review.report, null, 2) + '\n',
    );
  } catch (e) {
    console.error(`Original copy is safely retained at ${backup}`);
    throw e;
  }
  console.log(
    `Applied reviewed copy; previous copy retained at ${backup}. Run games:verify, build and regression tests.`,
  );
}
