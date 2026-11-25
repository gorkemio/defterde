import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { inventory, copyNew } from '../scripts/import-lib.mjs';
test('staged game update refuses unreviewed changes and preserves the previous copy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'defterde-update-')),
    script = resolve('scripts/update-game.mjs');
  try {
    for (const dir of ['source', 'config', 'docs/imports'])
      await mkdir(join(root, dir), { recursive: true });
    const source = join(root, 'source');
    await writeFile(join(source, 'index.html'), 'old');
    execFileSync('git', ['init', '-q', source]);
    execFileSync('git', ['-C', source, 'add', 'index.html']);
    execFileSync('git', [
      '-C',
      source,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-qm',
      'fixture',
    ]);
    const files = await inventory(source),
      commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
    await writeFile(
      join(root, 'config/games.json'),
      JSON.stringify([{ slug: 'demo', runtime: ['index.html'] }]),
    );
    await copyNew(source, join(root, 'games/demo'), files);
    await writeFile(
      join(root, 'docs/imports/demo.json'),
      JSON.stringify({ source, commit, files, runtime: files }),
    );
    await writeFile(join(source, 'index.html'), 'new');
    const stage = spawnSync(
      process.execPath,
      [script, 'stage', 'demo', source],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(stage.status, 0, stage.stderr);
    const hash = stage.stdout.match(/apply demo ([a-f0-9]{64})/)![1];
    assert.equal(
      await readFile(join(root, 'games/demo/index.html'), 'utf8'),
      'old',
    );
    assert.notEqual(
      spawnSync(process.execPath, [script, 'apply', 'demo', '0'.repeat(64)], {
        cwd: root,
      }).status,
      0,
    );
    const apply = spawnSync(process.execPath, [script, 'apply', 'demo', hash], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(apply.status, 0, apply.stderr);
    assert.equal(
      await readFile(join(root, 'games/demo/index.html'), 'utf8'),
      'new',
    );
    assert.equal(await readFile(join(source, 'index.html'), 'utf8'), 'new');
    assert.match(apply.stdout, /previous copy retained/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('record mode stores reviewed local edits so the build accepts them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'defterde-record-')),
    script = resolve('scripts/update-game.mjs');
  try {
    for (const dir of ['config', 'docs/imports', 'games/demo'])
      await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, 'games/demo/index.html'), 'old');
    await writeFile(join(root, 'games/demo/NOTES.md'), 'notes');
    const files = await inventory(join(root, 'games/demo'));
    await writeFile(
      join(root, 'config/games.json'),
      JSON.stringify([{ slug: 'demo', runtime: ['index.html'] }]),
    );
    await writeFile(
      join(root, 'docs/imports/demo.json'),
      JSON.stringify({
        source: '../demo',
        commit: 'abc',
        files,
        runtime: files,
      }),
    );
    await writeFile(join(root, 'games/demo/index.html'), 'new');
    await rm(join(root, 'games/demo/NOTES.md'));
    const record = spawnSync(process.execPath, [script, 'record', 'demo'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(record.status, 0, record.stderr);
    const report = JSON.parse(
      await readFile(join(root, 'docs/imports/demo.json'), 'utf8'),
    );
    const current = await inventory(join(root, 'games/demo'));
    assert.deepEqual(report.files, current);
    assert.equal(report.runtime['index.html'], current['index.html']);
    assert.equal(report.commit, 'abc');
    assert.ok(report.recordedAt);
  } finally {
    await rm(join(root), { recursive: true, force: true });
  }
});
