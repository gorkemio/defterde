// node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');
const AI = require('../ai.js');

const ZORLUKLAR = ['kolay', 'orta', 'zor'];
const ind = (n, r, c) => r * n + c;
const rc = (n, i) => [Math.floor(i / n), i % n];
const oyna = (d, m) => G.placeLetter(d, Math.floor(m.i / d.n), m.i % d.n, m.harf);

// Rastgele konum: dolu hücrelerin oranı doluOran, harfler S/O. (Konumda hazır SOS olabilir; çizgi/puan hesaplanmaz.)
function rastgeleKonum(n, doluOran, r, opt) {
  const satirlar = Array.from({ length: n }, () => Array.from({ length: n }, () =>
    (r() < doluOran ? (r() < .5 ? 'S' : 'O') : '.')).join(''));
  const d = G.durumdan(satirlar, opt);
  return d.bos === 0 ? null : d;
}
// Tam olarak `bos` boş hücreli rastgele konum
function bosluklu(n, bos, r, opt) {
  const idx = Array.from({ length: n * n }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const bosSet = new Set(idx.slice(0, bos));
  const satirlar = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) =>
    (bosSet.has(a * n + b) ? '.' : (r() < .5 ? 'S' : 'O'))).join(''));
  return G.durumdan(satirlar, opt);
}

/* ---------- bağımsız (kaba kuvvet) hesaplar: yalnız game.js'in placeLetter'ına dayanır ---------- */

function tumHamleler(d) {
  const l = [];
  for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0) l.push({ i, harf: 'S' }, { i, harf: 'O' });
  return l;
}
// Sıradaki oyuncunun bu turda yalnız puanlı hamlelerle alabileceği en çok puan.
// Çok fırsatlı konumlarda arama üstel büyür: sınır aşılırsa null döner ve çağıran konumu atlar.
const SINIR = 2500;                                           // ai.js'in aday başına bütçesinden (4000) küçük: kesilme olmaz
function zincirBF(d, sayac = { n: 0 }) {
  let en = 0;
  for (const m of tumHamleler(d)) {
    const s = oyna(d, m), k = s.puan[d.sira] - d.puan[d.sira];
    if (k === 0) continue;
    if (++sayac.n > SINIR) return null;
    let v = k;
    if (s.sira === d.sira && !s.bitti) {
      const alt = zincirBF(s, sayac);
      if (alt === null) return null;
      v += alt;
    }
    if (v > en) en = v;
  }
  return en;
}
// Bu hamlenin kendi puanı + aynı turda devamı (null: konum çok pahalı)
function hamleDegeriBF(d, m) {
  const s = oyna(d, m), k = s.puan[d.sira] - d.puan[d.sira];
  if (!(k > 0 && s.sira === d.sira && !s.bitti)) return k;
  const alt = zincirBF(s);
  return alt === null ? null : k + alt;
}
// Tam minimax: sıradakinin (kalan puanı − rakibin kalan puanı)
function minimaxBF(d) {
  if (d.bitti) return 0;
  let en = -Infinity;
  for (const m of tumHamleler(d)) {
    const s = oyna(d, m), k = s.puan[d.sira] - d.puan[d.sira];
    const sonraki = minimaxBF(s);
    const v = s.sira === d.sira ? k + sonraki : k - sonraki;      // sira aynı kaldıysa puan yapan devam ediyor
    if (v > en) en = v;
  }
  return en;
}
function minimaxHamleBF(d, m) {
  const s = oyna(d, m), k = s.puan[d.sira] - d.puan[d.sira];
  const sonraki = minimaxBF(s);
  return s.sira === d.sira ? k + sonraki : k - sonraki;
}

/* ---------- genel ---------- */

test('sec: her zorlukta boş hücre ve geçerli harf seçer; girdiyi değiştirmez', () => {
  const r = G.rng(5);
  for (let t = 0; t < 300; t++) {
    const d = rastgeleKonum(4 + Math.floor(r() * 5), r() * .9, r);
    if (!d) continue;
    const once = JSON.stringify([Array.from(d.hucre), d.puan, d.sira]);
    for (const zorluk of ZORLUKLAR) {
      const m = AI.sec(d, { zorluk }, r);
      assert.equal(d.hucre[m.i], 0, `${zorluk}: dolu hücre seçildi`);
      assert.ok(m.harf === 'S' || m.harf === 'O');
      assert.ok(m.katman);
    }
    assert.equal(JSON.stringify([Array.from(d.hucre), d.puan, d.sira]), once, 'girdi değişmedi');
  }
});

test('sec: aynı tohum aynı hamleyi verir; bitmiş oyunda hata verir', () => {
  const d = rastgeleKonum(6, .4, G.rng(1));
  for (const zorluk of ZORLUKLAR) {
    assert.deepEqual(AI.sec(d, { zorluk }, G.rng(7)), AI.sec(d, { zorluk }, G.rng(7)));
  }
  const bitmis = G.placeLetter(G.durumdan(['S.S', 'SSS', 'SSS']), 0, 1, 'O');
  assert.throws(() => AI.sec(bitmis, { zorluk: 'zor' }), /kalmadı/);
});

/* ---------- 1. katman: puan al ---------- */

test('katman 1: puan getiren hamle varsa her zorlukta onu oynar', () => {
  const r = G.rng(11);
  let say = 0;
  for (let t = 0; t < 400; t++) {
    const d = rastgeleKonum(6, .35 + r() * .4, r);
    if (!d || !G.puanlayanHamleler(d).length) continue;
    for (const zorluk of ZORLUKLAR) {
      const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, r);
      assert.equal(m.katman, 'puan');
      const s = oyna(d, m);
      assert.ok(s.puan[d.sira] > d.puan[d.sira], `${zorluk}: puan getirmeli`);
    }
    say++;
  }
  assert.ok(say > 100, `yeterince konum (${say})`);
});

test('katman 1: çoklu SOS yapan hamleyi tek SOS yapana tercih eder', () => {
  // O ortada 2 SOS (yatay + dikey); başka bir yerde 1 SOS'luk fırsat var
  const d = G.durumdan([
    '.....', '..S..', '.SOS.'.replace('O', '.'), '..S..', 'SO...',
  ].map((s, i) => (i === 2 ? '.S.S.' : s)), { fazlaTur: false });
  const puanli = G.puanlayanHamleler(d);
  assert.ok(puanli.some(x => x.adet === 2) && puanli.some(x => x.adet === 1), 'kurgu: 2 ve 1 fırsat');
  for (const zorluk of ZORLUKLAR) {
    const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, G.rng(3));
    assert.equal(oyna(d, m).puan[0], 2, `${zorluk}: 2 SOS'luk hamle`);
  }
});

test('katman 1: zincir dahil toplam, anlık en çoktan daha iyi olabilir (sabit örnek)', () => {
  // (1,1) O: 2 SOS ama toplam 4 · (1,2) O ya da (2,3) O: 1 SOS ama zincirle toplam 5
  const d = G.durumdan(['SOSO', 'O...', 'S.S.', '.SOS'], { fazlaTur: true });
  const l = G.puanlayanHamleler(d);
  assert.deepEqual(l.map(x => x.adet).sort(), [1, 1, 2]);
  const hepsiDeger = l.map(x => hamleDegeriBF(d, x));
  assert.deepEqual(hepsiDeger.slice().sort(), [4, 5, 5]);
  for (const zorluk of ['orta', 'zor']) {
    const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, G.rng(1));
    assert.equal(hamleDegeriBF(d, m), 5, `${zorluk}: toplamı 5 olan hamle`);
    assert.equal(oyna(d, m).puan[0], 1, `${zorluk}: anlık yalnız 1 SOS`);
  }
  assert.equal(oyna(d, AI.sec(d, { zorluk: 'kolay' }, G.rng(1))).puan[0], 2, 'kolay: anlık en çoğu');
  assert.equal(AI.zincir(d), 5, 'zincir() en iyi toplam');
});

test('katman 1 (orta/zor): rastgele konumlarda zincir toplamı bağımsız hesapla en yüksek; kolay anlık en çoğu', () => {
  const r = G.rng(21);
  let say = 0, zincirliFark = 0;
  for (let t = 0; t < 8000 && (say < 40 || zincirliFark < 4); t++) {
    const d = rastgeleKonum(5, .45 + r() * .3, r);
    if (!d) continue;
    const l = G.puanlayanHamleler(d);
    if (l.length < 2) continue;
    const degerler = l.map(x => hamleDegeriBF(d, { i: x.i, harf: x.harf }));
    if (degerler.includes(null)) continue;
    const enIyi = Math.max(...degerler);
    for (const zorluk of ['orta', 'zor']) {
      const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, r);
      assert.equal(hamleDegeriBF(d, m), enIyi, `${zorluk}: zincir toplamı en yüksek olmalı`);
    }
    const k = AI.sec(d, { zorluk: 'kolay' }, r);
    const enAdet = Math.max(...l.map(x => x.adet));
    assert.equal(oyna(d, k).puan[d.sira] - d.puan[d.sira], enAdet, 'kolay: anlık en çok');
    if (enIyi > Math.max(...degerler.filter((_, j) => l[j].adet === enAdet))) zincirliFark++;
    say++;
  }
  assert.ok(say >= 40, `yeterince konum (${say})`);
  assert.ok(zincirliFark >= 4, `zincirin fark yarattığı konum sayısı (${zincirliFark})`);
});

test('fazlaTur kapalıyken zincir hesaba katılmaz', () => {
  const r = G.rng(33);
  for (let t = 0; t < 200; t++) {
    const d = rastgeleKonum(5, .5, r, { fazlaTur: false });
    if (!d || !G.puanlayanHamleler(d).length) continue;
    const m = AI.sec(d, { zorluk: 'zor', tamAramaBos: 0 }, r);
    const enAdet = Math.max(...G.puanlayanHamleler(d).map(x => x.adet));
    assert.equal(oyna(d, m).puan[d.sira] - d.puan[d.sira], enAdet);
  }
});

test('zincir: bağımsız sekiz fırsat toplanır (ezber sayesinde hızlı)', () => {
  // 12×12: dört satırda ikişer "S O ." fırsatı; aralar geniş, birbirini etkilemez → toplam 8
  const bos = '.'.repeat(12), dolu = 'SO...SO.....';
  const satirlar = Array.from({ length: 12 }, (_, r) => (r % 3 === 0 && r < 12 ? dolu : bos));
  const d = G.durumdan(satirlar, { fazlaTur: true });
  assert.equal(G.puanlayanHamleler(d).length, 8);
  const t0 = process.hrtime.bigint();
  assert.equal(AI.zincir(d), 8);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 200, `zincir çok yavaş: ${ms.toFixed(0)} ms`);
});

test('zincir: birbirini etkileyen fırsatlarda ezberli kaba kuvvetle aynı değeri bulur', () => {
  // Kaba kuvvet: yalnız game.js'e dayanır, tahta anahtarıyla ezberli (sınırsız). bellek.size = açılan farklı tahta.
  function zincirTam(d, bellek = new Map()) {
    const anahtar = Array.from(d.hucre).join('');
    if (bellek.has(anahtar)) return bellek.get(anahtar);
    bellek.set(anahtar, 0);                                   // açıldı (değer aşağıda yazılır)
    let en = 0;
    for (const m of tumHamleler(d)) {
      const s = oyna(d, m), k = s.puan[d.sira] - d.puan[d.sira];
      if (!k) continue;
      const v = k + (s.sira === d.sira && !s.bitti ? zincirTam(s, bellek) : 0);
      if (v > en) en = v;
    }
    bellek.set(anahtar, en);
    return en;
  }
  // Bütçeye sığan konumlarda kesin değer; sığmayanlarda (kalan oyunun neredeyse tamamı tek zincir) asla fazla değil.
  const r = G.rng(404);
  let say = 0, cokFirsat = 0, buyuk = 0;
  for (let t = 0; t < 3000 && say < 150; t++) {
    const n = 5 + Math.floor(r() * 2);
    const d = rastgeleKonum(n, .45 + r() * .35, r, { fazlaTur: true });
    if (!d) continue;
    const firsat = G.puanlayanHamleler(d).length;
    if (firsat < 3) continue;
    const bellek = new Map(), tam = zincirTam(d, bellek), ai = AI.zincir(d);
    const ad = Array.from({ length: n }, (_, a) => Array.from(d.hucre.slice(a * n, a * n + n)).map(v => '.SO'[v]).join('')).join('/');
    if (bellek.size <= AI.ZINCIR_BUTCE) assert.equal(ai, tam, ad);
    else { assert.ok(ai <= tam, `fazla tahmin: ${ad}`); buyuk++; }
    say++;
    if (firsat >= 6) cokFirsat++;
  }
  assert.ok(say >= 100, `yeterince konum (${say})`);
  assert.ok(cokFirsat >= 10, `çok fırsatlı konum sayısı (${cokFirsat})`);
  assert.ok(buyuk <= say / 10, `bütçeyi aşan konum çok fazla (${buyuk}/${say})`);
});

/* ---------- 2. katman: güvenli oyna ---------- */

test('katman 2: puan yoksa orta ve zor, rakibe fırsat bırakmayan hamle oynar (bedava SOS vermez)', () => {
  const r = G.rng(41);
  let say = 0;
  for (let t = 0; t < 4000 && say < 300; t++) {
    const n = 5 + Math.floor(r() * 3);
    const d = rastgeleKonum(n, .1 + r() * .45, r);
    if (!d || G.puanlayanHamleler(d).length) continue;
    const guvenliVar = tumHamleler(d).some(m => G.isSafe(d, ...rc(n, m.i), m.harf));
    if (!guvenliVar) continue;
    for (const zorluk of ['orta', 'zor']) {
      const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, r);
      assert.equal(m.katman, 'guvenli');
      const s = oyna(d, m);
      assert.equal(s.puan[0] + s.puan[1], d.puan[0] + d.puan[1], 'bu hamle puan getirmemeli');
      assert.deepEqual(G.puanlayanHamleler(s), [], `${zorluk}: rakibin puanlı hamlesi kalmamalı`);
    }
    say++;
  }
  assert.ok(say >= 150, `yeterince konum (${say})`);
});

test('katman 2: kolay güvenli oynamak zorunda değil (rastgele katmanı)', () => {
  const d = G.durumdan(['.....', '.....', '.S...', '.....', '.....']);
  const katmanlar = new Set();
  for (let t = 0; t < 30; t++) katmanlar.add(AI.sec(d, { zorluk: 'kolay' }, G.rng(t)).katman);
  assert.deepEqual([...katmanlar], ['rastgele']);
});

test('katman 2: parite, hamleden sonra kalan güvenli hücre sayısını çift bırakan hamleyi seçer', () => {
  const r = G.rng(51);
  let say = 0, ikisiDe = 0;
  for (let t = 0; t < 8000 && say < 150; t++) {
    const n = 5 + Math.floor(r() * 2);
    const d = rastgeleKonum(n, .25 + r() * .4, r);
    if (!d || G.puanlayanHamleler(d).length) continue;
    const guvenli = tumHamleler(d).filter(m => G.isSafe(d, ...rc(n, m.i), m.harf));
    if (!guvenli.length) continue;
    const kalan = (m) => G.guvenliSayisi(oyna(d, m));
    const ciftler = guvenli.filter(m => kalan(m) % 2 === 0);
    const tekler = guvenli.length - ciftler.length;
    if (ciftler.length && tekler) ikisiDe++;
    for (const zorluk of ['orta', 'zor']) {
      const m = AI.sec(d, { zorluk, tamAramaBos: 0 }, r);
      if (ciftler.length) assert.equal(kalan(m) % 2, 0, `${zorluk}: çift bırakan hamle varken tek bıraktı`);
    }
    say++;
  }
  assert.ok(say >= 60 && ikisiDe >= 20, `hem çift hem tek bırakan seçenekli konum yok (${say}/${ikisiDe})`);
});

/* ---------- 3. katman: mecbur kalınca en az kaybettir ---------- */

// Zorunlu konum: puan getiren hamle yok ve her hamle rakibe yeni fırsat açıyor. Rastgele dolgularda neredeyse hiç çıkmaz,
// bu yüzden orta düzey oyunlardan toplanır (orta, güvenli hamle bitene kadar oynar).
function zorunluKonumlar(n, adet, tohum) {
  const r = G.rng(tohum), liste = [];
  for (let oyun = 0; oyun < 600 && liste.length < adet; oyun++) {
    let d = G.yeniOyun({ boyut: n, fazlaTur: r() < .7 });
    let alindi = false;
    while (!d.bitti) {
      if (!alindi && !G.puanlayanHamleler(d).length && d.bos >= 3 &&
          !tumHamleler(d).some(m => G.isSafe(d, ...rc(n, m.i), m.harf))) { liste.push(d); alindi = true; }
      d = oyna(d, AI.sec(d, { zorluk: 'orta' }, r));
    }
  }
  return liste;
}

test('katman 3 (zor): güvenli hamle yoksa rakibin zincir dahil kazancını en aza indirir', () => {
  let say = 0, farkli = 0;
  const r = G.rng(62);
  for (const d of zorunluKonumlar(5, 80, 61)) {
    const hamleler = tumHamleler(d);
    const kayip = (m) => zincirBF(oyna(d, m));
    const kayiplar = hamleler.map(kayip);
    if (kayiplar.includes(null)) continue;
    const enAz = Math.min(...kayiplar);
    const m = AI.sec(d, { zorluk: 'zor', tamAramaBos: 0 }, r);
    assert.equal(m.katman, 'az-kayip');
    assert.equal(kayip(m), enAz, 'rakibin kazancı en küçük olmalı');
    if (Math.max(...kayiplar) > enAz) farkli++;
    say++;
  }
  assert.ok(say >= 30, `yeterince zorunlu konum (${say})`);
  assert.ok(farkli >= 10, `seçimin fark yarattığı konum sayısı (${farkli})`);
});

test('katman 3: orta güvenli hamle yokken rastgele oynar (az kaybettirmeye çalışmaz)', () => {
  const konumlar = zorunluKonumlar(5, 20, 71);
  assert.ok(konumlar.length >= 10, `zorunlu konum bulunamadı (${konumlar.length})`);
  const r = G.rng(72);
  for (const d of konumlar) assert.equal(AI.sec(d, { zorluk: 'orta' }, r).katman, 'rastgele');
});

/* ---------- son oyun: tam arama ---------- */

test('tam arama: bağımsız minimax ile aynı kesin değeri bulur (fazla tur açık ve kapalı)', () => {
  const r = G.rng(81);
  let say = 0;
  for (const fazlaTur of [true, false]) {
    for (let t = 0; t < 14; t++) {
      const bos = t < 10 ? 5 : 6;
      const d = bosluklu(4, bos, r, { fazlaTur, sira: t % 2 });
      const { deger, hamleler } = AI.tamArama(d);
      assert.equal(deger, minimaxBF(d), `değer (fazlaTur=${fazlaTur}, ${bos} boş)`);
      assert.equal(hamleler.length, bos * 2);
      // her kök hamlenin değeri bağımsız hesapla aynı
      for (const h of hamleler) assert.equal(h.deger, minimaxHamleBF(d, { i: h.i, harf: h.harf }));
      // sec, değeri en yüksek hamlelerden birini seçer
      const m = AI.sec(d, { zorluk: 'zor', tamAramaBos: 11 }, r);
      assert.equal(m.katman, 'son-oyun');
      assert.equal(minimaxHamleBF(d, m), deger);
      say++;
    }
  }
  assert.equal(say, 28);
});

test('tam arama: son hücrede puanla biten konumu doğru değerler', () => {
  const d = G.durumdan(['S.S', 'SSS', 'SSS']);                 // O koyunca 1 SOS
  const { deger, hamleler } = AI.tamArama(d);
  assert.equal(deger, 1);
  assert.deepEqual(hamleler.map(h => `${h.harf}:${h.deger}`).sort(), ['O:1', 'S:0']);
  assert.equal(AI.sec(d, { zorluk: 'zor' }, G.rng(1)).harf, 'O');
});

test('tam arama: 8x8 tahtada 12 boş hücre telefon için kabul edilebilir sürede (ölçüm)', () => {
  const r = G.rng(91);
  let enCok = 0, toplam = 0;
  const adet = 6;
  for (let t = 0; t < adet; t++) {
    const d = bosluklu(8, 12, r, { fazlaTur: true });
    const t0 = process.hrtime.bigint();
    AI.sec(d, { zorluk: 'zor', tamAramaBos: 12 }, r);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    enCok = Math.max(enCok, ms); toplam += ms;
  }
  console.log(`  tam arama 8x8, 12 boş: ortalama ${(toplam / adet).toFixed(0)} ms, en çok ${enCok.toFixed(0)} ms`);
  assert.ok(enCok < 2500, `çok yavaş: ${enCok} ms`);
});

/* ---------- güç: zorluklar arası simülasyon ---------- */

// n×n tahtada, ilk `acilis` hamle rastgele (iki taraf için aynı), sonra a ve b zorlukları oynar.
// Taraflar değişir (a bir oyunda sıra 0, ötekinde sıra 1) ki ilk oynama avantajı sonucu bozmasın.
// Döner: a'nın puanı − b'nin puanı
function oyunOyna(n, acilis, zA, zB, tohum, aIlk, fazlaTur) {
  const r = G.rng(tohum);
  let d = G.yeniOyun({ boyut: n, ilkBaslayan: 0, fazlaTur });
  for (let k = 0; k < acilis && !d.bitti; k++) {
    const bos = [];
    for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0) bos.push(i);
    d = G.placeLetter(d, ...rc(n, bos[Math.floor(r() * bos.length)]), r() < .5 ? 'S' : 'O');
  }
  const aSira = aIlk ? 0 : 1;
  while (!d.bitti) {
    const z = d.sira === aSira ? zA : zB;
    d = oyna(d, AI.sec(d, { zorluk: z, tamAramaBos: 12 }, r));
  }
  return d.puan[aSira] - d.puan[1 - aSira];
}

function eslestir(n, zA, zB, adet, fazlaTur = true) {
  let galibiyet = 0, beraberlik = 0, mag = 0, fark = 0;
  for (let t = 1; t <= adet; t++) {
    for (const aIlk of [true, false]) {
      const f = oyunOyna(n, 8 + (t % 3), zA, zB, t * 7919 + n, aIlk, fazlaTur);
      fark += f;
      if (f > 0) galibiyet++; else if (f === 0) beraberlik++; else mag++;
    }
  }
  const toplam = adet * 2;
  return { oran: (galibiyet + beraberlik / 2) / toplam, galibiyet, beraberlik, mag, ortFark: fark / toplam };
}
const bicim = (e) => `%${(e.oran * 100).toFixed(0)} (G${e.galibiyet}/B${e.beraberlik}/M${e.mag}, ort. fark ${e.ortFark.toFixed(1)})`;

test('güç: aynı zorluk kendine karşı dengeli (ölçüm düzeneği sağlaması)', () => {
  const e = eslestir(6, 'orta', 'orta', 40);
  console.log(`  orta–orta ${bicim(e)}`);
  assert.ok(Math.abs(e.oran - .5) < .1, `taraflar dengeli olmalı: ${e.oran}`);
});

test('güç: zor > orta > kolay (8x8, varsayılan kurallar: fazla tur açık)', () => {
  const zo = eslestir(8, 'zor', 'orta', 40);
  const zk = eslestir(8, 'zor', 'kolay', 20);
  const ok = eslestir(8, 'orta', 'kolay', 20);
  console.log(`  zor–orta ${bicim(zo)}\n  zor–kolay ${bicim(zk)}\n  orta–kolay ${bicim(ok)}`);
  assert.ok(zo.oran >= .62, `zor, ortayı çoğunlukla yenmeli: ${zo.oran}`);
  assert.ok(zk.oran >= .85, `zor, kolayı ezmeli: ${zk.oran}`);
  assert.ok(ok.oran >= .85, `orta, kolayı ezmeli: ${ok.oran}`);
});

test('güç: fazla tur kapalıyken de zor, ortadan geri kalmaz', () => {
  const zo = eslestir(8, 'zor', 'orta', 30, false);
  console.log(`  fazla tur kapalı, zor–orta ${bicim(zo)}`);
  assert.ok(zo.oran >= .5, `zor, ortadan kötü olmamalı: ${zo.oran}`);
});
