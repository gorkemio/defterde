// ai.js testleri: hiçbir zorlukta kendi beşini kaçırmaz, rakibin dördünü (açık dahil) her zaman kapatır; 10 VCF
// bulmacasında zor doğru (bağımsız çözücüyle doğrulanan) hamleyi bulur; orta 400 ms, zor 1.5 s bütçesini aşmaz; tek dilim
// kısa kalır; eşzamanlı ve dilimli seçim aynı hamleyi verir; iptal temiz; kendi kendine oyunda güç sırası.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const E = require('../eval.js');
const AI = require('../ai.js');
const { konum } = require('./yardim.js');
const { kazanirMi } = require('./yavas-vcf.js');
const BULMACALAR = require('./vcf-bulmacalar.js');

const HIZLI = { orta: { zorluk: 'orta', dugumSiniri: 4000 }, zor: { zorluk: 'zor', dugumSiniri: 6000 }, kolay: { zorluk: 'kolay' } };

// board.js ile (eval'den bağımsız) s'nin beş yapan kareleri
function besKareleri(d, s) {
  const k = B.konumKur(d.ayar, d.hamleler, s), l = [];
  const n = d.ayar.boyut;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!B.tas(k, r, c) && B.oyna(k, r, c).kazanan === s) l.push(r * n + c);
  return l;
}

// Kolay–kolay oyunlarından zorunlu anlar: sıradakinin beşi ya da rakibin tamamlaması olan konumlar
function zorunluKonumlar(adet, tohum) {
  const liste = [];
  for (let g = 0; liste.length < adet && g < 2000; g++) {
    const rnd = B.rng(tohum + g);
    let d = B.yeniOyun({});
    while (!d.bitti && liste.length < adet) {
      const ben = besKareleri(d, d.sira), onun = besKareleri(d, 3 - d.sira);
      if (ben.length || onun.length) liste.push({ d, ben, onun });
      const h = AI.sec(d, { zorluk: 'kolay', tohum: Math.floor(rnd() * 1e9) });
      d = B.oyna(d, h.r, h.c);
    }
  }
  return liste;
}

test('hiçbir zorlukta kendi beşini kaçırmaz, rakibin dördünü her zaman kapatır (300 konum × 3 zorluk)', () => {
  const konumlar = zorunluKonumlar(300, 5000);
  assert.equal(konumlar.length, 300);
  let acikDortKapat = 0;
  for (const { d, ben, onun } of konumlar) {
    for (const z of ['kolay', 'orta', 'zor']) {
      const h = AI.sec(d, HIZLI[z]);
      const k = h.r * 15 + h.c;
      if (ben.length) assert.ok(ben.includes(k), `${z}: kendi beşi kaçtı (${h.tur})`);
      else {
        assert.ok(onun.includes(k), `${z}: rakibin dördü kapatılmadı (${h.tur})`);
        if (onun.length >= 2) acikDortKapat++;
      }
    }
  }
  assert.ok(acikDortKapat > 0, 'açık dört örnekleri de sınanmalı');
});

test('rakibin açık üçünü orta ve zor kapatır ya da daha güçlü tehdit kurar', () => {
  // X sırada; O'nun açık üçü (7,5..7) var, X'in tehdidi yok
  const d = konum([
    '...............', '...............', '...............', '...............', '...............',
    '........X......', '...............', '.....OOO.......', '...X...........', '...............',
  ], {}, B.X);
  for (const z of ['orta', 'zor']) {
    const h = AI.sec(d, HIZLI[z]);
    const y = B.oyna(d, h.r, h.c);
    // hamleden sonra O tek hamlede açık dört yapamamalı
    const P = E.pencereKur(y);
    const acik = E.adaylar(P).some(i => E.dortDuzeyi(P, i, B.O) >= 2);
    assert.equal(acik, false, `${z} açık üçü bıraktı: ${B.hucreAdi(h.r, h.c)}`);
  }
});

test('10 VCF bulmacasında zor, sürekli dörtle kazanan hamleyi bulur (bağımsız çözücüyle doğrulanır)', () => {
  assert.equal(BULMACALAR.length, 10);
  BULMACALAR.forEach((b, k) => {
    const s = b.sira === 'X' ? B.X : B.O;
    const d = konum(b.satirlar, {}, s);
    assert.equal(AI.zorunluHamle(d), null, `bulmaca ${k + 1}: zorunlu hamle olmamalı`);
    const h = AI.sec(d, { zorluk: 'zor' });
    assert.ok(kazanirMi(d, s, h.r, h.c, b.uzunluk + 2), `bulmaca ${k + 1}: ${B.hucreAdi(h.r, h.c)} kazandırmıyor (${h.tur})`);
  });
});

// orta oyun konumları: kolay–kolay oyunlarının 16.–30. hamleleri, zorunlu anı olmayanlar
function ortaOyun(adet) {
  const liste = [];
  for (let g = 0; liste.length < adet; g++) {
    const rnd = B.rng(900 + g);
    let d = B.yeniOyun({});
    const hedef = 16 + Math.floor(rnd() * 14);
    while (!d.bitti && d.hamleler.length < hedef) {
      const h = AI.sec(d, { zorluk: 'kolay', tohum: Math.floor(rnd() * 1e9) });
      d = B.oyna(d, h.r, h.c);
    }
    if (!d.bitti && !AI.zorunluHamle(d)) liste.push(d);
  }
  return liste;
}

test('bütçe: orta ≤ 400 ms, zor ≤ 1.5 s (+ tolerans); düğüm, derinlik, süre tablosu', () => {
  const konumlar = ortaOyun(10);
  const tablo = [];
  for (const z of ['orta', 'zor']) {
    const sinir = z === 'orta' ? 400 + 60 : 1500 + 100;
    for (const d of konumlar) {
      const t = performance.now();
      const h = AI.sec(d, { zorluk: z });
      const sure = performance.now() - t;
      tablo.push(`${z} ${String(d.hamleler.length).padStart(2)}. hamle: ${Math.round(sure)} ms, ${h.dugum} düğüm, derinlik ${h.derinlik ?? '-'} (${h.tur})`);
      assert.ok(sure <= sinir, `${z} bütçeyi aştı: ${Math.round(sure)} ms`);
    }
  }
  console.log(tablo.join('\n'));
});

test('dilim: zor aramada tek adim(8) 30 ms’yi geçmez', () => {
  // aramanın gerçekten uzun sürdüğü ilk konum (hemen karar verilen konumlar dilime bölünmez)
  let enUzun = 0, n = 0;
  for (const d of ortaOyun(6)) {
    AI.ttTemizle();
    const st = AI.baslat(d, { zorluk: 'zor', butceMs: 900 });
    enUzun = 0; n = 0;
    while (!st.bitti) {
      const t = performance.now();
      st.adim(8);
      enUzun = Math.max(enUzun, performance.now() - t);
      n++;
    }
    if (n > 20) break;
  }
  assert.ok(n > 20, 'arama dilimlere bölünmeli: ' + n);
  assert.ok(enUzun <= 30, 'en uzun dilim ' + enUzun.toFixed(1) + ' ms');
});

test('eşzamanlı sec ve dilimli secAsync aynı hamleyi verir (düğüm sınırıyla); iptal AbortError', async () => {
  const d = ortaOyun(2)[1];
  const ayar = { zorluk: 'zor', dugumSiniri: 20000 };
  AI.ttTemizle();
  const a = AI.sec(d, ayar);
  AI.ttTemizle();
  const b = await AI.secAsync(d, ayar);
  assert.deepEqual([a.r, a.c], [b.r, b.c]);
  // iptal dilimler arasında denetlenir (node'da sürekli port mesajı zamanlayıcıyı bekletir: iptal ilk dilimden önce)
  const iptal = new AbortController();
  const p = AI.secAsync(d, { zorluk: 'zor' }, { signal: iptal.signal });
  await Promise.resolve();
  iptal.abort();
  const t = performance.now();
  await assert.rejects(p, (e) => e.name === 'AbortError');
  assert.ok(performance.now() - t < 100, 'iptal hemen');
});

test('ilk hamle ortaya yakın; tek taşa komşu cevap', () => {
  const h = AI.sec(B.yeniOyun({}), { zorluk: 'zor' });
  assert.ok(Math.abs(h.r - 7) <= 1 && Math.abs(h.c - 7) <= 1);
  const d = B.oynat({}, [[7, 7]]);
  for (const z of ['kolay', 'orta', 'zor']) {
    const y = AI.sec(d, HIZLI[z]);
    assert.ok(Math.max(Math.abs(y.r - 7), Math.abs(y.c - 7)) <= 2, z);
  }
});

test('sınırsız sayfa: negatif koordinatta beşi yapar, dördü kapatır', () => {
  const d = B.konumKur({ boyut: 0 }, [
    ...[-20, -19, -18, -17].map(c => ({ r: -30, c, sembol: B.X })),
    ...[5, 6, 7, 8].map(c => ({ r: 40, c, sembol: B.O })),
  ], B.X);
  const h = AI.sec(d, HIZLI.zor);
  assert.equal(h.r, -30);
  assert.ok(h.c === -21 || h.c === -16);
  const d2 = B.konumKur({ boyut: 0 }, [
    { r: -30, c: -20, sembol: B.X }, { r: -29, c: -18, sembol: B.X },
    ...[5, 6, 7, 8].map(c => ({ r: 40, c, sembol: B.O })),
  ], B.X);
  const h2 = AI.sec(d2, HIZLI.orta);
  assert.equal(h2.r, 40);
  assert.ok(h2.c === 4 || h2.c === 9);
});

// kendi kendine oyun: açılış ortada üç rastgele taş; renkler sırayla değişir
function mac(a, b, oyun, ayarA, ayarB) {
  let kazanA = 0, kazanB = 0;
  for (let g = 0; g < oyun; g++) {
    const rnd = B.rng(4242 + g);
    let d = B.yeniOyun({});
    while (d.hamleler.length < 3) {
      const r = 5 + Math.floor(rnd() * 5), c = 5 + Math.floor(rnd() * 5);
      if (B.gecerliMi(d, r, c)) d = B.oyna(d, r, c);
    }
    const kim = g % 2 ? { 1: 'a', 2: 'b' } : { 1: 'b', 2: 'a' };
    while (!d.bitti) {
      const ayar = Object.assign({ tohum: g * 97 + d.hamleler.length }, kim[d.sira] === 'a' ? ayarA : ayarB);
      const h = AI.sec(d, ayar);
      d = B.oyna(d, h.r, h.c);
    }
    if (d.kazanan === 'berabere') continue;
    if (kim[d.kazanan] === 'a') kazanA++; else kazanB++;
  }
  console.log(`${a} – ${b}: ${kazanA} – ${kazanB} (${oyun} oyun)`);
  return kazanA / oyun;
}

test('güç sırası (kendi kendine oyun, düğüm sınırlı): orta > kolay, zor > kolay', () => {
  AI.ttTemizle();
  assert.ok(mac('orta', 'kolay', 8, { zorluk: 'orta' }, { zorluk: 'kolay' }) >= .75);
  assert.ok(mac('zor', 'kolay', 6, { zorluk: 'zor', dugumSiniri: 25000 }, { zorluk: 'kolay' }) >= .83);
});

/* ---------- oyun sonu analizi ---------- */

test('analiz: açık üçü kapatmayan hamle kaybettirendir', () => {
  // X açık üç kurar; O uzaklara yazar; X açık dört, O bir ucu kapatır, X beş
  const d = B.oynat({}, [[7, 5], [0, 0], [7, 6], [0, 14], [7, 7], [14, 0], [7, 8], [7, 9], [7, 4]]);
  assert.equal(d.kazanan, B.X);
  const a = AI.analiz(d.ayar, d.hamleler, { dugumSiniri: 30000 });
  assert.equal(a.hamleNo, 5, JSON.stringify(a));
  assert.deepEqual(a.oynanan, [14, 0]);
  assert.ok([[7, 4], [7, 8], [7, 3], [7, 9]].some(([r, c]) => a.enIyi[0] === r && a.enIyi[1] === c), JSON.stringify(a.enIyi));
  assert.equal(a.aciklama, 'burada açık üçü kapatmak gerekiyordu');
  assert.ok(a.catal && a.catal.hamleNo === 6, 'açık dört çatal olarak gösterilir');
});

test('analiz: dördü kapatmayan hamle; berabere / bitmemiş oyunda sonuç yok', () => {
  const d = B.oynat({}, [[7, 4], [7, 3], [7, 5], [0, 0], [7, 6], [0, 2], [7, 7], [0, 4], [7, 8]]);
  assert.equal(d.kazanan, B.X);
  const a = AI.analiz(d.ayar, d.hamleler, { dugumSiniri: 30000 });
  assert.equal(a.hamleNo, 7);
  assert.deepEqual(a.enIyi, [7, 8]);
  assert.equal(a.aciklama, 'burada dördü kapatmak gerekiyordu');
  assert.equal(AI.analiz({}, B.oynat({}, [[7, 7], [7, 8]]).hamleler), null);
});

test('analiz: dilimli sürüm aynı sonucu verir', async () => {
  const d = B.oynat({}, [[7, 5], [0, 0], [7, 6], [0, 14], [7, 7], [14, 0], [7, 8], [7, 9], [7, 4]]);
  const a = await AI.analizAsync(d.ayar, d.hamleler, { dugumSiniri: 30000 });
  assert.equal(a.hamleNo, 5);
});
