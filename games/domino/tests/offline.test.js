const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('entry uses only local classic scripts and all referenced local assets exist',()=>{
  // The back link to the Defterde contents page is navigation, not a loaded resource.
  const html=fs.readFileSync('index.html','utf8').replace(/<a [^>]*>/g,''),queue=['style.css','kit/kagit.css','kit/kursunkalem.css'];
  assert.ok(!/type=["']module|https?:\/\//.test(html));
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(match[1]));
    assert.ok(fs.existsSync(match[1].split('?')[0]),match[1]);
  }
  for(const file of queue) {
    const css=fs.readFileSync(file,'utf8');
    for(const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const url=match[1];
      if(url.startsWith('data:'))continue;
      assert.ok(!/^(https?:)?\/\//.test(url));
      assert.ok(fs.existsSync(path.join(path.dirname(file),url)),url);
    }
  }
  for(const file of ['board.js','match.js','view.js','layout.js','ai.js','ui-support.js','ui.js','draw.js']) {
    assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(/.test(fs.readFileSync(file,'utf8')),file);
  }
});
test('paper needs no file mask request; reduced-motion disables placement animation',()=>{
  const css=fs.readFileSync('style.css','utf8');
  assert.ok(!css.includes('url("assets/paper-edge.svg")'));
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/animation: none !important/);
});
