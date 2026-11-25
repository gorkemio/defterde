// node --test test/ai.test.js — bilgisayar rakip (PLAN §7.1). Sabit derinlik: kolay 2 (tohumlu gürültü), orta 4, zor 6.
// Kazanma oranı simülasyonu (A10) uzun sürer: DT_SIM=1 node --test test/ai.test.js  (npm run sim)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const AI = require('../ai.js');

function rng(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SEVIYE = { kolay: { zorluk: 'kolay', derinlik: 2 }, orta: { zorluk: 'orta', derinlik: 4 }, zor: { zorluk: 'zor', derinlik: 6 } };
const sec = (d, z, tohum = 1) => { AI.yeniOyun(); return AI.dusunSenkron(d, { ...SEVIYE[z], rastgele: rng(tohum) }); };
const ayni = (m, k, h, al) => m.kaynak === k && m.hedef === h && (al === undefined || m.al === al);

// Rastgele oyunlardan konum üreteci
function* konumlar(tohum, enAz = 2, enCok = 40) {
  const r = rng(tohum);
  for (;;) {
    let d = B.yeniOyun({}, r() < .5 ? 0 : 1);
    const hedef = enAz + Math.floor(r() * (enCok - enAz));
    for (let k = 0; k < hedef && !d.bitti; k++) {
      const l = B.hamleler(d);
      d = B.uygula(d, l[Math.floor(r() * l.length)]);
    }
    if (!d.bitti) yield d;
  }
}

// Hiçbir sakin hamle iki ayrı açık ikili (çift tehdit) yaratmıyor mu
function ciftTehditYok(d) {
  const p = d.sira;
  for (const m of B.hamleler(d)) {
    if (m.al >= 0) continue;
    const y = B.uygula({ ...d, kurallar: { ...d.kurallar, tekrar: 0, tassizHamle: 0 } }, m);
    if (B.pop(B.tehditDelikleri({ ...y, sira: p }, p)) >= 2) return false;
  }
  return true;
}

// Hakem: hamle sonrası konumu zor derinlik 5 ile değerlendirir (hamleyi yapan açısından; toplam 6 kat).
function hakem(d, m) {
  const y = B.uygula(d, m);
  if (y.bitti) return y.bitti.kazanan === d.sira ? AI.KAZANMA : y.bitti.kazanan === null ? 0 : -AI.KAZANMA;
  AI.yeniOyun();
  return -AI.dusunSenkron(y, { zorluk: 'zor', derinlik: 5 }).deger;
}

// "Fırsatı kaçırmaz": seçilen hamle hiç almıyorsa, hakeme göre en iyi alma hamlesinden kötü olmamalı
// (daha güçlü bir hamle — ör. çift değirmen kurmak — seçilebilir; zayıf bir hamle seçilemez).
test('A1 tek hamlede değirmen fırsatını üç zorluk da kaçırmaz', () => {
  const sayi = { kolay: 60, orta: 60, zor: 20 };
  for (const z of Object.keys(sayi)) {
    let n = 0, almadi = 0;
    for (const d of konumlar(11)) {
      const almalar = B.hamleler(d).filter(m => m.al >= 0);
      if (!almalar.length) continue;
      const r = sec(d, z, n);
      if (r.hamle.al < 0) {
        almadi++;
        assert.equal(z, 'zor', `${z} kesin kuralla almalıydı: ${B.yazdir(d)}\nseçilen ${B.hamleYazi(r.hamle)}`);
        const enIyiAlma = Math.max(...almalar.map(m => hakem(d, m)));
        const secilen = hakem(d, r.hamle);
        assert.ok(secilen >= enIyiAlma - 25, `${z}: ${B.yazdir(d)}\nseçilen ${B.hamleYazi(r.hamle)} ${secilen} < alma ${enIyiAlma}`);
      }
      if (++n >= sayi[z]) break;
    }
    if (process.env.DT_AYRINTI) console.log(z, 'almadan geçen (daha iyisi olduğu için):', almadi, '/', n);
  }
});

// "Rakibin değirmenini bloke eder": rakibin tek hamlede değirmeni varken seçilen hamle onu kapatmıyorsa (ve
// kendisi almıyorsa), hakeme göre en iyi bloke hamlesinden kötü olmamalı.
test('A2 rakibin kuracağı değirmeni bloke eder (rastgele konumlar)', () => {
  const sayi = { kolay: 60, orta: 60, zor: 20 };
  for (const z of Object.keys(sayi)) {
    let n = 0;
    for (const d of konumlar(23, 2, 40)) {
      const q = 1 - d.sira;
      if (!B.tehdit(d, q) || B.hamleler(d).some(m => m.al >= 0)) continue;
      const blokeler = B.hamleler(d).filter(m => !B.tehdit({ ...B.uygula(d, m), sira: q }, q));
      if (!blokeler.length) continue;
      const r = sec(d, z, n);
      if (!blokeler.some(m => B.hamleYazi(m) === B.hamleYazi(r.hamle))) {
        assert.equal(z, 'zor', `${z} kesin kuralla kapatmalıydı: ${B.yazdir(d)}\nseçilen ${B.hamleYazi(r.hamle)}`);
        const enIyiBloke = Math.max(...blokeler.map(m => hakem(d, m)));
        const secilen = hakem(d, r.hamle);
        assert.ok(secilen >= enIyiBloke - 25, `${z}: ${B.yazdir(d)}\nseçilen ${B.hamleYazi(r.hamle)} ${secilen} < bloke ${enIyiBloke}`);
      }
      if (++n >= sayi[z]) break;
    }
  }
});

// Açık konumlar: kolay ve orta kesin kuralla alır ve kapatır; zor almıyor/kapatmıyorsa hakeme göre daha iyisini oynar.
test('A1b/A2c açık konumlarda: alır ve kapatır', () => {
  const al = B.kur({ b: [0, 1, 20], s: [9, 12, 13], el: [5, 5], sira: 0 });         // a7 d7 → g7 ile değirmen
  const kapa = B.kur({ b: [20, 4], s: [0, 1, 12], el: [6, 5], sira: 0 });           // beyaz a7 d7 → g7'yi kapat
  for (const z of ['kolay', 'orta']) {
    assert.ok(sec(al, z).hamle.al >= 0, z + ' alır');
    assert.equal(sec(kapa, z).hamle.hedef, 2, z + ' kapatır');
  }
  const enIyiAlma = Math.max(...B.hamleler(al).filter(m => m.al >= 0).map(m => hakem(al, m)));
  for (const z of ['zor']) {
    const m = sec(al, z).hamle;
    assert.ok(m.al >= 0 || hakem(al, m) >= enIyiAlma - 25, z + ' alma');
    const k = sec(kapa, z).hamle;
    assert.ok(k.hedef === 2 || hakem(kapa, k) >= hakem(kapa, { kaynak: -1, hedef: 2, al: -1, al2: -1 }) - 25, z + ' kapama');
  }
});

test('A2b hareket evresinde bloke: kaybetmeyen tek hamle b6 yerine d7-d6', () => {
  const d = B.kur({ b: [1, 4, 6, 15, 20], s: [8, 10, 12, 17, 22], el: [0, 0], sira: 0 });
  for (const z of ['kolay', 'orta', 'zor']) {
    const r = sec(d, z);
    assert.ok(ayni(r.hamle, 1, 9), `${z}: ${B.hamleYazi(r.hamle)}`);
  }
});

test('A3 çatal: orta ve zor çift tehdit kuran noktaya koyar', () => {
  const d = B.kur({ b: [0, 4, 15], s: [7, 13, 20], el: [6, 6], sira: 0 });
  for (const z of ['orta', 'zor']) {
    const r = sec(d, z);
    assert.ok(ayni(r.hamle, -1, 2), `${z}: ${B.hamleYazi(r.hamle)}`);
    assert.ok(r.deger > 50, `${z}: değer ${r.deger}`);
  }
});

test('A4 çift değirmen: zor, malzemede geride olsa da gidip gelen taşı kurar', () => {
  const d = B.kur({ b: [0, 1, 2, 8, 11], s: [3, 4, 12, 14, 20, 22], el: [0, 0], sira: 0 });
  const r = sec(d, 'zor');
  assert.ok(ayni(r.hamle, 11, 10) || ayni(r.hamle, 1, 9), B.hamleYazi(r.hamle));
  assert.ok(r.deger > 0, 'değer ' + r.deger);
});

test('A5 kesin sonuç: kazandıran almayı bulur; kayıp konumda da yasal hamle verir', () => {
  const d = B.kur({ b: [0, 2, 9, 15, 20], s: [4, 6, 12], el: [0, 0], sira: 0 });
  for (const z of ['kolay', 'orta', 'zor']) {
    const r = sec(d, z);
    assert.ok(ayni(r.hamle, 9, 1) && r.hamle.al >= 0, `${z}: ${B.hamleYazi(r.hamle)}`);
    assert.ok(r.deger >= AI.KESIN, `${z}: değer ${r.deger}`);
  }
  const kayip = B.kur({ b: [0, 2, 9, 15, 20, 21], s: [4, 6, 12], el: [0, 0], sira: 1 });
  const r = sec(kayip, 'zor');
  assert.ok(B.hamleGecerli(kayip, r.hamle));
  assert.ok(r.deger < 0);
});

test('A6 tek yasal hamle hemen döner', () => {
  for (const d of konumlar(5, 20, 120)) {
    const l = B.hamleler(d);
    if (l.length !== 1) continue;
    const r = sec(d, 'zor');
    assert.deepEqual(r.hamle, l[0]);
    assert.ok(r.dugum <= 1);
    return;
  }
});

test('A7 belirlenim: aynı girdi aynı karar; kolay aynı tohumla aynı', () => {
  const it = konumlar(77);
  for (let k = 0; k < 10; k++) {
    const d = it.next().value;
    for (const z of ['kolay', 'orta']) {
      const a = sec(d, z, 3), b = sec(d, z, 3);
      assert.deepEqual([a.hamle, a.deger], [b.hamle, b.deger]);
    }
  }
});

test('A8 asenkron sürücü: bütçede biter ve olay döngüsüne sıra verir; iptal AbortError', async () => {
  const d = B.kur({ b: [0, 2, 9, 11, 13, 20, 22], s: [1, 3, 5, 7, 12, 17, 19], el: [0, 0], sira: 0 });
  AI.yeniOyun();
  let tik = 0, dur = false;
  const say = () => { if (!dur) { tik++; setImmediate(say); } };
  setImmediate(say);
  const t0 = performance.now();
  const r = await AI.dusun(d, { zorluk: 'zor', butceMs: 60 });
  const sure = performance.now() - t0;
  dur = true;
  assert.ok(B.hamleGecerli(d, r.hamle));
  assert.ok(sure < 150, 'süre ' + sure.toFixed(0));
  assert.ok(tik > 2, 'olay döngüsü ' + tik);
  const k = new AbortController();
  setTimeout(() => k.abort(), 20);
  const t1 = performance.now();
  await assert.rejects(AI.dusun(d, { zorluk: 'zor', butceMs: 5000 }, { signal: k.signal }), { name: 'AbortError' });
  assert.ok(performance.now() - t1 < 60);
});

test('A9 tekrar: öndeki taraf konumu üçüncü kez getiren hamleden kaçar', () => {
  let d = B.kur({ b: [0, 4, 16, 20], s: [2, 6, 18, 22, 9, 13], el: [0, 0], sira: 0 });
  for (const [k, h] of [[0, 1], [2, 3], [1, 0], [3, 2], [0, 1], [2, 3], [1, 0]]) d = B.uygula(d, { kaynak: k, hedef: h, al: -1, al2: -1 });
  assert.equal(d.bitti, null);
  assert.deepEqual(B.uygula(d, { kaynak: 3, hedef: 2, al: -1, al2: -1 }).bitti, { kazanan: null, neden: 'tekrar' });
  for (const z of ['orta', 'zor']) {
    const r = sec(d, z);
    assert.ok(!ayni(r.hamle, 3, 2), `${z}: ${B.hamleYazi(r.hamle)}`);
    assert.ok(r.deger > 0, `${z}: ${r.deger}`);
  }
});

test('R12b arama yığını uygula ile aynı konumu üretir', () => {
  const r = rng(99);
  for (let oyun = 0; oyun < 40; oyun++) {
    let d = B.yeniOyun({ ciftDegirmenIkiTas: oyun % 3 === 0 }, oyun % 2);
    for (let k = 0; k < 80 && !d.bitti; k++) {
      const l = B.hamlelerPaketli(d), h = l[Math.floor(r() * l.length)];
      const A = AI._arayici(d, {});
      AI._yap(A, 0, h);
      const y = B.uygula(d, h);
      assert.deepEqual([A.T0[1], A.T1[1], A.E0[1], A.E1[1], A.SAYAC[1]], [y.tas[0], y.tas[1], y.el[0], y.el[1], y.tassiz]);
      assert.equal(A.ANAHTAR[1], B.anahtar(y));
      d = y;
    }
  }
});

test('R13b değerlendirme simetrik dönüşümlerde değişmez', () => {
  const s = B.SIMETRI, it = konumlar(31, 4, 60);
  const donusumler = [s.dondur, s.ayna, s.halka, (i) => s.ayna(s.dondur(s.halka(i)))];
  for (let k = 0; k < 150; k++) {
    const d = it.next().value;
    const v = AI.degerlendir(d);
    for (const f of donusumler) {
      const m = (t) => { let x = 0; for (let i = 0; i < 24; i++) if (t & (1 << i)) x |= 1 << f(i); return x; };
      assert.equal(AI.degerlendir({ ...d, tas: [m(d.tas[0]), m(d.tas[1])] }), v);
    }
  }
});

test('A10 kazanma oranı: zor > orta > kolay (DT_SIM=1)', { skip: !process.env.DT_SIM }, () => {
  const oyna = (a, b, tohum) => {             // a: koyu, b: beyaz; döner: koyunun puanı (1 / ½ / 0)
    const r = rng(tohum);
    let d = B.yeniOyun({}, 0);
    for (let k = 0; k < 2; k++) { const l = B.hamleler(d); d = B.uygula(d, l[Math.floor(r() * l.length)]); }
    AI.yeniOyun();
    for (let k = 0; k < 300 && !d.bitti; k++) {
      const z = d.sira === 0 ? a : b;
      d = B.uygula(d, AI.dusunSenkron(d, { ...SEVIYE[z], rastgele: r }).hamle);
    }
    if (!d.bitti || d.bitti.kazanan === null) return .5;
    return d.bitti.kazanan === 0 ? 1 : 0;
  };
  const eslesme = (a, b, n = 20) => {
    let puan = 0;
    for (let k = 0; k < n; k++) puan += k % 2 ? 1 - oyna(b, a, 1000 + k) : oyna(a, b, 1000 + k);
    return puan / n;
  };
  const sonuc = { 'zor-kolay': eslesme('zor', 'kolay'), 'orta-kolay': eslesme('orta', 'kolay'), 'zor-orta': eslesme('zor', 'orta') };
  console.log('kazanma oranları:', JSON.stringify(sonuc));
  assert.ok(sonuc['zor-kolay'] >= .8);
  assert.ok(sonuc['orta-kolay'] >= .65);
  assert.ok(sonuc['zor-orta'] >= .55);
});
