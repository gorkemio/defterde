// Run explicitly after a reviewed Hangar import; never copies sibling sources.
import { readFile, writeFile } from 'node:fs/promises';
import { hash } from './import-lib.mjs';
const game = JSON.parse(await readFile('config/games.json', 'utf8')).find(
  (entry) => entry.slug === 'kagithangar',
);
const versions = {};
for (const file of game.runtime.filter((file) => /\.(js|css)$/.test(file)))
  versions[file] = hash(await readFile(`games/kagithangar/${file}`)).slice(
    0,
    12,
  );
const imports = Object.fromEntries(
  Object.entries(versions)
    .filter(([file]) => file.endsWith('.js') && !file.startsWith('kit/'))
    .map(([file, version]) => [`./${file}`, `./${file}?v=${version}`]),
);
const path = 'games/kagithangar/index.html';
let html = await readFile(path, 'utf8');
html = html.replace(
  /\n  <!-- Defterde: sürümlü modüller -->\n  <script type="importmap">[\s\S]*?<\/script>\n/,
  '\n',
);
html = html.replace(
  '</head>',
  `  <!-- Defterde: sürümlü modüller -->\n  <script type="importmap">${JSON.stringify({ imports }, null, 2)}</script>\n</head>`,
);
html = html.replace(
  /\b(src|href)="([^"?]+)(?:\?v=[a-f0-9]+)?"/g,
  (match, attr, file) =>
    versions[file] ? `${attr}="${file}?v=${versions[file]}"` : match,
);
await writeFile(path, html);
console.log(
  `Versioned ${Object.keys(imports).length} Hangar modules; reviewed index.html SHA-256: ${hash(html)}`,
);
