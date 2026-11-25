const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const G = require('../engine/generate.js');
const S = require('../engine/solve.js');
const H = require('../engine/ghost.js');

test('hayalet duvardan geçmez, çıkışta biter, zaman hep ileri akar', () => {
  for (const kod of ['D-O-W-3456', 'H-O-P-3456', 'A-O-K-3456']) for (const sv of ['kolay', 'orta', 'zor']) {
    const L = G.uret(kod), { iz, sure } = H.simule(L, sv, 3);
    assert.equal(iz[0].hucre, L.giris.hucre);
    assert.equal(iz[iz.length - 1].hucre, L.cikis.hucre);
    for (let i = 1; i < iz.length; i++) {
      assert.ok(T.acikMi(L, iz[i - 1].hucre, iz[i].hucre), `${kod} ${sv}: ${iz[i - 1].hucre}→${iz[i].hucre}`);
      assert.ok(iz[i].t > iz[i - 1].t);
    }
    assert.equal(sure, iz[iz.length - 1].t);
  }
});

test('Kolay hayaletin yolu çözümden belirgin uzun; Orta çıkmazlardan geri döner (Büyük, 10 labirent)', () => {
  let kolay = 0, cozum = 0, ortaGeri = 0;
  for (let s = 1; s <= 10; s++) {
    const L = G.uret({ tur: 'D', boy: 'B', alg: 'K', tohum: s }), k = H.simule(L, 'kolay', 1), o = H.simule(L, 'orta', 1);
    kolay += k.adim + k.geri;
    cozum += S.metrikler(L).cozumUzunlugu;
    ortaGeri += o.geri;
  }
  assert.ok(kolay >= 1.3 * cozum, `kolay ${kolay} / çözüm ${cozum}`);
  assert.ok(ortaGeri > 0);
});

test('seviyeler sıralı: Zor ortalamada Orta\'dan, Orta Kolay\'dan hızlı', () => {
  const ort = (sv) => {
    let t = 0;
    for (let s = 1; s <= 8; s++) { const L = G.uret({ tur: 'D', boy: 'O', alg: 'W', tohum: s }); for (let k = 1; k <= 5; k++) t += H.simule(L, sv, k).sure; }
    return t;
  };
  const k = ort('kolay'), o = ort('orta'), z = ort('zor');
  assert.ok(z < o && o < k, `${z} < ${o} < ${k}`);
});

test('aynı tohum aynı iz; farklı gürültü tohumu farklı iz', () => {
  const L = G.uret('A-B-W-3456');
  assert.deepEqual(H.simule(L, 'orta', 5), H.simule(L, 'orta', 5));
  assert.notDeepEqual(H.simule(L, 'kolay', 5).iz, H.simule(L, 'kolay', 6).iz);
});

test('bakış: çıkmazı derinliği kadar görür, çıkışı görünce seçer', () => {
  const ELLE = [[0, 1], [1, 2], [1, 6], [6, 11], [2, 3], [3, 4], [4, 9]];
  // 5 × 3: 1'den iki dal: 6 → 11 (2 hücrelik çıkmaz) ve 2 → 3 → 4 → 9 (çıkış)
  const L = G.elle(T.dik(5, 3), ELLE, { hucre: 0, kenar: 'K' }, { hucre: 9, kenar: 'D' });
  assert.equal(H.bak(L, 1, 6, 1, 9).durum, 'acik');      // 6 → 11 devam ediyor, bakış 1 göremez
  assert.equal(H.bak(L, 1, 6, 2, 9).durum, 'cikmaz');
  assert.equal(H.bak(L, 1, 2, 3, 9).durum, 'acik');
  assert.equal(H.bak(L, 1, 2, 4, 9).durum, 'cikis');
});
