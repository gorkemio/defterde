import {
  readFile,
  mkdir,
  copyFile,
  rm,
  lstat,
  writeFile,
} from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { hash } from './import-lib.mjs';
const games = JSON.parse(await readFile('config/games.json', 'utf8'));
const root = resolve('dist/games');
await rm(root, { recursive: true, force: true });
const packaged = {};
for (const game of games) {
  const report = JSON.parse(
    await readFile(`docs/imports/${game.slug}.json`, 'utf8'),
  );
  for (const file of game.runtime) {
    if (file.split('/').some((s) => s.startsWith('.') || s === '..'))
      throw new Error('Invalid runtime path');
    const source = join('games', game.slug, file),
      target = join(root, game.slug, file);
    if (!(await lstat(source)).isFile())
      throw new Error('Runtime must be a regular file');
    const digest = hash(await readFile(source));
    if (digest !== report.runtime[file])
      throw new Error(`Runtime changed without reviewed import: ${source}`);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    packaged[`${game.slug}/${file}`] = digest;
  }
}
await mkdir('build', { recursive: true });
await writeFile('build/runtime-hashes.json', JSON.stringify(packaged, null, 2));
console.log(`Packaged ${Object.keys(packaged).length} verified runtime files`);
