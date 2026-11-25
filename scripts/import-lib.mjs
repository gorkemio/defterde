import { readdir, readFile, mkdir, copyFile, lstat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const excluded = new Set([
  '.git',
  'node_modules',
  '.claude',
  '.codex',
  '.agents',
  'AGENTS.md',
  'CLAUDE.md',
  '.idea',
  '.vscode',
  'ham',
  'test-results',
  'playwright-report',
  'coverage',
  '.cache',
  'dist',
  'build',
]);
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function inventory(root, dir = '') {
  const result = {};
  for (const entry of (
    await readdir(join(root, dir), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = entry.name,
      rel = dir ? `${dir}/${name}` : name;
    if (
      excluded.has(name) ||
      name === '.DS_Store' ||
      name.startsWith('.env') ||
      /\.(pem|key|p12|log)$/.test(name) ||
      /credentials|secret/i.test(name)
    )
      continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${rel}`);
    if (entry.isDirectory()) Object.assign(result, await inventory(root, rel));
    else if (entry.isFile())
      result[rel] = hash(await readFile(join(root, rel)));
  }
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}
export async function copyNew(source, target, files) {
  try {
    await lstat(target);
    throw new Error(`Target exists: ${target}; review a staged update first.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(target, { recursive: true });
  for (const name of Object.keys(files)) {
    await mkdir(dirname(join(target, name)), { recursive: true });
    await copyFile(join(source, name), join(target, name));
  }
  if (JSON.stringify(await inventory(target)) !== JSON.stringify(files))
    throw new Error('Copied files differ from source inventory');
}
