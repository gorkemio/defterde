import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventory, copyNew } from '../scripts/import-lib.mjs';
test('import excludes secrets, raw data, dependencies and symlinks; refuses overwrite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'defterde-import-'));
  try {
    for (const p of [
      'source/assets',
      'source/.git',
      'source/ham',
      'source/node_modules',
      'source/.claude',
    ])
      await mkdir(join(root, p), { recursive: true });
    for (const p of [
      'index.html',
      'assets/font.ttf',
      '.env',
      '.git/config',
      'ham/raw.txt',
      'node_modules/a.js',
      '.claude/settings.json',
      'README.md',
    ])
      await writeFile(join(root, 'source', p), 'original');
    const files = await inventory(join(root, 'source'));
    assert.deepEqual(Object.keys(files), [
      'README.md',
      'assets/font.ttf',
      'index.html',
    ]);
    await copyNew(join(root, 'source'), join(root, 'copy'), files);
    assert.deepEqual(await inventory(join(root, 'copy')), files);
    await assert.rejects(
      copyNew(join(root, 'source'), join(root, 'copy'), files),
      /exists/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('gitless source verification checks the full file inventory and detects source edits', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(), 'defterde-gitless-'));
  try {
    for (const dir of ['source', 'config', 'docs/imports', 'games/example'])
      await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, 'source/index.html'), '<p>Original</p>');
    await writeFile(join(root, 'games/example/index.html'), '<p>Original</p>');
    const files = await inventory(join(root, 'source'));
    await writeFile(
      join(root, 'config/games.json'),
      JSON.stringify([{ slug: 'example' }]),
    );
    await writeFile(
      join(root, 'docs/imports/example.json'),
      JSON.stringify({
        source: join(root, 'source'),
        commit: null,
        status: null,
        files,
        runtime: files,
      }),
    );
    const verify = () =>
      execFileSync(
        process.execPath,
        [
          fileURLToPath(
            new URL('../scripts/verify-games.mjs', import.meta.url),
          ),
          '--sources',
        ],
        { cwd: root, stdio: 'pipe' },
      );
    assert.doesNotThrow(verify);
    await writeFile(join(root, 'source/index.html'), '<p>Edited</p>');
    assert.throws(verify, /Source changed: example/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
