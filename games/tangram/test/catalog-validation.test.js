const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry.js');
const V = require('../validation.js');
const examples = require('../puzzles/catalog.js');
const clone = value => structuredClone(value);

test('metadata, çözüm ve alternatif çözüm ayrı ayrı doğrulanır', () => {
  const p = clone(examples.find(p => p.id === 'dikdortgen'));
  assert.equal(V.record(p).valid, true);
  for (const key of ['id', 'name', 'category', 'difficulty', 'tags', 'source', 'solutions']) {
    const broken = clone(p); delete broken[key];
    assert.equal(V.record(broken).valid, false, key);
  }
  const bad = clone(p); bad.solutions.push(examples[0].solutions[0]);
  assert.equal(V.record(bad).valid, false, 'farklı siluet alternatif değildir');
  const alternate = clone(p.solutions[0]);
  alternate[0] = { ...alternate[0], x: 10 / 3, y: 2 / 3, rotation: 2 };
  alternate[1] = { ...alternate[1], x: 8 / 3, y: 4 / 3, rotation: 6 };
  p.solutions.push(alternate);
  assert.equal(V.record(p).valid, true);
});

test('kopya denetimi öteleme, sekiz yön ve aynaları; iç bölünmeden bağımsızdır', () => {
  const target = G.deriveTarget(examples[0].solutions[0]);
  for (let r = 0; r < 8; r++) for (const flip of [false, true]) {
    const other = V.transform(target, r, flip).map(poly => poly.map(ring => ring.map(([x,y]) => [x+19,y-7])));
    assert.equal(V.compare(target, other).duplicate, true, `${r}/${flip}`);
  }
  assert.equal(V.compare(target, G.deriveTarget(examples[1].solutions[0])).duplicate, false);
  const square = G.deriveTarget(examples.find(p=>p.id==='kare').solutions[0]);
  const rectangle = G.deriveTarget(examples.find(p=>p.id==='dikdortgen').solutions[0]);
  assert.equal(V.compare(square, rectangle).duplicate, false, 'alan eşitliği kopya değildir');
});

test('katalog kimlik ve döndürülmüş kopyayı, kategori alt sınırını yakalar', () => {
  const p = clone(examples[0]), q = clone(p); q.id = 'baska-ad'; q.name = 'Başka ad';
  assert.equal(V.catalog([p,q]).duplicates.length, 1);
  assert.equal(V.catalog([p,p]).valid, false);
  const report = V.catalog(examples.slice(0,8), { minTotal: 20, minPerCategory: 2 });
  assert.equal(report.valid, false);
  assert.ok(report.errors.some(s=>s.includes('20')));
  assert.equal(Object.keys(report.categories).length, 10);
});

test('JSON alımı kod çalıştırmaz; bozuk veya ölçeksiz olmayan veri dışa aktarılamaz', () => {
  assert.throws(()=>V.parse('window.alert(1)'));
  assert.throws(()=>V.parse('{"name":"yarım"}'));
  const p=clone(examples[0]); p.solutions[0][0].scale=2;
  assert.throws(()=>V.serialize(p));
  const text=V.serialize(examples[0]);
  assert.deepEqual(V.parse(text), [examples[0]]);
});

test('Tam katalog: 120 farklı kayıt, kategori alt sınırı ve bütün çözümler', () => {
  const report=V.catalog(examples,{minTotal:120,minPerCategory:8});
  assert.equal(report.valid,true,report.errors.join('\n'));
  assert.equal(report.distinct,120);
  assert.equal(report.accepted,0, 'İnsan incelemesi henüz yapılmadı');
  assert.ok(Object.values(report.categories).every(count=>count>=8));
  for(const p of examples) for(const solution of p.solutions) {
    assert.equal(G.evaluatePlacement(solution,G.deriveTarget(p.solutions[0])).complete,true,p.id);
  }
});

test('düzenleyici eksik, kopuk ve çakışan parçaları isimleriyle teşhis eder', () => {
  const poses=clone(examples[0].solutions[0]);
  assert.equal(V.diagnostics(poses).valid, true);
  poses[0].x += 20;
  assert.equal(V.diagnostics(poses).valid, false);
  assert.ok(V.diagnostics(poses).disconnected.includes('large-a'));
  poses[0]={...poses[1],pieceId:'large-a'};
  assert.ok(V.diagnostics(poses).overlaps.some(pair=>pair.includes('large-a')));
  assert.deepEqual(V.diagnostics(poses.slice(1)).missing,['large-a']);
});
