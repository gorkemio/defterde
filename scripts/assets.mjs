import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { resolve } from 'node:path';
await mkdir('build/font-cache', { recursive: true });
await writeFile(
  'build/fonts.conf',
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${resolve('public/assets')}</dir><cachedir>${resolve('build/font-cache')}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = resolve('build/fonts.conf');
const require = createRequire(import.meta.url),
  rough = require('roughjs/bundled/rough.cjs.js');
await mkdir('public/assets/drawings', { recursive: true });
await mkdir('public/assets/licenses', { recursive: true });
await copyFile(
  'games/sos/assets/fonts/PatrickHand-v25.ttf',
  'public/assets/PatrickHand.ttf',
);
await copyFile(
  'games/sos/assets/fonts/PatrickHand-OFL.txt',
  'public/assets/licenses/PatrickHand-OFL.txt',
);
await copyFile(
  'games/sos/assets/vendor/rough-LICENSE',
  'public/assets/licenses/rough-MIT.txt',
);
await copyFile('games/sos/kit/gren.png', 'public/assets/gren.png');
await copyFile(
  'games/kagitfutbolu/assets/README.md',
  'public/assets/licenses/kagitfutbolu-kaynaklar.txt',
);
await copyFile(
  'games/adamasmaca/README.md',
  'public/assets/licenses/adamasmaca-kaynaklar.txt',
);
await copyFile(
  'games/kagitrallisi/assets/DEPENDENCIES.md',
  'public/assets/licenses/kagitrallisi-kaynaklar.txt',
);
await copyFile(
  'games/kagitrallisi/assets/fonts/CaveatBrush-OFL.txt',
  'public/assets/licenses/CaveatBrush-OFL.txt',
);
await copyFile(
  'games/dokuztas/assets/DEPENDENCIES.md',
  'public/assets/licenses/dokuztas-kaynaklar.txt',
);
await copyFile(
  'games/dokuztas/assets/fonts/Kalam-OFL.txt',
  'public/assets/licenses/Kalam-OFL.txt',
);
await copyFile(
  'games/xox/assets/fonts/MarckScript-OFL.txt',
  'public/assets/licenses/MarckScript-OFL.txt',
);
for (const slug of [
  'xox',
  'noktaoyunu',
  'sayibulma',
  'turkdamasi',
  'kibrit',
  'labirent',
  'kakuro',
  'tangram',
  'domino',
  'mangala',
  'nonogram',
  'besharf',
])
  await copyFile(
    `games/${slug}/assets/DEPENDENCIES.md`,
    `public/assets/licenses/${slug}-kaynaklar.txt`,
  );
// Tangram GPL kaynak paketi doğrudan public/assets/licenses/ altında tutulur.
const g = rough.generator(),
  blue = '#1f3b9b',
  red = '#c62828';
let seed = 100;
const shapes = [];
function draw(method, ...args) {
  let options = {
    stroke: blue,
    strokeWidth: 1.7,
    roughness: 1.1,
    seed: seed++,
  };
  if (typeof args.at(-1) === 'object' && !Array.isArray(args.at(-1)))
    options = { ...options, ...args.pop() };
  shapes.push(
    ...g
      .toPaths(g[method](...args, options))
      .map(
        (p) =>
          `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill || 'none'}"/>`,
      ),
  );
}
function text(x, y, value, color = blue, size = 24) {
  if (value === 'O') draw('ellipse', x + 7, y - 10, 14, 20, { stroke: color });
  else
    draw(
      'path',
      `M${x + 13} ${y - 19} C${x - 4} ${y - 24} ${x - 3} ${y - 10} ${x + 7} ${y - 10} S${x + 17} ${y + 4} ${x} ${y - 1}`,
      { stroke: color },
    );
}
async function save(name) {
  await writeFile(
    `public/assets/drawings/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${name === 'underline' ? '0 32 120 28' : '0 0 120 90'}" preserveAspectRatio="none">${shapes.join('')}</svg>`,
  );
  shapes.length = 0;
}
draw('polygon', [
  [14, 49],
  [100, 49],
  [86, 66],
  [30, 66],
]);
draw('rectangle', 40, 32, 40, 16);
draw('line', 61, 12, 61, 32);
draw(
  'polygon',
  [
    [62, 13],
    [86, 23],
    [62, 24],
  ],
  { stroke: red },
);
draw('path', 'M9 73 Q24 65 39 73 T69 73 T105 73');
await save('amiralbatti');
draw('rectangle', 13, 15, 88, 62);
for (let x = 35; x < 100; x += 22)
  draw('line', x, 15, x, 77, { stroke: '#8aa3bc', strokeWidth: 0.6 });
for (let y = 35; y < 77; y += 20)
  draw('line', 13, y, 101, y, { stroke: '#8aa3bc', strokeWidth: 0.6 });
draw('rectangle', 14, 16, 43, 40, {
  fill: blue,
  fillStyle: 'hachure',
  hachureGap: 7,
});
draw('rectangle', 59, 37, 42, 40, { stroke: red });
await save('alankapmaca');
draw('rectangle', 20, 10, 79, 69);
draw('line', 59, 10, 59, 79, { stroke: '#8aa3bc' });
draw('circle', 60, 44, 24);
draw('rectangle', 9, 33, 11, 24);
draw('rectangle', 99, 33, 11, 24);
draw(
  'linearPath',
  [
    [35, 65],
    [46, 54],
    [34, 42],
    [46, 30],
    [58, 42],
    [70, 30],
    [82, 42],
    [105, 42],
  ],
  { stroke: red },
);
draw('circle', 81, 42, 6, { fill: blue, fillStyle: 'solid' });
await save('kagitfutbolu');
for (const x of [44, 76]) draw('line', x, 7, x, 83);
for (const y of [31, 59]) draw('line', 12, y, 106, y);
text(20, 28, 'S');
text(51, 55, 'O', red);
text(83, 80, 'S');
text(83, 27, 'O', red);
text(20, 78, 'O', red);
draw('line', 22, 13, 99, 79);
await save('sos');
draw('polygon', [
  [9, 57],
  [108, 12],
  [72, 78],
  [58, 54],
  [9, 57],
]);
draw('line', 58, 54, 108, 12);
draw('line', 58, 54, 43, 72);
draw('line', 43, 72, 50, 55);
draw('path', 'M9 80 Q37 85 33 67', { stroke: red });
await save('kagithangar');
draw('line', 18, 77, 88, 77);
draw('line', 36, 76, 36, 14);
draw('line', 35, 14, 78, 14);
draw('line', 77, 15, 77, 26);
draw('circle', 77, 37, 20);
draw('line', 77, 47, 77, 62);
draw('line', 77, 51, 64, 56);
draw('line', 77, 51, 91, 44);
draw('line', 77, 62, 66, 73);
draw('line', 77, 62, 88, 72);
await save('adamasmaca');
draw('path', 'M7 44 Q46 37 112 46', { strokeWidth: 2 });
draw('path', 'M12 51 Q61 42 103 51', { stroke: red, strokeWidth: 1 });
await save('underline');
// A small track and an accelerating path; seeded after existing drawings to keep them unchanged.
draw(
  'path',
  'M27 14 L84 14 Q107 14 107 37 L107 58 Q107 78 84 78 L30 78 Q10 78 10 57 L10 36 Q10 14 27 14 Z',
);
draw(
  'path',
  'M33 31 L77 31 Q88 31 88 41 L88 51 Q88 61 77 61 L36 61 Q28 61 28 51 L28 42 Q28 31 33 31 Z',
);
draw(
  'linearPath',
  [
    [20, 53],
    [21, 43],
    [31, 24],
    [52, 23],
    [82, 24],
  ],
  { stroke: red },
);
for (const [x, y] of [
  [20, 53],
  [21, 43],
  [31, 24],
  [52, 23],
  [82, 24],
])
  draw('circle', x, y, 4, { stroke: red, fill: red, fillStyle: 'solid' });
draw('line', 58, 61, 58, 78);
draw('line', 64, 61, 64, 78);
await save('kagitrallisi');
// Three nested squares, connected midpoints and contrasting stones.
for (const [x, y, size] of [
  [24, 9, 72],
  [36, 21, 48],
  [48, 33, 24],
])
  draw('rectangle', x, y, size, size);
for (const line of [
  [60, 9, 60, 33],
  [96, 45, 72, 45],
  [60, 81, 60, 57],
  [24, 45, 48, 45],
])
  draw('line', ...line);
for (const [x, y] of [
  [24, 9],
  [60, 9],
  [96, 9],
])
  draw('circle', x, y, 9, { fill: blue, fillStyle: 'hachure', hachureGap: 2 });
for (const [x, y] of [
  [36, 69],
  [60, 57],
  [96, 45],
])
  draw('circle', x, y, 9, { stroke: red });
await save('dokuztas');

// Five ink crosses and the winning line; this is five-in-a-row, not three.
for (let i = 0; i < 5; i++) {
  const x = 20 + i * 19,
    y = 64 - i * 10;
  draw('line', x - 5, y - 5, x + 5, y + 5);
  draw('line', x - 5, y + 5, x + 5, y - 5);
}
draw('line', 12, 68, 104, 20, { stroke: red });
for (const [x, y] of [
  [37, 22],
  [60, 65],
  [84, 50],
])
  draw('ellipse', x, y, 12, 15, { stroke: red });
await save('xox');

draw('rectangle', 28, 18, 32, 28, {
  fill: blue,
  fillStyle: 'hachure',
  hachureGap: 4,
});
draw('rectangle', 60, 46, 32, 28, {
  stroke: red,
  fill: red,
  fillStyle: 'hachure',
  hachureGap: 4,
});
draw('line', 28, 46, 28, 74);
draw('line', 60, 18, 92, 18);
for (const x of [28, 60, 92])
  for (const y of [18, 46, 74])
    draw('circle', x, y, 4, { fill: blue, fillStyle: 'solid' });
await save('noktaoyunu');

// Pencil digits and red +/− clues, with no font dependency.
draw(
  'path',
  'M18 25L24 19V40 M34 22Q45 15 46 23Q47 29 34 40H48 M55 20H68L59 29Q72 27 69 36Q65 43 55 38 M87 20L75 33H91M87 20V41',
);
draw('line', 27, 61, 43, 61, { stroke: red });
draw('line', 35, 53, 35, 69, { stroke: red });
draw('line', 62, 61, 78, 61, { stroke: red });
draw('line', 14, 78, 102, 78, { stroke: '#555555', strokeWidth: 1 });
await save('sayibulma');

// A small orthogonal board and two draughts, one crowned.
for (const x of [20, 40, 60, 80, 100])
  draw('line', x, 16, x, 76, { stroke: '#8aa3bc', strokeWidth: 0.7 });
for (const y of [16, 36, 56, 76])
  draw('line', 20, y, 100, y, { stroke: '#8aa3bc', strokeWidth: 0.7 });
draw('ellipse', 41, 56, 29, 25, {
  fill: blue,
  fillStyle: 'hachure',
  hachureGap: 3,
});
draw('ellipse', 80, 36, 29, 25, {
  stroke: red,
  fill: red,
  fillStyle: 'hachure',
  hachureGap: 3,
});
draw('path', 'M69 22 L66 10 L75 15 L80 6 L85 15 L94 10 L91 22 Z', {
  stroke: red,
});
await save('turkdamasi');

// Wooden matchsticks with red heads, drawn in the catalog's pencil style.
for (const [x1, y1, x2, y2] of [
  [24, 69, 58, 17],
  [52, 72, 88, 22],
  [19, 45, 96, 45],
]) {
  draw('line', x1, y1, x2, y2, { stroke: '#937044', strokeWidth: 4 });
  draw('ellipse', x2, y2, 7, 10, {
    stroke: red,
    fill: red,
    fillStyle: 'solid',
  });
}
await save('kibrit');

// Dark sketchbook, silver maze walls and a turquoise path.
draw('rectangle', 16, 9, 88, 74, {
  fill: '#1c1b1a',
  fillStyle: 'solid',
  stroke: '#393730',
});
for (const path of [
  'M38 17H94V73H80',
  'M25 17V73H66',
  'M38 17V31H66V45H81V59',
  'M25 45H51V59H38',
  'M80 17V31H94',
  'M66 73V59',
])
  draw('path', path, { stroke: '#f1eee6', strokeWidth: 1.5, roughness: 0.7 });
draw('path', 'M31 10V38H58V52H73V79', { stroke: '#3fd6c8', strokeWidth: 2.3 });
await save('labirent');

// Kakuro: graphite clue cells, diagonal totals and pencil entries.
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 3; col++) {
    const x = 23 + col * 24,
      y = 9 + row * 24;
    draw('rectangle', x, y, 24, 24, {
      stroke: '#555555',
      strokeWidth: 1.2,
      ...(row === 0 || col === 0
        ? { fill: '#414844', fillStyle: 'solid' }
        : {}),
    });
    if ((row === 0 || col === 0) && row + col > 0)
      draw('line', x + 2, y + 2, x + 22, y + 22, {
        stroke: '#fbf9f2',
        strokeWidth: 1,
      });
  }
draw('path', 'M56 41L60 38V53', { stroke: blue });
draw('path', 'M79 40Q88 35 88 42L79 53H89', { stroke: blue });
draw('path', 'M54 62H64L58 68Q67 68 63 76H54', { stroke: blue });
await save('kakuro');
// Seven canonical tangram pieces in a square, from the game's geometry.
const geometry = require('../games/tangram/geometry.js');
const tangram = require('../games/tangram/puzzles/catalog.js').find(
  (p) => p.id === 'kare',
);
const tangramPolygons = tangram.solutions[0].map((p) =>
  geometry.transformPiece(p),
);
const xs = tangramPolygons.flat().map((p) => p[0]),
  ys = tangramPolygons.flat().map((p) => p[1]);
const minX = Math.min(...xs),
  minY = Math.min(...ys);
const tangramScale =
  68 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
for (const [i, points] of tangramPolygons.entries()) {
  draw(
    'polygon',
    points.map(([x, y]) => [
      (x - minX) * tangramScale + 26,
      (y - minY) * tangramScale + 11,
    ]),
    {
      stroke: i % 2 ? red : blue,
      fill: i % 2 ? red : blue,
      fillStyle: 'hachure',
      hachureGap: 5,
    },
  );
}
await save('tangram');
// Two graphite dominoes with matching threes.
for (const [x, y, a, b] of [
  [12, 14, 2, 3],
  [64, 24, 3, 5],
]) {
  draw('rectangle', x, y, 40, 60, { stroke: '#555555' });
  draw('line', x, y + 30, x + 40, y + 30, { stroke: '#555555' });
  for (const [value, cy] of [
    [a, y + 15],
    [b, y + 45],
  ]) {
    const dots =
      value === 2
        ? [
            [-8, -7],
            [8, 7],
          ]
        : value === 3
          ? [
              [-8, -7],
              [0, 0],
              [8, 7],
            ]
          : [
              [-8, -7],
              [8, -7],
              [0, 0],
              [-8, 7],
              [8, 7],
            ];
    for (const [dx, dy] of dots)
      draw('circle', x + 20 + dx, cy + dy, 4, {
        stroke: '#555555',
        fill: '#555555',
        fillStyle: 'solid',
      });
  }
}
await save('domino');

// Two rows of six pits and two stores, filled with pencil-coloured stones.
draw('rectangle', 5, 20, 110, 53, { stroke: '#555555', roughness: 1 });
for (const x of [12, 108])
  draw('ellipse', x, 47, 10, 36, { stroke: '#555555' });
for (const y of [35, 58]) {
  for (let i = 0; i < 6; i++) {
    const x = 28 + i * 13;
    draw('ellipse', x, y, 10, 15, { stroke: '#555555', strokeWidth: 1 });
    draw('circle', x, y - 2, 3, {
      fill: y === 35 ? red : blue,
      fillStyle: 'solid',
      stroke: y === 35 ? red : blue,
    });
    draw('circle', x + 1, y + 3, 3, {
      fill: '#c58742',
      fillStyle: 'solid',
      stroke: '#c58742',
    });
  }
}
await save('mangala');

// A small heart revealed by pencil hatching on a nonogram grid.
for (let i = 0; i <= 5; i++) {
  draw('line', 31 + i * 13, 16, 31 + i * 13, 81, {
    stroke: '#8aa3bc',
    strokeWidth: 0.7,
  });
  draw('line', 31, 16 + i * 13, 96, 16 + i * 13, {
    stroke: '#8aa3bc',
    strokeWidth: 0.7,
  });
}
for (const [row, col] of [
  [0, 1],
  [0, 3],
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 0],
  [2, 1],
  [2, 2],
  [2, 3],
  [2, 4],
  [3, 1],
  [3, 2],
  [3, 3],
  [4, 2],
])
  draw('rectangle', 32 + col * 13, 17 + row * 13, 11, 11, {
    stroke: '#4a4a4a',
    strokeWidth: 0.6,
    fill: row > 2 ? red : '#4a4a4a',
    fillStyle: 'hachure',
    hachureGap: 3,
  });
draw(
  'path',
  'M21 20L24 17V27 M19 32H25L20 37Q27 36 25 42H19 M20 48H25V52H20V58H26',
  { stroke: '#4a4a4a', strokeWidth: 1 },
);
await save('nonogram');

// Typewritten word with the game's purple pencil marks.
for (let i = 0; i < 5; i++) {
  draw('rectangle', 10 + i * 22, 28, 19, 26, {
    stroke: '#725385',
    strokeWidth: 1,
    fill: i === 0 ? '#725385' : undefined,
    fillStyle: 'hachure',
    hachureGap: 4,
  });
}
draw(
  'path',
  'M15 34V48M25 34L15 42L25 48 M37 48L42 34L47 48M39 43H45 M59 34V48H69 M91 34H81V48H91M81 41H89 M103 48V34L108 42L113 34V48',
  { stroke: '#262321', strokeWidth: 1.4, roughness: 0.35 },
);
draw('ellipse', 41, 41, 17, 23, { stroke: '#725385' });
draw('line', 59, 40, 68, 40, { stroke: '#725385' });
draw('line', 15, 68, 106, 68, { stroke: '#725385', strokeWidth: 1 });
await save('besharf');
await copyFile(
  'games/besharf/README.md',
  'public/assets/licenses/besharf-veriler.txt',
);

await writeFile(
  'public/assets/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="4" fill="#fbf9f2"/><path d="M16 10v44M5 24h54M5 39h54" stroke="#8aa3bc"/><path d="M23 13h12q22 18 0 39H23Z" fill="none" stroke="${blue}" stroke-width="4"/></svg>`,
);
const bg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><pattern id="p" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#9db6d8" stroke-width=".8"/></pattern></defs><rect width="1200" height="630" fill="#fbf9f2"/><rect width="1200" height="630" fill="url(#p)"/><path d="M100 0V630" stroke="#c62828" opacity=".5"/></svg>`,
);
const title = await sharp({
  text: {
    text: '<span foreground="#1f3b9b">DEFTERDE</span>',
    font: 'Patrick Hand 126',
    fontfile: 'public/assets/PatrickHand.ttf',
    rgba: true,
  },
})
  .png()
  .toBuffer();
const subtitle = await sharp({
  text: {
    text: '<span foreground="#1f3b9b">Bir defter dolusu oyun.</span>',
    font: 'Patrick Hand 48',
    fontfile: 'public/assets/PatrickHand.ttf',
    rgba: true,
  },
})
  .png()
  .toBuffer();
await sharp(bg)
  .composite([
    { input: title, left: 160, top: 120 },
    { input: subtitle, left: 164, top: 310 },
  ])
  .png()
  .toFile('public/assets/paylasim.png');
console.log('Local font, paper grain, seeded drawings and share image ready');
