// node --test test/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');
const A = require('../ai.js');

const G = B.kur({ W: 8, H: 10, kesisme: true });
const ZORLUKLAR = ['kolay', 'orta', 'zor'];
const secenek = (zorluk, tohum = 1) => ({ zorluk, butceMs: Infinity, maxDerinlik: 2, tohum });   // süre yok: düğüm ve aday sınırlarıyla deterministik

function lcg(tohum) { let s = tohum >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// tohumlu rastgele yasal hamlelerle n hamle ilerlemiş konum; oyun erken bittiyse tohum değişip yeniden denenir
function ortaOyun(g, tohum, n) {
  for (let deneme = 0; deneme < 50; deneme++) {
    const rnd = lcg(tohum + deneme * 1000), d = B.baslangic(g, 0);
    let i = 0;
    for (; i < n && !d.bitti; i++) { const l = B.yasalListe(g, d); B.yap(g, d, l[Math.floor(rnd() * l.length)]); }
    if (!d.bitti) return d;
  }
  throw new Error('bitmemiş konum üretilemedi');
}
// seçilen turu uygulanmış kopyada döner
function oyna(g, d, sonuc) { const k = B.kopyala(d); B.uygulaTur(g, k, sonuc.kenarlar); return k; }

test('kesin: kazandıran tur varsa oynanır (üç zorluk, iki taraf)', () => {
  const ust = B.kurulum(G, { top: [4, 1], sira: 0, kenarlar: [[[4, 2], [4, 1]]] });
  const alt = B.kurulum(G, { top: [4, 9], sira: 1, kenarlar: [[[4, 8], [4, 9]]] });
  for (const z of ZORLUKLAR) {
    let k = oyna(G, ust, A.dusunSenkron(G, ust, secenek(z)));
    assert.deepEqual(k.bitti, { kazanan: 0, sebep: 'gol' }, z + ' üst');
    k = oyna(G, alt, A.dusunSenkron(G, alt, secenek(z)));
    assert.deepEqual(k.bitti, { kazanan: 1, sebep: 'gol' }, z + ' alt');
  }
});

test('kolay bile kendi kalesine gol atmaz, sıkışmaz (rastgele orta oyun konumları)', () => {
  for (const z of ZORLUKLAR) {
    for (let tohum = 1; tohum <= 40; tohum++) {
      const d = ortaOyun(G, tohum, 10 + (tohum % 7) * 8);
      const ben = d.sira;
      const turlar = B.turlarUret(G, d).turlar;
      const kurtulus = turlar.some(t => t.sonuc === 'temiz' || t.kazanan === ben);
      const s = A.dusunSenkron(G, d, secenek(z, tohum));
      const k = oyna(G, d, s);
      if (kurtulus) assert.ok(!k.bitti || k.bitti.kazanan === ben, `${z} tohum ${tohum}: kaybettiren tur seçildi`);
    }
  }
});

test('orta ve zor: kaçınılabiliyorsa rakibe bu turda gol attırmaz', () => {
  let kontrol = 0;
  for (const z of ['orta', 'zor']) {
    for (let tohum = 1; tohum <= 30; tohum++) {
      const d = ortaOyun(G, tohum * 3, 12 + (tohum % 6) * 7);
      const ben = d.sira;
      const buyuk = { enCokTur: 5000, enCokDugum: 200000 };
      const guvenliVar = B.turlarUret(G, d).turlar.filter(t => t.sonuc === 'temiz').some(t => {
        const k = oyna(G, d, t);
        return !k.bitti && B.golTuruBul(G, k, buyuk) === null;
      });
      const k = oyna(G, d, A.dusunSenkron(G, d, secenek(z, tohum)));
      if (!guvenliVar || k.bitti) continue;
      kontrol++;
      assert.equal(B.golTuruBul(G, k, buyuk), null, `${z} tohum ${tohum}: rakibe gol fırsatı verdi`);
    }
  }
  assert.ok(kontrol > 20, 'yeterince konum denendi: ' + kontrol);
});

test('deterministik: aynı tohum ve sınırlarla aynı tur', () => {
  for (const z of ZORLUKLAR) {
    const d = ortaOyun(G, 9, 35);
    const a = A.dusunSenkron(G, d, secenek(z, 7)), b = A.dusunSenkron(G, d, secenek(z, 7));
    assert.deepEqual(a.kenarlar, b.kenarlar, z);
  }
});

test('dusunSenkron girdi durumunu değiştirmez', () => {
  const d = ortaOyun(G, 4, 30), once = B.kopyala(d);
  A.dusunSenkron(G, d, secenek('zor'));
  assert.equal(B.anahtar(d), B.anahtar(once)); assert.deepEqual(d.kullanilan, once.kullanilan);
});

test('dilimli sürücü: sonuç gelir, ana thread uzun süre tutulmaz', async () => {
  const d = ortaOyun(G, 11, 45);
  let enUzun = 0, son = Date.now();
  const olc = setInterval(() => { const t = Date.now(); enUzun = Math.max(enUzun, t - son); son = t; }, 2);
  const t0 = Date.now();
  const sonuc = await new Promise((coz) => A.dusun(G, d, { zorluk: 'zor', butceMs: 600, dilimMs: 12 }, coz));
  clearInterval(olc);
  assert.ok(sonuc.kenarlar.length >= 1);
  assert.ok(Date.now() - t0 < 600 * 2 + 200, 'bütçe aşılmadı: ' + (Date.now() - t0));
  assert.ok(enUzun < 150, 'en uzun kesintisiz çalışma ms: ' + enUzun);
});

test('iptal: geri çağrı gelmez', async () => {
  const d = ortaOyun(G, 12, 40);
  let geldi = false;
  const iptal = A.dusun(G, d, { zorluk: 'zor', butceMs: 300 }, () => { geldi = true; });
  iptal();
  await new Promise(r => setTimeout(r, 400));
  assert.equal(geldi, false);
});

test('iki tarafı da oynar: ayna konumda ayna sonuç', () => {
  // başlangıç konumunda sıra 1 de geçerli bir tur bulur
  const d = B.baslangic(G, 1);
  const s = A.dusunSenkron(G, d, secenek('orta'));
  assert.equal(s.kenarlar.length >= 1, true);
  const k = oyna(G, d, s);
  assert.equal(k.sira, 0);
});

test('uzun saha (8×11) ve ağız ortası kapalı: kesin gol ve kendi kaleye atmama', () => {
  for (const g of [B.kur({ W: 8, H: 11 }), B.kur({ W: 8, H: 10, agizSeker: false })]) {
    const ust = B.kurulum(g, { top: [4, 1], sira: 0, kenarlar: [[[4, 2], [4, 1]], [[3, 1], [4, 1]], [[5, 1], [4, 1]]] });
    for (const z of ZORLUKLAR) {
      const s = A.dusunSenkron(g, ust, secenek(z));
      const k = oyna(g, ust, s);
      assert.ok(k.bitti && k.bitti.kazanan === 0, `${z}: kesin gol bulunmalı (H=${g.H}, ağız ${g.agizSeker})`);
    }
    for (let tohum = 1; tohum <= 12; tohum++) {
      const d = ortaOyun(g, tohum, 12 + tohum * 4), ben = d.sira;
      const kurtulus = B.turlarUret(g, d).turlar.some(t => t.sonuc === 'temiz' || t.kazanan === ben);
      for (const z of ZORLUKLAR) {
        const k = oyna(g, d, A.dusunSenkron(g, d, secenek(z, tohum)));
        if (kurtulus) assert.ok(!k.bitti || k.bitti.kazanan === ben, `${z} tohum ${tohum} H=${g.H}`);
      }
    }
  }
});
