// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');

const YON8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const EKSEN4 = [[0, 1], [1, 0], [1, 1], [1, -1]];

// n×n boş konum; harfler: [[satır, sütun, 'S'|'O'], ...]
function kur(n, harfler, secenek) {
  const a = Array.from({ length: n }, () => Array(n).fill('.'));
  for (const [r, c, h] of harfler) a[r][c] = h;
  return G.durumdan(a.map(s => s.join('')), secenek);
}
const ind = (n, r, c) => r * n + c;
const sirali = (liste) => liste.slice().sort((a, b) => a - b);
const kopya = (d) => ({
  ...d,
  hucre: Array.from(d.hucre), yazan: Array.from(d.yazan),
  cizgiler: d.cizgiler.map(z => ({ ...z, hucreler: z.hucreler.slice() })), puan: d.puan.slice(),
});

// Bağımsız sayım: tahtadaki bütün S-O-S üçlüleri (her biri bir kez).
function tumSos(d) {
  const n = d.n, bulunan = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      for (const [dr, dc] of EKSEN4) {
        const r2 = r + 2 * dr, c2 = c + 2 * dc;
        if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue;
        if (d.hucre[ind(n, r, c)] === 1 && d.hucre[ind(n, r + dr, c + dc)] === 2 && d.hucre[ind(n, r2, c2)] === 1) {
          bulunan.add(sirali([ind(n, r, c), ind(n, r + dr, c + dc), ind(n, r2, c2)]).join(','));
        }
      }
    }
  }
  return bulunan;
}

// Rastgele yasal hamlelerle oyunu bitirir; her hamlenin sırasını kaydeder.
function rastgeleOyun(n, fazlaTur, tohum) {
  const r = G.rng(tohum);
  let d = G.yeniOyun({ boyut: n, fazlaTur });
  const sira = [];                                        // sira[i] = hücrenin kaçıncı hamlede dolduğu
  let hamle = 0;
  while (!d.bitti) {
    const bos = [];
    for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0) bos.push(i);
    const i = bos[Math.floor(r() * bos.length)];
    const harf = r() < .5 ? 'S' : 'O';
    const onceki = d;
    d = G.placeLetter(d, Math.floor(i / n), i % n, harf);
    sira[i] = hamle++;
    // her hamlede kural: puan yapan fazla tur açıksa sırayı korur
    const yaptiMi = d.son.yeni.length > 0;
    const beklenen = (fazlaTur && yaptiMi && !d.bitti) ? onceki.sira : 1 - onceki.sira;
    assert.equal(d.sira, beklenen, 'sıra kuralı');
  }
  return { d, sira };
}

test('rng: aynı tohum aynı diziyi verir, 0..1 aralığında', () => {
  const a = G.rng(42), b = G.rng(42), c = G.rng(43);
  const x = Array.from({ length: 20 }, a), y = Array.from({ length: 20 }, b), z = Array.from({ length: 20 }, c);
  assert.deepEqual(x, y);
  assert.notDeepEqual(x, z);
  assert.ok(x.every(v => v >= 0 && v < 1));
});

test('yeniOyun: boş durum, geçersiz boyut hata verir', () => {
  const d = G.yeniOyun({ boyut: 8, ilkBaslayan: 1 });
  assert.equal(d.n, 8);
  assert.equal(d.bos, 64);
  assert.equal(d.sira, 1);
  assert.deepEqual(d.puan, [0, 0]);
  assert.ok(d.hucre.every(v => v === 0));
  assert.ok(d.yazan.every(v => v === -1));
  assert.equal(d.bitti, false);
  assert.throws(() => G.yeniOyun({ boyut: 2 }), RangeError);
  assert.throws(() => G.yeniOyun({ boyut: 13 }), RangeError);
});

test('S konunca 8 yönün hepsinde S-O-S tespit edilir', () => {
  for (const [dr, dc] of YON8) {
    const d = kur(5, [[2 + dr, 2 + dc, 'O'], [2 + 2 * dr, 2 + 2 * dc, 'S']]);
    const s = G.placeLetter(d, 2, 2, 'S');
    assert.equal(s.cizgiler.length, 1, `yön ${dr},${dc}`);
    assert.deepEqual(s.cizgiler[0].hucreler, sirali([ind(5, 2, 2), ind(5, 2 + dr, 2 + dc), ind(5, 2 + 2 * dr, 2 + 2 * dc)]));
    assert.deepEqual(s.puan, [1, 0]);
  }
});

test('O konunca 4 eksenin hepsinde S-O-S tespit edilir', () => {
  for (const [dr, dc] of EKSEN4) {
    const d = kur(5, [[2 - dr, 2 - dc, 'S'], [2 + dr, 2 + dc, 'S']]);
    const s = G.placeLetter(d, 2, 2, 'O');
    assert.equal(s.cizgiler.length, 1, `eksen ${dr},${dc}`);
    assert.deepEqual(s.cizgiler[0].hucreler, sirali([ind(5, 2 - dr, 2 - dc), ind(5, 2, 2), ind(5, 2 + dr, 2 + dc)]));
  }
});

test('eksik üçlü SOS sayılmaz (S-O-O, O-O-S, tek S, yanlış harf)', () => {
  const eksik = [
    kur(5, [[2, 3, 'O'], [2, 4, 'O']]),                       // S ? O O
    kur(5, [[2, 3, 'S'], [2, 4, 'S']]),                       // S S S
    kur(5, [[2, 3, 'O']]),                                    // S O _ (uç boş)
  ];
  for (const d of eksik) assert.equal(G.placeLetter(d, 2, 2, 'S').cizgiler.length, 0);
  assert.equal(G.placeLetter(kur(5, [[2, 1, 'S']]), 2, 2, 'O').cizgiler.length, 0, 'O: yalnız bir yanda S');
  assert.equal(G.placeLetter(kur(5, [[2, 1, 'O'], [2, 3, 'O']]), 2, 2, 'O').cizgiler.length, 0);
});

test('satır sonundan sonraki satıra "sarma" yanlış SOS üretmez', () => {
  // indeksler ardışık ama geometrik olarak aynı hizada değil
  const a = kur(5, [[0, 3, 'S'], [1, 0, 'S']]);
  assert.equal(G.placeLetter(a, 0, 4, 'O').cizgiler.length, 0, 'O: (0,4) komşuları sarmamalı');
  const b = kur(5, [[0, 4, 'O'], [1, 0, 'S']]);
  assert.equal(G.placeLetter(b, 0, 3, 'S').cizgiler.length, 0, 'S: (0,3)-(0,4)-(1,0) tek hat değil');
  const c = kur(5, [[0, 4, 'S'], [1, 0, 'O']]);
  assert.equal(G.placeLetter(c, 1, 1, 'S').cizgiler.length, 0, 'S: (1,1)-(1,0)-(0,4) tek hat değil');
  // sütun sarması: (4,0)'dan sonra (0,1) gibi
  const d = kur(5, [[3, 4, 'S'], [4, 4, 'O']]);
  assert.equal(G.placeLetter(d, 0, 0, 'S').cizgiler.length, 0);
});

test('bir hamlede çoklu SOS: O ile 4, S ile 3', () => {
  const sekiz = YON8.map(([dr, dc]) => [2 + dr, 2 + dc, 'S']);
  const s = G.placeLetter(kur(5, sekiz), 2, 2, 'O');
  assert.equal(s.cizgiler.length, 4);
  assert.deepEqual(s.puan, [4, 0]);
  assert.equal(new Set(s.cizgiler.map(z => z.anahtar)).size, 4);

  const uc = [[2, 3, 'O'], [2, 4, 'S'], [3, 2, 'O'], [4, 2, 'S'], [3, 3, 'O'], [4, 4, 'S']];
  const t = G.placeLetter(kur(5, uc), 2, 2, 'S');
  assert.equal(t.cizgiler.length, 3);
  assert.deepEqual(t.puan, [3, 0]);
});

test('aynı harfler birden fazla SOS\'ta kullanılır ama her SOS bir kez sayılır', () => {
  // ortadaki O önce yatay, sonra dikey SOS'un ortak harfi olur
  let d = kur(5, [[2, 1, 'S'], [2, 3, 'S'], [1, 2, 'S']], { fazlaTur: false });
  d = G.placeLetter(d, 2, 2, 'O');                           // yalnız yatay tamam
  assert.equal(d.cizgiler.length, 1);
  d = G.placeLetter(d, 4, 4, 'S');                           // sıra döner, puansız
  d = G.placeLetter(d, 3, 2, 'S');                           // dikey: (1,2) O (3,2) aynı O'yu kullanır
  assert.equal(d.cizgiler.length, 2);
  assert.deepEqual(d.cizgiler.map(z => z.hucreler.includes(ind(5, 2, 2))), [true, true], 'ortak O');
  assert.equal(new Set(d.cizgiler.map(z => z.anahtar)).size, 2);
  assert.deepEqual(d.puan[0] + d.puan[1], 2);
  // aynı üçlüyü ikinci kez saymak mümkün olmamalı: dolu hücreye yazılamaz
  assert.throws(() => G.placeLetter(d, 3, 2, 'S'), /dolu/);
});

test('fazla tur zinciri: puanla sıra kalır, puansız değişir', () => {
  const d0 = kur(5, [[0, 0, 'S'], [0, 1, 'O'], [2, 0, 'S'], [2, 1, 'O']], { fazlaTur: true });
  const d1 = G.placeLetter(d0, 0, 2, 'S');
  assert.deepEqual(d1.puan, [1, 0]);
  assert.equal(d1.sira, 0, 'SOS yaptı: yine o oynar');
  assert.equal(d1.son.fazla, true);
  const d2 = G.placeLetter(d1, 2, 2, 'S');
  assert.deepEqual(d2.puan, [2, 0]);
  assert.equal(d2.sira, 0, 'tekrar yaptı: yine o oynar');
  const d3 = G.placeLetter(d2, 4, 4, 'S');
  assert.equal(d3.sira, 1, 'puansız hamle sırayı geçirir');
  assert.equal(d3.son.fazla, false);
  assert.deepEqual(d3.puan, [2, 0]);
  const d4 = G.placeLetter(d3, 4, 3, 'O');                  // kırmızı oynuyor, puansız
  assert.equal(d4.sira, 0);
});

test('fazlaTur kapalıyken SOS yapan da sırayı geçirir; puan yine yazılır', () => {
  const d0 = kur(5, [[0, 0, 'S'], [0, 1, 'O']], { fazlaTur: false });
  const d1 = G.placeLetter(d0, 0, 2, 'S');
  assert.deepEqual(d1.puan, [1, 0]);
  assert.equal(d1.sira, 1);
  assert.equal(d1.son.fazla, false);
});

test('puan yapan oyuncu sahibi olur (kırmızı için de)', () => {
  const d0 = kur(5, [[0, 0, 'S'], [0, 1, 'O']], { sira: 1 });
  const d1 = G.placeLetter(d0, 0, 2, 'S');
  assert.deepEqual(d1.puan, [0, 1]);
  assert.equal(d1.cizgiler[0].sahip, 1);
  assert.equal(d1.yazan[2], 1);
  assert.equal(d1.sira, 1);
});

test('son hücrede puanla biten oyun', () => {
  // 3×3, tek boş hücre (0,1): O koyunca üst satır S-O-S olur
  const d0 = G.durumdan(['S.S', 'SSS', 'SSS'], { sira: 0 });
  assert.equal(d0.bos, 1);
  const d1 = G.placeLetter(d0, 0, 1, 'O');
  assert.equal(d1.bitti, true);
  assert.equal(d1.bos, 0);
  assert.deepEqual(d1.puan, [1, 0]);
  assert.equal(d1.son.fazla, false, 'oyun bittiyse fazla tur yok');
  assert.equal(G.kazanan(d1), 0);
  assert.throws(() => G.placeLetter(d1, 0, 1, 'S'), /bitti/);
});

test('kazanan: devam eden oyunda null, eşitlikte berabere, kırmızı önde', () => {
  const baslangic = G.yeniOyun({ boyut: 3 });
  assert.equal(G.kazanan(baslangic), null);
  const son = (puan) => G.placeLetter(G.durumdan(['SSS', 'SSS', 'SS.'], { puan }), 2, 2, 'S');
  assert.equal(G.kazanan(son([2, 2])), 'berabere');
  assert.equal(G.kazanan(son([1, 3])), 1);
  assert.equal(G.kazanan(son([3, 1])), 0);
});

test('placeLetter: dolu hücre, tahta dışı ve geçersiz harf hata verir', () => {
  const d = kur(5, [[1, 1, 'S']]);
  assert.throws(() => G.placeLetter(d, 1, 1, 'O'), /dolu/);
  assert.throws(() => G.placeLetter(d, -1, 0, 'S'), RangeError);
  assert.throws(() => G.placeLetter(d, 0, 5, 'S'), RangeError);
  assert.throws(() => G.placeLetter(d, 0, 0, 'X'), TypeError);
});

test('placeLetter: girdi durumu değişmez (typed array\'ler dahil)', () => {
  const d = kur(5, [[0, 0, 'S'], [0, 1, 'O']]);
  const once = kopya(d);
  const s = G.placeLetter(d, 0, 2, 'S');
  assert.deepEqual(kopya(d), once);
  assert.notEqual(s.hucre, d.hucre);
  assert.notEqual(s.yazan, d.yazan);
  assert.notEqual(s.cizgiler, d.cizgiler);
  assert.notEqual(s.puan, d.puan);
  assert.equal(d.hucre[2], 0);
  assert.equal(s.hucre[2], 1);
});

test('puanlayanHamleler: puan getiren hücre/harf çiftlerini ve adetlerini verir', () => {
  const d = kur(5, [[0, 0, 'S'], [0, 1, 'O'], [4, 4, 'S'], [4, 3, 'O']]);
  const m = G.puanlayanHamleler(d);
  // açık biçimde: (0,2) S ve (4,2) S puan getirir
  const adlar = m.map(x => `${x.i}:${x.harf}:${x.adet}`).sort();
  assert.deepEqual(adlar, [`${ind(5, 0, 2)}:S:1`, `${ind(5, 4, 2)}:S:1`].sort());
  assert.deepEqual(G.puanlayanHamleler(G.yeniOyun({ boyut: 5 })), []);
  // çoklu: O ortada 4 SOS
  const sekiz = kur(5, YON8.map(([dr, dc]) => [2 + dr, 2 + dc, 'S']));
  assert.deepEqual(G.puanlayanHamleler(sekiz), [{ i: ind(5, 2, 2), harf: 'O', adet: 4 }]);
});

/* ---------- güvenli hamle ---------- */

test('isSafe: tehlikeli desenler (S O _, _ O S, S _ S) güvensizdir', () => {
  // O koyunca S O _ ve _ O S oluşur
  assert.equal(G.isSafe(kur(5, [[2, 1, 'S']]), 2, 2, 'O'), false, 'S O _');
  assert.equal(G.isSafe(kur(5, [[2, 3, 'S']]), 2, 2, 'O'), false, '_ O S');
  // S koyunca S O _ , _ O S ve S _ S oluşur
  assert.equal(G.isSafe(kur(5, [[2, 3, 'O']]), 2, 2, 'S'), false, 'S O _ (O sağda)');
  assert.equal(G.isSafe(kur(5, [[2, 1, 'O']]), 2, 2, 'S'), false, '_ O S (O solda)');
  assert.equal(G.isSafe(kur(5, [[2, 4, 'S']]), 2, 2, 'S'), false, 'S _ S');
  // dikey ve çapraz örnekler
  assert.equal(G.isSafe(kur(5, [[1, 2, 'S']]), 2, 2, 'O'), false, 'dikey');
  assert.equal(G.isSafe(kur(5, [[0, 0, 'S']]), 1, 1, 'O'), false, 'çapraz');
  assert.equal(G.isSafe(kur(5, [[0, 4, 'S']]), 2, 2, 'S'), false, 'ters çapraz S _ S');
});

test('isSafe: tehdit yoksa güvenli', () => {
  assert.equal(G.isSafe(G.yeniOyun({ boyut: 5 }), 2, 2, 'S'), true, 'boş tahta');
  assert.equal(G.isSafe(G.yeniOyun({ boyut: 5 }), 2, 2, 'O'), true);
  assert.equal(G.isSafe(kur(5, [[2, 3, 'S']]), 2, 2, 'S'), true, 'S S _ tehdit değil');
  assert.equal(G.isSafe(kur(5, [[2, 3, 'O']]), 2, 2, 'O'), true, 'O O _ tehdit değil');
  assert.equal(G.isSafe(kur(5, [[2, 1, 'S'], [2, 3, 'S']]), 2, 2, 'O'), true, 'S O S hücreyi doldurur: boş pencere yok');
});

test('isSafe: önceden var olan fırsat bu hamlenin suçu sayılmaz', () => {
  // A satırında "S O ." fırsatı zaten var; uzak bir hücreye koymak yeni fırsat açmaz
  const d = kur(5, [[0, 0, 'S'], [0, 1, 'O']]);
  assert.equal(G.isSafe(d, 4, 4, 'S'), true);
  assert.equal(G.isSafe(d, 4, 4, 'O'), true);
});

test('isSafe: bağımsız (kaba kuvvet) tanımla rastgele konumlarda aynı sonucu verir', () => {
  // Tanım: hamleden sonra rakibin bir (hücre, harf) hamlesiyle tamamlayabileceği S-O-S üçlüsü sayısı artıyorsa güvensiz.
  const r = G.rng(2024);
  let kontrol = 0, guvensiz = 0;
  for (let t = 0; t < 400; t++) {
    const n = 4 + Math.floor(r() * 3);
    const satirlar = Array.from({ length: n }, () => Array.from({ length: n }, () => {
      const x = r(); return x < .45 ? '.' : x < .75 ? 'S' : 'O';
    }).join(''));
    const d = G.durumdan(satirlar);
    for (let i = 0; i < n * n; i++) {
      if (d.hucre[i] !== 0) continue;
      for (const harf of ['S', 'O']) {
        const sonra = d.hucre.slice(); sonra[i] = G.HARF[harf];
        let yeniFirsat = false;
        for (let j = 0; j < n * n && !yeniFirsat; j++) {
          if (sonra[j] !== 0) continue;
          for (const h of ['S', 'O']) {
            if (G.sosBul(sonra, n, j, h).length > G.sosBul(d.hucre, n, j, h).length) yeniFirsat = true;
          }
        }
        assert.equal(G.isSafe(d, Math.floor(i / n), i % n, harf), !yeniFirsat, `${satirlar.join('/')} ${G.hucreAdi(Math.floor(i / n), i % n)}${harf}`);
        kontrol++; if (yeniFirsat) guvensiz++;
      }
    }
  }
  assert.ok(kontrol > 5000 && guvensiz > 500, `yeterince çeşitli konum (${kontrol} kontrol, ${guvensiz} güvensiz)`);
});

test('guvenliSayisi: hücrenin en az bir harfi güvenliyse sayılır', () => {
  assert.equal(G.guvenliSayisi(G.yeniOyun({ boyut: 5 })), 25);
  // (2,2): O koyarsan S O _ , S koyarsan _ O S oluşur: iki harfi de güvensiz bir hücre
  const d = kur(5, [[2, 1, 'S'], [1, 2, 'O']]);
  assert.equal(G.isSafe(d, 2, 2, 'O'), false);
  assert.equal(G.isSafe(d, 2, 2, 'S'), false);
  let elle = 0, bos = 0;
  for (let i = 0; i < 25; i++) {
    if (d.hucre[i] !== 0) continue;
    bos++;
    if (G.isSafe(d, Math.floor(i / 5), i % 5, 'S') || G.isSafe(d, Math.floor(i / 5), i % 5, 'O')) elle++;
  }
  assert.equal(G.guvenliSayisi(d), elle);
  assert.ok(elle < bos, 'iki harfi de güvensiz hücre sayılmamalı');
});

/* ---------- rastgele oyunlarla bağımsız yeniden sayım ---------- */

test('rastgele tam oyunlar: çizgiler tekil, puan toplamı tahtadaki tüm SOS\'lara eşit, sahip son yazana ait', () => {
  let toplamSos = 0;
  for (const fazlaTur of [true, false]) {
    for (const n of [3, 4, 5, 6, 8]) {
      for (let tohum = 1; tohum <= 25; tohum++) {
        const { d, sira } = rastgeleOyun(n, fazlaTur, tohum * 131 + n);
        assert.equal(d.bitti, true);
        assert.equal(d.bos, 0);
        const anahtarlar = d.cizgiler.map(z => z.anahtar);
        assert.equal(new Set(anahtarlar).size, anahtarlar.length, 'tekilleştirme');
        const bagimsiz = tumSos(d);
        assert.equal(d.cizgiler.length, bagimsiz.size, 'çizgi sayısı = tahtadaki SOS sayısı');
        assert.deepEqual(new Set(anahtarlar), bagimsiz, 'aynı üçlüler');
        assert.equal(d.puan[0] + d.puan[1], d.cizgiler.length);
        for (const z of d.cizgiler) {
          const sonYazilan = z.hucreler.reduce((a, b) => (sira[b] > sira[a] ? b : a));
          assert.equal(z.sahip, d.yazan[sonYazilan], 'SOS\'u tamamlayan (son yazan) puanı alır');
        }
        toplamSos += d.cizgiler.length;
      }
    }
  }
  assert.ok(toplamSos > 500, 'testler gerçekten SOS üretiyor');
});

test('puan toplamı hamle hamle tutarlı: son.yeni sayısı = puan artışı', () => {
  const r = G.rng(99);
  let d = G.yeniOyun({ boyut: 6 });
  while (!d.bitti) {
    const bos = [];
    for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0) bos.push(i);
    const i = bos[Math.floor(r() * bos.length)];
    const onceki = d.puan[d.sira], oyuncu = d.sira, onceBos = d.bos;
    d = G.placeLetter(d, Math.floor(i / 6), i % 6, r() < .5 ? 'S' : 'O');
    assert.equal(d.puan[oyuncu] - onceki, d.son.yeni.length);
    assert.equal(d.bos, onceBos - 1);
  }
});
