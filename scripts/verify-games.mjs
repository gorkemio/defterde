import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { inventory } from './import-lib.mjs';
const games = JSON.parse(await readFile('config/games.json', 'utf8'));
for (const { slug } of games) {
  const report = JSON.parse(
    await readFile(`docs/imports/${slug}.json`, 'utf8'),
  );
  const current = await inventory(`games/${slug}`);
  for (const [file, digest] of Object.entries(report.files))
    if (
      current[file] !==
      (report.runtime[file] ?? report.localFiles?.[file] ?? digest)
    )
      throw new Error(`Copy mismatch: ${slug}/${file}`);
  // Özgün kaynak depoları (ör. ../xox) yalnız yanınızda klonluysa doğrulanır.
  const hasSource =
    typeof report.source === 'string' &&
    (await stat(report.source).catch(() => null))?.isDirectory();
  if (process.argv.includes('--sources') && !hasSource)
    console.log(
      `${slug}: original source ${report.source} not present; skipped`,
    );
  if (process.argv.includes('--sources') && hasSource) {
    const sourceReport = report.sourceVerification ?? report;
    if (
      sourceReport.commit !== null &&
      execFileSync('git', ['-C', report.source, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim() !== sourceReport.commit
    )
      throw new Error(`Source commit changed: ${slug}`);
    const source = await inventory(report.source);
    if (JSON.stringify(source) !== JSON.stringify(sourceReport.files))
      throw new Error(`Source changed: ${slug}`);
    if (
      sourceReport.status !== null &&
      execFileSync('git', ['-C', report.source, 'status', '--porcelain'], {
        encoding: 'utf8',
      }) !== sourceReport.status
    )
      throw new Error(`Source git changed: ${slug}`);
  }
  console.log(
    `${slug}: copied hashes match reviewed manifest (${Object.keys(report.runtime).filter((file) => report.runtime[file] !== report.files[file]).length} reviewed runtime changes, ${Object.keys(report.localFiles ?? {}).length} reviewed non-runtime changes)${process.argv.includes('--sources') && hasSource ? '; original files and git state unchanged' : ''}`,
  );
}
