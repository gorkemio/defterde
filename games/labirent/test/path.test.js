const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../engine/topology.js');
const G = require('../engine/generate.js');
const P = require('../engine/path.js');
const R = require('../engine/rng.js');

const PAY = .3;
// Dairede iz yayı kısa kirişlerle izler; kirişin sehimi ≤ 0.0002 birim (bir hücrenin onbinde ikisi, piksel altı).
const SEHIM = 1e-3;

// İzin her noktası ve parçası, yakındaki bütün duvarlardan en az PAY uzakta mı?
function izDuvaraDegmez(d, ad) {
  const lab = d.lab, g = lab.grid, onbellek = new Map();
  const duvarlar = (h) => {
    if (!onbellek.has(h)) onbellek.set(h, [h, ...g.komsu[h].map(e => e.j)].flatMap(x => T.hucreDuvarlari(lab, x)));
    return onbellek.get(h);
  };
  for (let i = 1; i < d.iz.length; i++) {
    const [ax, ay] = d.iz[i - 1], [bx, by] = d.iz[i];
    for (let k = 0; k <= 4; k++) {
      const p = [ax + (bx - ax) * k / 4, ay + (by - ay) * k / 4];
      const h = P.hucreBul(g, p);
      const yakin = h >= 0 ? duvarlar(h) : T.duvarlar(lab);
      const en = Math.min(...yakin.map(w => T.geoUzaklik(w, p)));
      if (en < PAY - SEHIM) return `${ad}: iz ${i} (${p.map(v => v.toFixed(3))}) duvara ${en.toFixed(3)}`;
    }
  }
  return null;
}

function yolGecerli(d) {
  const { lab, hucreler } = d;
  if (hucreler[0] !== lab.giris.hucre) return 'girişten başlamıyor';
  for (let i = 1; i < hucreler.length; i++) if (!T.acikMi(lab, hucreler[i - 1], hucreler[i])) return `duvardan geçti: ${hucreler[i - 1]}→${hucreler[i]}`;
  if (new Set(hucreler).size !== hucreler.length) return 'aynı hücre iki kez';
  for (let i = 0; i < hucreler.length; i++) if (d.konum[hucreler[i]] !== i) return 'konum tablosu bozuk';
  return null;
}

test('10 000 rastgele işaretçi izi: yol hep geçerli, iz hiçbir duvara değmiyor (4 topoloji; dokumada korkuluk hariç)', () => {
  const labs = ['D-O-W-2345', 'D-B-P-2222', 'A-O-K-3333', 'A-K-G-4444', 'H-O-W-5555', 'H-B-K-6666', 'T-O-K-7777'].map(k => G.uret(k));
  const r = R.rng('izler');
  for (let deneme = 0; deneme < 10000; deneme++) {
    const lab = labs[deneme % labs.length], g = lab.grid, d = P.yeni(lab, { pay: PAY });
    let p = P.agizOrta(g, lab.giris);
    assert.ok(P.basla(d, p));
    for (let adim = 0; adim < 40 && !d.bitti; adim++) {
      // çoğu küçük adım, arada hızlı kaydırma ve sıçrama; bazen bırakıp uçtan yeniden başlar
      const boy = r() < .15 ? 1 + r() * 3 : r() * .5, aci = r() * 2 * Math.PI;
      p = [p[0] + Math.cos(aci) * boy * g.adim, p[1] + Math.sin(aci) * boy * g.adim];
      if (r() < .03) { P.birak(d); p = d.iz[d.iz.length - 1]; P.basla(d, p); }
      P.surukle(d, p);
      const hata = yolGecerli(d);
      if (hata) assert.fail(`${lab.kod} deneme ${deneme}: ${hata}`);
    }
    { const hata = izDuvaraDegmez(d, `${lab.kod} deneme ${deneme}`); if (hata) assert.fail(hata); }
  }
});

test('çözüm boyunca sürüklemek çıkışta bitirir; iz duvara değmez', () => {
  const S = require('../engine/solve.js');
  for (const kod of ['D-B-K-7KQ9', 'A-O-W-7KQ9', 'H-O-G-7KQ9']) {
    const lab = G.uret(kod), g = lab.grid, d = P.yeni(lab, { pay: PAY }), yol = S.cozum(lab);
    assert.ok(P.basla(d, P.agizOrta(g, lab.giris)));
    for (const h of yol) {
      const [x, y] = g.merkez(h);
      for (let k = 0; k < 3; k++) P.surukle(d, [x + (k - 1) * .05, y]);
    }
    assert.ok(d.bitti, kod);
    assert.deepEqual(d.hucreler, yol);
    assert.equal(d.olay.filter(o => o.tip === 'bitis').length, 1);
    assert.equal(izDuvaraDegmez(d, kod), null);
    assert.equal(P.istatistik(d, yol.length - 1).verim, 1);
  }
});

// 5 × 5 elle labirent (solve.test.js'teki): 0 1 2 3 4 / 9 8 7 6 5 / 10 15 20 21 22 17 12 13 14 19 24
const ELLE = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 9], [9, 8], [8, 7], [7, 6], [6, 5], [5, 10], [10, 15], [15, 20],
  [20, 21], [21, 22], [22, 17], [17, 12], [12, 13], [13, 14], [14, 19], [19, 24], [10, 11], [11, 16], [17, 18], [22, 23]];
const elle = () => G.elle(T.dik(5, 5), ELLE, { hucre: 0, kenar: 'K' }, { hucre: 24, kenar: 'G' });
const merkez = (i) => [i % 5 + .5, Math.floor(i / 5) + .5];

test('duvar: bitişik kapalı hücreye geçilmez, takılma bir kez bildirilir', () => {
  const d = P.yeni(elle(), { pay: PAY });
  P.basla(d, [.5, .2]);
  P.surukle(d, [.5, 1.5]);                    // 0 → 5: arada duvar
  P.surukle(d, [.5, 1.6]);
  assert.deepEqual(d.hucreler, [0]);
  assert.equal(d.olay.filter(o => o.tip === 'takildi').length, 1);
  P.surukle(d, merkez(1));                    // açık geçit
  assert.deepEqual(d.hucreler, [0, 1]);
});

test('hızlı kaydırma: açık geçitlerden en çok 6 hücre doldurur, duvarın öbür yanına atlamaz', () => {
  const d = P.yeni(elle(), { pay: PAY });
  P.basla(d, [.5, .3]);
  P.surukle(d, merkez(4));                    // 0'dan 4'e tek hamlede: 1 2 3 4 doldurulur
  assert.deepEqual(d.hucreler, [0, 1, 2, 3, 4]);
  P.surukle(d, merkez(14));                   // 4 → 14: duvarın öbür yanı; açık yol 9 8 7 6 5 10 … çok uzun
  assert.deepEqual(d.hucreler, [0, 1, 2, 3, 4]);
  assert.ok(d.olay.some(o => o.tip === 'takildi'));
  P.surukle(d, merkez(4));
  P.surukle(d, merkez(7));                    // 4 → 7 (9 8 7): kısa hareket ama yol 3 hücre; sınır ⌈1.6 × 2.2⌉ + 1 = 5 yeter
  assert.deepEqual(d.hucreler, [0, 1, 2, 3, 4, 9, 8, 7]);
});

test('geri sarma: önceki hücreye dönmek sarar, BFS geri yolu da sarar; sayaçlar doğru', () => {
  const d = P.yeni(elle(), { pay: PAY });
  P.basla(d, [.5, .3]);
  for (const h of [1, 2, 3, 4, 9, 8]) P.surukle(d, merkez(h));
  assert.deepEqual(d.hucreler, [0, 1, 2, 3, 4, 9, 8]);
  const izUzunluk = d.iz.length;
  P.surukle(d, merkez(9));                     // bir geri
  assert.deepEqual(d.hucreler, [0, 1, 2, 3, 4, 9]);
  assert.ok(d.iz.length < izUzunluk);
  P.surukle(d, merkez(3));                     // 9 → 3: 4'ün üstünden iki geri (BFS)
  assert.deepEqual(d.hucreler, [0, 1, 2, 3]);
  assert.equal(d.geriSayisi, 1);               // kesintisiz geri sarma tek dönüş sayılır
  assert.equal(d.geriAdim, 3);
  P.surukle(d, merkez(4)); P.surukle(d, merkez(3));
  assert.equal(d.geriSayisi, 2);
  assert.equal(d.toplamAdim, 7);
  const geri = d.olay.filter(o => o.tip === 'geri');
  assert.ok(geri.every(o => o.silinen.length >= 2));
});

test('çıkış doğru tespit edilir; bitince çizim durur', () => {
  const lab = elle(), d = P.yeni(lab, { pay: PAY }), yol = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 15, 20, 21, 22, 17, 12, 13, 14, 19, 24];
  P.basla(d, [.5, .3]);
  for (const h of yol.slice(0, -1)) P.surukle(d, merkez(h));
  assert.ok(!d.bitti);
  P.surukle(d, merkez(24));
  assert.ok(d.bitti && !d.aktif);
  const son = d.iz[d.iz.length - 1];
  assert.deepEqual(son, [4.5, 5]);              // iz çıkış ağzından dışarı uzanır
  P.surukle(d, merkez(19));
  assert.equal(d.hucreler[d.hucreler.length - 1], 24);
  assert.equal(P.basla(d, merkez(24)), false);
});

test('başlama: uca 1.5 hücreden uzakta basınca uzamaz, "uzak" bildirir; bırakılan yerden devam eder', () => {
  const d = P.yeni(elle(), { pay: PAY });
  assert.equal(P.basla(d, merkez(12)), false);
  assert.equal(d.olay[0].tip, 'uzak');
  assert.ok(P.basla(d, [.5, .4]));
  P.surukle(d, merkez(1)); P.surukle(d, merkez(2));
  P.birak(d);
  P.surukle(d, merkez(3));
  assert.deepEqual(d.hucreler, [0, 1, 2]);
  assert.equal(P.basla(d, merkez(4)), false);   // uç 2'de: 4 iki hücre uzakta
  assert.equal(P.basla(d, merkez(3)), true);    // bir hücre: devam
  P.surukle(d, merkez(3));
  assert.deepEqual(d.hucreler, [0, 1, 2, 3]);
});

test('klavye: oklar hücre hücre ilerletir, geri yöndeki ok sarar, duvarda takılır', () => {
  const d = P.yeni(elle(), { pay: PAY });
  P.ok(d, [0, 1]);                               // aşağı: 0 → 5 duvar
  assert.deepEqual(d.hucreler, [0]);
  P.ok(d, [1, 0]); P.ok(d, [1, 0]);
  assert.deepEqual(d.hucreler, [0, 1, 2]);
  P.ok(d, [-1, 0]);
  assert.deepEqual(d.hucreler, [0, 1]);
  assert.ok(d.olay.some(o => o.tip === 'takildi'));
});

test('bastan: yol ve sayaçlar sıfırlanır', () => {
  const d = P.yeni(elle(), { pay: PAY });
  P.basla(d, [.5, .3]); P.surukle(d, merkez(1)); P.surukle(d, merkez(0));
  P.bastan(d);
  assert.deepEqual(d.hucreler, [0]);
  assert.equal(d.iz.length, 2);
  assert.equal(d.toplamAdim + d.geriSayisi, 0);
});

test('hücre bulma ve sıkıştırma: üç topolojide nokta kendi hücresine düşer, sıkıştırılmış nokta hücrede kalır', () => {
  for (const kod of ['D-O-W-2345', 'A-O-W-2345', 'H-O-W-2345']) {
    const lab = G.uret(kod), g = lab.grid;
    for (let i = 0; i < g.n; i++) {
      const m = g.merkez(i);
      assert.equal(P.hucreBul(g, m), i, `${kod} merkez ${i}`);
      const uzak = [m[0] + 5, m[1] - 3], q = P.sikistir(g, i, uzak, PAY);
      assert.equal(P.hucreBul(g, q), i, `${kod} sıkıştırma ${i}`);
      const en = Math.min(...g.komsu[i].map(e => T.geoUzaklik(g.kenarGeo(e.k), q)).concat(g.sinir[i].map(s => T.geoUzaklik(s.geo, q))));
      assert.ok(en >= PAY - 1e-6, `${kod} ${i}: ${en}`);
    }
  }
});

test('döndürülmüş kutuda istemci → yerel nokta (eğik sayfa)', () => {
  const kutu = { sol: 10, ust: 20, w: 300, h: 600 }, aci = .7 * Math.PI / 180;
  const ileri = ([x, y]) => {          // yerel → istemci
    const ox = kutu.sol + kutu.w / 2, oy = kutu.ust + kutu.h / 2, c = Math.cos(aci), s = Math.sin(aci), dx = x - kutu.w / 2, dy = y - kutu.h / 2;
    return [ox + dx * c - dy * s, oy + dx * s + dy * c];
  };
  for (const p of [[0, 0], [150, 300], [299, 12], [40, 590]]) {
    const q = P.yerelNokta(ileri(p), kutu, aci);
    assert.ok(Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9, `${p} → ${q}`);
  }
});
