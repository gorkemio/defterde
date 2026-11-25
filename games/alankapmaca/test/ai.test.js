// node --test test/ai.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const AI = require('../ai.js');
const config = require('../config.js');

const kur = (ek = {}) => G.yeniOyun({ ...config, hesap: { acik: false, deneme: 1, ceza: true }, ...ek });

// Rastgele geçerli hamle (konum üretmek için)
function rastgeleHamle(o, r) {
  const z = G.zarAt(o, r);
  if (!z.sigar) { G.pasGec(o); return; }
  const adaylar = G.yerlesimler(o, z.a, z.b, o.sira);
  const p = adaylar[Math.floor(r() * adaylar.length)];
  G.yerlestir(o, p.s, p.k, p.w, p.h);
}
function konum(cfg, r, enCok) {
  const o = kur(cfg);
  const hamle = Math.floor(r() * enCok);
  for (let i = 0; i < hamle && o.asama !== 'bitti'; i++) rastgeleHamle(o, r);
  return o;
}
const zarCek = (o, r) => { const [en, cok] = o.ayar.zar; return [en + Math.floor(r() * (cok - en + 1)), en + Math.floor(r() * (cok - en + 1))]; };

// n×n tahtayı verilen boş hücre kümesi dışında "ben" dolgusuyla doldurur (1×1 dikdörtgenler)
function doldur(o, bosListe) {
  const bos = new Set(bosListe.map(([s, k]) => s * o.n + k));
  for (let i = 0; i < o.n * o.n; i++) {
    if (bos.has(i)) continue;
    const d = { id: o.dikdortgenler.length, sahip: 'ben', s: Math.floor(i / o.n), k: i % o.n, w: 1, h: 1, alan: 1, zar: [1, 1] };
    o.dikdortgenler.push(d); o.hucre[i] = d.id; o.sayi.ben++; o.puan.ben++;
  }
}

test('sec: her zaman geçerli yerleşim (300 rastgele konum, kolay ve zor)', () => {
  const r = G.rng(5);
  const modlar = [
    { boyut: 8, zar: [1, 6] }, { boyut: 16, zar: [1, 12] },
    { boyut: 20, zar: [1, 6], bitisiklik: true }, { boyut: 12, zar: [1, 9], bitisiklik: true },
  ];
  let secilen = 0;
  for (let t = 0; t < 300; t++) {
    const o = konum(modlar[t % modlar.length], r, 9);
    if (o.asama === 'bitti') continue;
    const sahip = o.sira, [a, b] = zarCek(o, r);
    const adaylar = G.yerlesimler(o, a, b, sahip);
    for (const zorluk of ['kolay', 'zor']) {
      const p = AI.sec(o, adaylar, sahip, { zorluk }, r);
      if (!adaylar.length) { assert.equal(p, null); continue; }
      assert.ok(G.yerlestirilebilir(o, p.s, p.k, p.w, p.h, sahip), 'geçerli');
      assert.ok((p.w === a && p.h === b) || (p.w === b && p.h === a), 'ölçü zara uyar');
      secilen++;
    }
  }
  assert.ok(secilen > 400, `yalnız ${secilen} seçim denendi`);
});

test('sigarTablosu: kaba kuvvetle aynı (200 konum × iki sahip × tüm ölçüler, iki mod)', () => {
  const r = G.rng(9);
  const modlar = [
    { boyut: 8, zar: [1, 6] }, { boyut: 12, zar: [1, 9], bitisiklik: true },
    { boyut: 16, zar: [1, 6] }, { boyut: 10, zar: [1, 12], bitisiklik: true },
  ];
  for (let t = 0; t < 200; t++) {
    const o = konum(modlar[t % modlar.length], r, 25), hi = o.ayar.zar[1], d = AI.durum(o);
    for (const sahip of ['ben', 'rakip']) {
      const tablo = AI.sigarTablosu(d, sahip, hi);
      for (let h = 1; h <= hi; h++) {
        for (let w = 1; w <= hi; w++) {
          const beklenen = G.yerlesimler(o, w, h, sahip).some(p => p.w === w && p.h === h);
          assert.equal(!!tablo[h][w], beklenen, `konum ${t}, ${sahip}, ${h} satır × ${w} sütun`);
        }
      }
    }
  }
});

test('sec: aynı konum ve aynı tohum aynı hamleyi verir', () => {
  const r = G.rng(3);
  for (let t = 0; t < 50; t++) {
    const o = konum({ boyut: 16, zar: [1, 6], bitisiklik: t % 2 === 1 }, r, 15);
    if (o.asama === 'bitti') continue;
    const [a, b] = zarCek(o, r), adaylar = G.yerlesimler(o, a, b, o.sira);
    for (const zorluk of ['kolay', 'zor']) {
      assert.deepEqual(AI.sec(o, adaylar, o.sira, { zorluk }, G.rng(7)), AI.sec(o, adaylar, o.sira, { zorluk }, G.rng(7)));
    }
  }
});

test('sec: boş tahtada ilk hamle köşeye oturur (iki tahta kenarına değer)', () => {
  const o = kur();
  for (const sahip of ['ben', 'rakip']) {
    const adaylar = G.yerlesimler(o, 3, 4, sahip);
    for (let tohum = 1; tohum <= 100; tohum++) {
      const p = AI.sec(o, adaylar, sahip, { zorluk: 'zor' }, G.rng(tohum));
      assert.ok((p.s === 0 || p.s + p.h === o.n) && (p.k === 0 || p.k + p.w === o.n), `köşe değil: ${JSON.stringify(p)}`);
    }
  }
});

test('sec: engel terimi eşitken tek hücrelik ölü cep bırakan yerleşimden kaçınır', () => {
  // Boş: satır 0 sütun 0–4 ve satır 1–3 sütun 1–4. Zar yalnız 1×1 → engel hep aynı, ölü cep ayırt edici.
  // (0,1)'e koymak (0,0)'ı tek hücrelik cep yapar.
  const bos = [];
  for (let k = 0; k <= 4; k++) bos.push([0, k]);
  for (let s = 1; s <= 3; s++) for (let k = 1; k <= 4; k++) bos.push([s, k]);
  const o = kur({ boyut: 6, zar: [1, 1] });
  doldur(o, bos);
  o.sira = 'rakip';
  const adaylar = G.yerlesimler(o, 1, 1, 'rakip');
  assert.equal(adaylar.length, bos.length);
  let kolayCepli = 0;
  for (let tohum = 1; tohum <= 100; tohum++) {
    const p = AI.sec(o, adaylar, 'rakip', { zorluk: 'zor' }, G.rng(tohum));
    const d = AI.durum(o);
    d.B[p.s * 6 + p.k] = 2;
    assert.equal(AI.oluHucreler(d), 0, `cep bıraktı: ${p.s},${p.k}`);
    const q = AI.sec(o, adaylar, 'rakip', { zorluk: 'kolay' }, G.rng(tohum));
    if (q.s === 0 && q.k === 1) kolayCepli++;
  }
  assert.ok(kolayCepli > 0, 'kolay mod bazen cep bırakır');
});

// ---- öz-oyun ----

// zorluklar: { ben, rakip } = 'kolay' | 'zor'. Zar ve AI için ayrı tohum: zar dizisi stratejiden bağımsız.
function oyna(cfg, tohum, zorluklar, ilk) {
  const o = G.yeniOyun({ ...cfg, hesap: { acik: false, deneme: 1, ceza: true }, ilkBaslayan: ilk });
  const rz = G.rng(tohum), ra = G.rng(tohum + 99991);
  let adim = 0;
  while (o.asama !== 'bitti') {
    const z = G.zarAt(o, rz);
    if (!z.sigar) G.pasGec(o);
    else {
      const adaylar = G.yerlesimler(o, z.a, z.b, o.sira);
      const p = AI.sec(o, adaylar, o.sira, { zorluk: zorluklar[o.sira] }, ra);
      G.yerlestir(o, p.s, p.k, p.w, p.h);
    }
    assert.ok(++adim <= 2 * o.n * o.n + 2, 'oyun sınırlı turda biter');
  }
  return { o, adim };
}

// zor oyuncu dönüşümlü 'ben'/'rakip', başlayan da dönüşümlü
function zorKolay(cfg, adet, tohum0) {
  let fark = 0, kazan = 0, enCok = 0, toplamTur = 0;
  for (let g = 0; g < adet; g++) {
    const zor = g % 2 ? 'rakip' : 'ben', kolay = zor === 'ben' ? 'rakip' : 'ben';
    const { o, adim } = oyna(cfg, tohum0 + g, { [zor]: 'zor', [kolay]: 'kolay' }, (g >> 1) % 2 ? 'ben' : 'rakip');
    fark += o.puan[zor] - o.puan[kolay];
    if (o.kazanan === zor) kazan++;
    enCok = Math.max(enCok, adim); toplamTur += adim;
  }
  return { fark: fark / adet, kazanma: kazan / adet, enCok, ortTur: toplamTur / adet };
}

// Ortak tahtada zar şansı baskın: gerçek etki küçük (2000 oyunda ölçülen: +3.2 ± 0.8 puan, %53). Eşikler bunun yarısı.
test('öz-oyun, ortak mod (16×16, zar 1–6, 1000 oyun): zor, kolayı yener', () => {
  const s = zorKolay({ ...config, boyut: 16, zar: [1, 6] }, 1000, 1000);
  console.log(`  ortak: ortalama puan farkı ${s.fark.toFixed(2)}, kazanma %${(s.kazanma * 100).toFixed(1)}, ort ${s.ortTur.toFixed(1)} tur, en çok ${s.enCok}`);
  assert.ok(s.fark >= 1.0, `fark ${s.fark}`);
  assert.ok(s.kazanma >= 0.50, `kazanma ${s.kazanma}`);
});

test('öz-oyun, bitişiklik açık (16×16, zar 1–6, 300 oyun): zor, kolayı belirgin yener', () => {
  const s = zorKolay({ ...config, boyut: 16, zar: [1, 6], bitisiklik: true }, 300, 5000);
  console.log(`  bitişik: ortalama puan farkı ${s.fark.toFixed(2)}, kazanma %${(s.kazanma * 100).toFixed(1)}, ort ${s.ortTur.toFixed(1)} tur, en çok ${s.enCok}`);
  assert.ok(s.fark >= 10, `fark ${s.fark}`);
  assert.ok(s.kazanma >= 0.60, `kazanma ${s.kazanma}`);
});

test('paketleme: zor–zor oyunlarda oyun sonu ölü hücre, kolay–kolaydan çok az', () => {
  const ort = (zorluk) => {
    let toplam = 0;
    for (let g = 0; g < 200; g++) {
      const { o } = oyna({ ...config, boyut: 16, zar: [1, 6] }, 9000 + g, { ben: zorluk, rakip: zorluk }, 'ben');
      toplam += AI.oluHucreler(AI.durum(o));
    }
    return toplam / 200;
  };
  const zor = ort('zor'), kolay = ort('kolay');
  console.log(`  oyun sonu ölü hücre: zor ${zor.toFixed(2)} · kolay ${kolay.toFixed(2)}`);
  assert.ok(zor < kolay / 2, `zor ${zor}, kolay ${kolay}`);
});

test('büyük zar (16×16, zar 1–12): 100 oyun biter; küçük tahtada sığmayan zar için null', () => {
  for (let g = 0; g < 100; g++) oyna({ ...config, boyut: 16, zar: [1, 12] }, 20000 + g, { ben: 'zor', rakip: 'zor' }, g % 2 ? 'ben' : 'rakip');
  const o = kur({ boyut: 4, zar: [5, 5] });
  assert.equal(AI.sec(o, G.yerlesimler(o, 5, 1, 'ben'), 'ben', { zorluk: 'zor' }, G.rng(1)), null);
  assert.equal(AI.sec(o, G.yerlesimler(o, 5, 1, 'ben'), 'ben', { zorluk: 'kolay' }, G.rng(1)), null);
});

test('kare zar (a = b): adaylarda yön tekrarı yok, seçim geçerli', () => {
  const r = G.rng(11);
  for (let t = 0; t < 50; t++) {
    const o = konum({ boyut: 12, zar: [1, 6] }, r, 12);
    if (o.asama === 'bitti') continue;
    const a = 1 + Math.floor(r() * 6), adaylar = G.yerlesimler(o, a, a, o.sira);
    assert.equal(new Set(adaylar.map(p => `${p.s},${p.k},${p.w},${p.h}`)).size, adaylar.length);
    if (adaylar.length) {
      const p = AI.sec(o, adaylar, o.sira, { zorluk: 'zor' }, r);
      assert.ok(G.yerlestirilebilir(o, p.s, p.k, p.w, p.h, o.sira));
    }
  }
});

test('süre (gevşek): boş 20×20 tahta, zar 1–12, 1×2 atış (en çok aday) 200 ms altında', () => {
  const o = kur({ boyut: 20, zar: [1, 12] });
  const adaylar = G.yerlesimler(o, 1, 2, 'rakip');
  const t0 = process.hrtime.bigint();
  AI.sec(o, adaylar, 'rakip', { zorluk: 'zor' }, G.rng(1));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`  ${adaylar.length} aday, ${ms.toFixed(1)} ms`);
  assert.ok(ms < 200);
});
