// node --test test/ai-async.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const AI = require('../ai.js');

const ZORLUKLAR = ['kolay', 'orta', 'zor'];

// Tam 12 boş hücre: sonuç aynı kalırken gerçek aramanın olay döngüsünü bırakmasını sınar.
function sonOyun(tohum = 91, fazlaTur = true) {
  const r = G.rng(tohum), n = 8;
  const indisler = Array.from({ length: n * n }, (_, i) => i);
  for (let i = indisler.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [indisler[i], indisler[j]] = [indisler[j], indisler[i]];
  }
  const boslar = new Set(indisler.slice(0, 12));
  return G.durumdan(Array.from({ length: n }, (_, satir) =>
    Array.from({ length: n }, (_, sutun) =>
      boslar.has(satir * n + sutun) ? '.' : r() < .5 ? 'S' : 'O').join('')),
  { fazlaTur });
}

const kurgular = [
  {
    ad: 'güvenli açılış',
    kur: fazlaTur => G.yeniOyun({ boyut: 5, fazlaTur }),
    secenek: { tamAramaBos: 0 },
  },
  {
    // Zincirle 5 puan kazandıran hamle, anlık 2 puanlık hamleden farklıdır.
    ad: 'puan zinciri',
    kur: fazlaTur => G.durumdan(['SOSO', 'O...', 'S.S.', '.SOS'], { fazlaTur }),
    secenek: { tamAramaBos: 0 },
  },
  {
    ad: 'kesin son oyun',
    kur: fazlaTur => G.durumdan(['S.OSO', 'O.SOS', 'SO.SO', 'OSO.S', 'SOSO.'], { fazlaTur }),
    secenek: { tamAramaBos: 12 },
  },
];

for (const kurgu of kurgular) {
  test(`secAsync: ${kurgu.ad}, tüm zorluklar ve fazla tur seçenekleri sec ile aynı`, async () => {
    for (const fazlaTur of [false, true]) {
      const d = kurgu.kur(fazlaTur), once = structuredClone(d);
      for (const zorluk of ZORLUKLAR) {
        for (const tohum of [7, 42, 2026]) {
          const secenek = { ...kurgu.secenek, zorluk };
          const beklenen = AI.sec(d, secenek, G.rng(tohum));
          const sonuc = AI.secAsync(d, secenek, G.rng(tohum));
          assert.ok(sonuc instanceof Promise, 'asenkron arayüz Promise döndürmeli');
          assert.deepEqual(await sonuc, beklenen, `${zorluk}, fazlaTur=${fazlaTur}, tohum=${tohum}`);
          assert.deepEqual(d, once, 'arama girdideki hiçbir oyun alanını değiştirmemeli');
        }
      }
    }
  });
}

test('secAsync: varsayılan seçeneklerle geçerli hamle seçer; bitmiş oyunu reddeder', async () => {
  const d = G.yeniOyun();
  const m = await AI.secAsync(d);
  assert.equal(d.hucre[m.i], 0);
  assert.ok(m.harf === 'S' || m.harf === 'O');
  assert.ok(m.katman);
  await assert.rejects(AI.secAsync(G.durumdan(['SSS', 'SSS', 'SSS'])), /kalmadı/);
});

test('secAsync: eşzamanlı aramalar kendi konum, kural ve rastgele dizilerini korur', async () => {
  const konumlar = [sonOyun(91, true), sonOyun(17, false), sonOyun(56, true)];
  const once = konumlar.map(d => structuredClone(d));
  const secenek = { zorluk: 'zor', tamAramaBos: 12 };
  const beklenen = konumlar.map((d, i) => AI.sec(d, secenek, G.rng(i + 23)));
  const sonuclar = await Promise.all(konumlar.map((d, i) => AI.secAsync(d, secenek, G.rng(i + 23))));
  assert.deepEqual(sonuclar, beklenen);
  assert.deepEqual(konumlar, once);
});

test('secAsync: önceden iptal edilen sinyal AbortError ile reddedilir', async () => {
  const controller = new AbortController();
  controller.abort();
  const d = sonOyun(), once = structuredClone(d);
  await assert.rejects(AI.secAsync(d, { zorluk: 'zor' }, G.rng(8), { signal: controller.signal }),
    { name: 'AbortError' });
  assert.deepEqual(d, once);
});

test('secAsync: arama sırasında iptal başka aramayı ve girdiyi etkilemez', async () => {
  const controller = new AbortController();
  const d = sonOyun(), once = structuredClone(d);
  const secenek = { zorluk: 'zor', tamAramaBos: 12 };
  const beklenen = AI.sec(d, secenek, G.rng(9));
  const iptalEdilen = AI.secAsync(d, secenek, G.rng(8), { signal: controller.signal });
  const reddedildi = assert.rejects(iptalEdilen, { name: 'AbortError' });
  const zamanlayici = setTimeout(() => controller.abort(), 0);
  try {
    const devamEden = AI.secAsync(d, secenek, G.rng(9));
    const [, sonuc] = await Promise.all([reddedildi, devamEden]);
    assert.equal(controller.signal.aborted, true, 'iptal arama sürerken çalışmalı');
    assert.deepEqual(sonuc, beklenen, 'aynı girdiyi kullanan bağımsız arama tamamlanmalı');
    assert.deepEqual(d, once, 'iptal de girdiyi değiştirmemeli');
  } finally {
    clearTimeout(zamanlayici);
  }
});

test('secAsync: 12 boş hücrenin kesin araması bitmeden olay döngüsüne sıra verir', async () => {
  const d = sonOyun(), secenek = { zorluk: 'zor', tamAramaBos: 12 };
  const beklenen = AI.sec(d, secenek, G.rng(72));
  const sonuc = AI.secAsync(d, secenek, G.rng(72));
  let olayCalisti = false;
  // Arama başladıktan sonra sıraya alınır: senkron hesaplamayı Promise'e sarmalamak yetmez.
  const zamanlayici = setTimeout(() => { olayCalisti = true; }, 0);
  try {
    assert.deepEqual(await sonuc, beklenen);
    assert.equal(olayCalisti, true, 'arama tamamlanmadan başka bir görev çalışabilmeli');
  } finally {
    clearTimeout(zamanlayici);
  }
});
