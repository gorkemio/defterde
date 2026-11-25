const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('HTML, CSS ve çizim varlıkları yereldir ve dosyaları vardır', () => {
  for (const file of ['index.html','editor.html','review.html','design.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(html, /type=["']module["']/);
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      // "← İçindekiler" bir varlık değil, Defterde portalına gezinme bağlantısıdır.
      if (match[1] === '/' || match[1] === 'https://defterde.com/') continue;
      assert.doesNotMatch(match[1], /^https?:|^\/\//);
      assert.ok(fs.existsSync(path.join(root, match[1].split(/[?#]/)[0])), match[1]);
    }
  }
  for (const file of ['style.css', 'notebook.css', 'kit/kagit.css','tools/tools.css']) {
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1].startsWith('data:')) continue;
      assert.doesNotMatch(match[1], /^https?:|^\/\//);
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), match[1])), `${file}: ${match[1]}`);
    }
  }
  for (const file of ['ui.js', 'design.js', 'storage.js', 'catalog.js', 'learning.js', 'sound.js', 'draw.js', 'geometry.js', 'board.js', 'input.js', 'validation.js','authoring.js','tools/editor.js','tools/review.js','puzzles/catalog.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /\bfetch\s*\(|XMLHttpRequest/);
  }
});
