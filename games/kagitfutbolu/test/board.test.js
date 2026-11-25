// node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js');

const G = B.kur({ W: 8, H: 10, kesisme: true });          // m = 4: kale ağzı x = 3..5, direkler (3,0) (5,0) (3,10) (5,10)
const GK = B.kur({ W: 8, H: 10, kesisme: false });        // kesişme kapalı
const E = (g, x1, y1, x2, y2) => B.kenarXY(g, x1, y1, x2, y2);

// top (x,y)'ye giden kenarı oynar; yap() sonucunu döner
function git(g, d, x, y) {
  const e = B.kenarAra(g, d.top, B.nokta(g, x, y));
  assert.ok(e >= 0, `(${g.nx[d.top]},${g.ny[d.top]}) → (${x},${y}) kenarı yok`);
  return B.yap(g, d, e);
}
const kenar = (a, b) => [a, b];
const konum = (g, o) => B.kurulum(g, o);

/* ---------- graf ---------- */

test('sayılar: nokta, kenar, baştan çizili, oynanabilir', () => {
  assert.deepEqual(G.sayilar, { nokta: 105, kenar: 356, cizili: 40, oynanabilir: 316 });
  const k = B.kur({ W: 6, H: 8 });
  assert.deepEqual(k.sayilar, { nokta: 69, kenar: 224, cizili: 32, oynanabilir: 192 });
});

test('config doğrulama: W çift ve en az 4, H en az 2 (tek olabilir)', () => {
  assert.throws(() => B.kur({ W: 7, H: 10 }));
  assert.throws(() => B.kur({ W: 2, H: 10 }));
  assert.throws(() => B.kur({ W: 8, H: 1 }));
  assert.doesNotThrow(() => B.kur({ W: 8, H: 9 }));
});

test('noktadan çıkan oynanabilir kenar sayıları', () => {
  const say = (x, y) => { const p = B.nokta(G, x, y); let n = 0; for (let y2 = 0; y2 < 8; y2++) { const e = G.komKenar[p * 8 + y2]; if (e >= 0 && !G.onCizili[e]) n++; } return n; };
  for (let y = 1; y <= 9; y++) for (let x = 1; x <= 7; x++) assert.equal(say(x, y), 8, `iç nokta ${x},${y}`);
  assert.equal(say(4, 0), 8, 'ağız ortası'); assert.equal(say(4, 10), 8);
  assert.equal(say(0, 0), 1, 'köşe'); assert.equal(say(8, 10), 1);
  assert.equal(say(3, 0), 5, 'direk'); assert.equal(say(5, 10), 5);
  assert.equal(say(0, 5), 3, 'yan sınır'); assert.equal(say(1, 0), 3, 'üst sınır');
  assert.equal(say(3, -1), 1, 'kale içi köşe'); assert.equal(say(4, -1), 3, 'kale içi orta');
});

test('baştan çizili kenarlar ve ziyaret durumu', () => {
  const d = B.baslangic(G, 0);
  const cz = (x1, y1, x2, y2) => G.onCizili[E(G, x1, y1, x2, y2)] === 1;
  assert.ok(cz(0, 0, 0, 1)); assert.ok(cz(1, 0, 2, 0)); assert.ok(cz(2, 0, 3, 0));        // sınır
  assert.ok(cz(3, 0, 3, -1)); assert.ok(cz(5, -1, 5, 0)); assert.ok(cz(3, -1, 4, -1));    // kale yan ve arka
  assert.ok(!cz(3, 0, 4, 0), 'ağız kenarı açık'); assert.ok(!cz(4, 0, 5, 0));
  assert.ok(!cz(4, 0, 4, -1), 'ortadan kaleye inen kenar açık'); assert.ok(!cz(3, 0, 4, -1));
  const p = (x, y) => B.nokta(G, x, y);
  for (const [x, y] of [[0, 0], [1, 0], [3, 0], [4, 0], [5, 0], [0, 5], [8, 10], [4, 10], [3, -1], [4, -1]]) assert.ok(B.ziyaretli(G, d, p(x, y)), `${x},${y} ziyaretli`);
  for (const [x, y] of [[1, 1], [4, 5], [7, 9], [4, 1]]) assert.ok(!B.ziyaretli(G, d, p(x, y)), `${x},${y} temiz`);
});

test('sınır boyunca hamle yok, sahanın dışına hamle yok', () => {
  const d = konum(G, { top: [0, 5] });
  const l = B.yasalListe(G, d).map(e => [G.nx[G.ea[e]] === 0 ? G.ny[G.eb[e]] : G.ny[G.ea[e]]]);
  assert.equal(B.yasalListe(G, d).length, 3, 'yalnız üç iç yön');
  assert.equal(E(G, 0, 5, 0, 6), B.kenarXY(G, 0, 5, 0, 6)); assert.ok(G.onCizili[E(G, 0, 5, 0, 6)]);
  assert.ok(!B.yasalListe(G, d).includes(E(G, 0, 5, 0, 6)));
  assert.equal(E(G, 0, 5, -1, 5), -1); assert.equal(E(G, 0, 0, -1, -1), -1);
});

test('köşeden kale yanına çapraz kaçış yok; kaleye düz ve çapraz giriş var', () => {
  assert.equal(E(G, 2, 0, 3, -1), -1); assert.equal(E(G, 6, 0, 5, -1), -1);
  assert.equal(E(G, 2, 10, 3, 11), -1);
  assert.ok(E(G, 3, 0, 4, -1) >= 0); assert.ok(E(G, 5, 0, 4, -1) >= 0); assert.ok(E(G, 4, 0, 4, -1) >= 0);
  assert.ok(E(G, 4, 0, 3, -1) >= 0); assert.ok(E(G, 4, 0, 5, -1) >= 0);
});

test('kale ağzı boyunca yatay hamle var ve seker', () => {
  const d = konum(G, { top: [3, 0] });
  assert.ok(B.yasalListe(G, d).includes(E(G, 3, 0, 4, 0)));
  const r = git(G, d, 4, 0);
  assert.deepEqual(r, { gol: null, sikisti: null, sekti: true, siraGecti: false });
});

/* ---------- gol ---------- */

test('rakip kaleye düz ve çapraz giriş: gol, oyun biter', () => {
  let d = konum(G, { top: [4, 0], sira: 0 });
  assert.deepEqual(git(G, d, 4, -1), { gol: 0, sikisti: null, sekti: false, siraGecti: false });
  assert.deepEqual(d.bitti, { kazanan: 0, sebep: 'gol' });
  assert.equal(B.yasalListe(G, d).length, 0);
  d = konum(G, { top: [3, 0], sira: 0 });
  assert.equal(git(G, d, 4, -1).gol, 0);
  d = konum(G, { top: [5, 10], sira: 1 });
  assert.equal(git(G, d, 4, 11).gol, 1);
  assert.throws(() => B.yap(G, d, 0), /bitti/);
});

test('kendi kaleye gol = kayıp (iki kale)', () => {
  let d = konum(G, { top: [4, 0], sira: 1 });                       // oyuncu 1 üst kaleyi savunuyor
  const r = git(G, d, 4, -1);
  assert.equal(r.gol, 0); assert.equal(d.bitti.kazanan, 0);
  d = konum(G, { top: [4, 10], sira: 0 });
  assert.equal(git(G, d, 4, 11).gol, 1); assert.equal(d.bitti.kazanan, 1);
});

test('gol zincir ortasında da geçerli', () => {
  const d = konum(G, { top: [4, 1], sira: 0, kenarlar: [kenar([4, 2], [4, 1])] });
  assert.equal(git(G, d, 3, 0).sekti, true);                         // direk: sekme, zincir sürer
  assert.equal(d.sira, 0);
  assert.equal(git(G, d, 4, -1).gol, 0);
});

/* ---------- sekme ve zincir ---------- */

test('sekme tespiti: sınır, direk, önceki çizgi, başlangıç noktası, ağız ortası', () => {
  assert.equal(git(G, konum(G, { top: [1, 5] }), 0, 5).sekti, true, 'sınır');
  assert.equal(git(G, konum(G, { top: [2, 1] }), 3, 0).sekti, true, 'direk');
  let d = konum(G, { top: [3, 3], kenarlar: [kenar([4, 4], [5, 5])] });
  assert.equal(git(G, d, 4, 4).sekti, true, 'önceki çizginin ucu');
  d = konum(G, { top: [3, 3], kenarlar: [kenar([4, 4], [5, 5])] });
  assert.equal(git(G, d, 2, 3).sekti, false, 'temiz nokta');
  d = konum(G, { top: [4, 1] });
  assert.equal(git(G, d, 4, 0).sekti, true, 'ağız ortası');
  d = B.baslangic(G, 0);
  assert.deepEqual(git(G, d, 4, 6), { gol: null, sikisti: null, sekti: false, siraGecti: true });   // başlangıç noktası ilk hamleden sonra ziyaretli
  git(G, d, 3, 5);                                                   // oyuncu 1
  const r = git(G, d, 4, 5);                                         // oyuncu 0: başlangıç noktasına dönüş seker
  assert.equal(d.sira, 1 - 1);
  assert.deepEqual(r, { gol: null, sikisti: null, sekti: true, siraGecti: false });
});

test('zincir: sekmede sıra geçmez, temiz noktada geçer', () => {
  const d = B.baslangic(G, 0);
  assert.equal(git(G, d, 4, 4).siraGecti, true); assert.equal(d.sira, 1);
  assert.equal(git(G, d, 3, 5).siraGecti, true); assert.equal(d.sira, 0);
  const r = git(G, d, 4, 5);                                         // (4,5) başlangıç noktası, derece 1
  assert.equal(r.sekti, true); assert.equal(d.sira, 0); assert.equal(d.derece[B.nokta(G, 4, 5)], 2);
  assert.equal(git(G, d, 5, 4).siraGecti, true); assert.equal(d.sira, 1);
});

test('kullanılmış kenar yasal değil', () => {
  const d = B.baslangic(G, 0);
  git(G, d, 4, 6);
  assert.ok(!B.yasalListe(G, d).includes(E(G, 4, 6, 4, 5)));
  assert.equal(B.yasalListe(G, d).length, 7);
});

test('çapraz kesişme: açıkken izinli, kapalıyken engelli', () => {
  for (const [g, beklenen] of [[G, 7], [GK, 6]]) {
    const d = B.baslangic(g, 0);
    git(g, d, 5, 4); git(g, d, 5, 5);                                // (4,5)-(5,4) ve (5,4)-(5,5)
    assert.equal(B.yasalListe(g, d).length, beklenen);
  }
  const k = E(G, 3, 0, 4, -1);
  assert.equal(G.kesisen[k], E(G, 4, 0, 3, -1)); assert.equal(G.kesisen[G.kesisen[k]], k);
  assert.equal(G.kesisen[E(G, 4, 5, 4, 4)], -1);
});

test('zincir ortasında sıkışma = kayıp', () => {
  const d = B.baslangic(G, 0);
  for (const [x, y] of [[3, 4], [2, 3], [1, 2], [1, 1]]) assert.equal(git(G, d, x, y).sekti, false);
  assert.equal(d.sira, 0);                                           // beş hamle: sıra tekrar 0'da, top (1,1)
  const r = git(G, d, 0, 0);                                         // köşe: ziyaretli, tek oynanabilir kenarı az önce kullanıldı
  assert.deepEqual(r, { gol: null, sikisti: 0, sekti: true, siraGecti: false });
  assert.deepEqual(d.bitti, { kazanan: 1, sebep: 'sikisma' });
});

test('kenar çevresi dolu noktada zincir sıkışması', () => {
  // (4,3)'ün kenarlarından yedisi çizili; (4,4)'ten gelen 8. kenar da kullanılınca sıkışır
  const kn = [[5, 4], [3, 4], [3, 3], [5, 3], [3, 2], [4, 2], [5, 2]].map(q => kenar([4, 3], q));
  const d = konum(G, { top: [4, 4], sira: 1, kenarlar: kn });
  const r = git(G, d, 4, 3);
  assert.equal(r.sekti, true); assert.equal(r.sikisti, 1); assert.equal(d.bitti.kazanan, 0);
});

/* ---------- yap / geri al / hash ---------- */

function lcg(tohum) { let s = tohum >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

test('yap/geriAl: rastgele oyun, hepsi geri alınınca durum aynı; hash artımlı = baştan', () => {
  for (const g of [G, GK]) {
    for (let tohum = 1; tohum <= 20; tohum++) {
      const rnd = lcg(tohum), d = B.baslangic(g, tohum % 2);
      const bas = B.kopyala(d);
      let n = 0;
      while (!d.bitti && n < 400) {
        const l = B.yasalListe(g, d);
        assert.ok(l.length > 0);
        B.yap(g, d, l[Math.floor(rnd() * l.length)]); n++;
        const h = { h1: d.h1, h2: d.h2 }; B.hashHesapla(g, d);
        assert.deepEqual({ h1: d.h1, h2: d.h2 }, h, 'artımlı hash');
      }
      assert.ok(d.bitti, 'oyun sonlanır');
      while (d.gecmis.length) B.geriAl(g, d);
      assert.deepEqual(d.kullanilan, bas.kullanilan); assert.deepEqual(d.derece, bas.derece);
      assert.equal(d.top, bas.top); assert.equal(d.sira, bas.sira); assert.equal(d.bitti, null);
      assert.equal(B.anahtar(d), B.anahtar(bas));
    }
  }
});

test('hash: kenar sırasından bağımsız; top ve sıra değişince değişir; 53 bit tam sayı', () => {
  const a = konum(G, { top: [4, 4], kenarlar: [kenar([4, 5], [4, 4]), kenar([3, 3], [4, 4])] });
  const b = konum(G, { top: [4, 4], kenarlar: [kenar([3, 3], [4, 4]), kenar([4, 5], [4, 4])] });
  assert.equal(B.anahtar(a), B.anahtar(b));
  const c = konum(G, { top: [3, 3], kenarlar: [kenar([4, 5], [4, 4]), kenar([3, 3], [4, 4])] });
  const s = konum(G, { top: [4, 4], sira: 1, kenarlar: [kenar([4, 5], [4, 4]), kenar([3, 3], [4, 4])] });
  assert.notEqual(B.anahtar(a), B.anahtar(c)); assert.notEqual(B.anahtar(a), B.anahtar(s));
  assert.ok(Number.isSafeInteger(B.anahtar(a)));
});

test('kopyala bağımsız', () => {
  const d = B.baslangic(G, 0), k = B.kopyala(d);
  git(G, d, 4, 4);
  assert.equal(k.top, B.nokta(G, 4, 5)); assert.equal(k.sira, 0);
  assert.notEqual(B.anahtar(d), B.anahtar(k));
});

/* ---------- tur üretimi ---------- */

// Bağımsız referans: kuralları koordinatlardan yeniden kurar, bitset ve graf kullanmaz.
function referans(W, H, kesisme, agizSeker = true) {
  const m = W / 2;
  const nok = (x, y) => (x >= 0 && x <= W && y >= 0 && y <= H) || ((y === -1 || y === H + 1) && x >= m - 1 && x <= m + 1);
  const gecerliKenar = (x1, y1, x2, y2) => {
    if (!nok(x1, y1) || !nok(x2, y2) || Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) !== 1) return false;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return (mx >= 0 && mx <= W && my >= 0 && my <= H) ||
      (mx >= m - 1 && mx <= m + 1 && ((my >= -1 && my <= 0) || (my >= H && my <= H + 1)));
  };
  const nk = (x, y) => `${x},${y}`;
  const kk = (x1, y1, x2, y2) => [nk(x1, y1), nk(x2, y2)].sort().join('~');
  const ciziliMi = (x1, y1, x2, y2) => {
    const xa = Math.min(x1, x2), xb = Math.max(x1, x2), ya = Math.min(y1, y2), yb = Math.max(y1, y2);
    if (y1 === y2 && (y1 === 0 || y1 === H)) return !(xa >= m - 1 && xb <= m + 1);
    if (x1 === x2 && (x1 === 0 || x1 === W)) return true;
    if (y1 === y2 && (y1 === -1 || y1 === H + 1)) return true;
    return x1 === x2 && (x1 === m - 1 || x1 === m + 1) && (ya === -1 || yb === H + 1);
  };
  const sinirNok = (x, y) => y >= 0 && y <= H && (x === 0 || x === W || y === 0 || y === H) &&
    (agizSeker || !(x === m && (y === 0 || y === H)));
  const yonler = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];
  const cizili = new Set();
  for (let y = -1; y <= H + 1; y++) for (let x = 0; x <= W; x++) for (const [dx, dy] of yonler)
    if (gecerliKenar(x, y, x + dx, y + dy) && ciziliMi(x, y, x + dx, y + dy)) cizili.add(kk(x, y, x + dx, y + dy));

  function yasal(kul, x, y) {
    const l = [];
    for (const [dx, dy] of yonler) {
      const x2 = x + dx, y2 = y + dy;
      if (!gecerliKenar(x, y, x2, y2) || kul.has(kk(x, y, x2, y2))) continue;
      if (!kesisme && dx && dy) {                                    // aynı karenin öbür çaprazı
        const eş = kk(Math.min(x, x2), y < y2 ? y : y2, Math.max(x, x2), y < y2 ? y2 : y);
        const a = kk(x, y, x2, y2);
        const xs = Math.min(x, x2), ys = Math.min(y, y2);
        const diger = a === kk(xs, ys, xs + 1, ys + 1) ? kk(xs + 1, ys, xs, ys + 1) : kk(xs, ys, xs + 1, ys + 1);
        if (gecerliKenar(...diger.split('~').flatMap(s => s.split(',').map(Number))) && kul.has(diger)) continue;
      }
      l.push([x2, y2]);
    }
    return l;
  }
  function turlar(kul0, x0, y0, oyuncu) {
    const cikti = [], gorulen = new Set();
    function ziy(kul, x, y) { if (sinirNok(x, y)) return true; for (const k of kul) if (k.split('~').includes(nk(x, y))) return true; return false; }
    function ic(kul, x, y, yol) {
      for (const [x2, y2] of yasal(kul, x, y)) {
        const k = kk(x, y, x2, y2), yeni = new Set(kul).add(k), yol2 = [...yol, k];
        const son = (sonuc, kazanan) => {
          const anahtar = [sonuc, kazanan, nk(x2, y2), yol2.slice().sort().join(',')].join('|');
          if (!gorulen.has(anahtar)) { gorulen.add(anahtar); cikti.push(anahtar); }
        };
        if (y2 === -1 || y2 === H + 1) { son('gol', y2 === -1 ? 0 : 1); continue; }
        const ziyaret = ziy(kul, x2, y2);                            // hedefe varmadan önce
        const bos = yasal(yeni, x2, y2).length === 0;
        if (ziyaret) {
          if (bos) son('sikisma', 1 - oyuncu);
          else { const a = [nk(x2, y2), [...yeni].sort().join(',')].join('/'); if (!gorulen.has(a)) { gorulen.add(a); ic(yeni, x2, y2, yol2); } }
        } else {
          if (bos) son('sikisma', oyuncu); else son('temiz', -1);
        }
      }
    }
    ic(kul0, x0, y0, []);
    return cikti.sort();
  }
  return { cizili, turlar };
}

// Motorun tur listesini referansla aynı biçime çevirir
function motorAnahtarlari(g, turlar) {
  const nk = (p) => `${g.nx[p]},${g.ny[p]}`;
  return turlar.map(t => [t.sonuc, t.kazanan, nk(t.bitis),
    t.kenarlar.map(e => [nk(g.ea[e]), nk(g.eb[e])].sort().join('~')).sort().join(',')].join('|')).sort();
}
function ciziliKume(g, d) {
  const s = new Set(), nk = (p) => `${g.nx[p]},${g.ny[p]}`;
  for (let e = 0; e < g.E; e++) if (g.onCizili[e]) s.add([nk(g.ea[e]), nk(g.eb[e])].sort().join('~'));
  return s;
}
// referansta "kullanılmış" kümesi: baştan çizili + konumdaki kenarlar
function refKullanilan(ref, g, d) {
  const kul = new Set(ref.cizili), nk = (p) => `${g.nx[p]},${g.ny[p]}`;
  for (let e = 0; e < g.E; e++) if (B.kullanildi(d, e)) kul.add([nk(g.ea[e]), nk(g.eb[e])].sort().join('~'));
  return kul;
}

test('referans: baştan çizili kenar kümesi motorla aynı', () => {
  const ref = referans(8, 10, true);
  assert.deepEqual([...ref.cizili].sort(), [...ciziliKume(G)].sort());
  assert.equal(ref.cizili.size, 40);
});

const karsilastir = (g, ref, d, etiket) => {
  const kul = refKullanilan(ref, g, d);
  const beklenen = ref.turlar(kul, g.nx[d.top], g.ny[d.top], d.sira);
  const r = B.turlarUret(g, d, { enCokTur: 100000, enUzunZincir: 200, enCokDugum: 5e6 });
  assert.equal(r.kesildiMi, false, etiket);
  assert.deepEqual(motorAnahtarlari(g, r.turlar), beklenen, etiket);
  return r.turlar;
};

test('turlarUret: başlangıçta 8 tur, hepsi temiz', () => {
  const d = B.baslangic(G, 0);
  const t = karsilastir(G, referans(8, 10, true), d, 'başlangıç');
  assert.equal(t.length, 8); assert.ok(t.every(x => x.sonuc === 'temiz' && x.kenarlar.length === 1));
});

test('turlarUret: elle sayılmış örnek, 12 tur (6 tek hamle + 6 sekmeli)', () => {
  const d = B.baslangic(G, 0);
  git(G, d, 4, 4); git(G, d, 3, 5);                                  // oyuncu 0, oyuncu 1; sıra 0'da, top (3,5)
  const t = karsilastir(G, referans(8, 10, true), d, 'örnek');
  assert.equal(t.length, 12);
  assert.equal(t.filter(x => x.kenarlar.length === 1).length, 6);
  assert.equal(t.filter(x => x.kenarlar.length === 2).length, 6);
  assert.ok(t.every(x => x.sonuc === 'temiz'));
  const bit = (a) => t.filter(x => x.kenarlar.length === a).map(x => `${G.nx[x.bitis]},${G.ny[x.bitis]}`).sort();
  assert.deepEqual(bit(1), ['2,4', '2,5', '2,6', '3,4', '3,6', '4,6']);
  assert.deepEqual(bit(2), ['3,4', '3,6', '4,6', '5,4', '5,5', '5,6']);
});

test('turlarUret: köşeye yakın nokta, hem sıkışma hem tekilleştirme (referansla aynı)', () => {
  for (const [g, kes] of [[G, true], [GK, false]]) {
    const d = konum(g, { top: [1, 1], sira: 0 });
    const t = karsilastir(g, referans(8, 10, kes), d, 'köşe');
    assert.ok(t.some(x => x.sonuc === 'sikisma' && x.kazanan === 1), 'köşeye girmek sıkışmadır');
    assert.ok(t.length > 8);
  }
});

test('turlarUret: gol turları ve kendi kaleye gol (referansla aynı)', () => {
  const ust = konum(G, { top: [4, 1], sira: 0, kenarlar: [kenar([4, 2], [4, 1])] });
  const t = karsilastir(G, referans(8, 10, true), ust, 'üst kale');
  assert.ok(t.filter(x => x.sonuc === 'gol' && x.kazanan === 0).length >= 2);
  const kendi = konum(G, { top: [4, 1], sira: 1, kenarlar: [kenar([4, 2], [4, 1])] });
  const t2 = karsilastir(G, referans(8, 10, true), kendi, 'kendi kale');
  assert.ok(t2.some(x => x.sonuc === 'gol' && x.kazanan === 0), 'oyuncu 1 kendi kalesine atar → oyuncu 0 kazanır');
});

test('turlarUret: orta saha, birkaç tohumla referansla aynı', () => {
  for (const [g, kes] of [[G, true], [GK, false]]) {
    for (let tohum = 1; tohum <= 6; tohum++) {
      const rnd = lcg(tohum * 7), d = B.baslangic(g, 0);
      for (let i = 0; i < 14 && !d.bitti; i++) { const l = B.yasalListe(g, d); B.yap(g, d, l[Math.floor(rnd() * l.length)]); }
      if (d.bitti) continue;
      karsilastir(g, referans(8, 10, kes), d, `tohum ${tohum} kesişme ${kes}`);
    }
  }
});

test('turlarUret: sınırlar', () => {
  const d = B.baslangic(G, 0);
  git(G, d, 4, 4); git(G, d, 3, 5);
  const a = B.turlarUret(G, d, { enCokTur: 5 });
  assert.equal(a.turlar.length, 5); assert.equal(a.kesildiMi, true);
  const b = B.turlarUret(G, d, { enUzunZincir: 1 });
  assert.equal(b.turlar.filter(x => x.sonuc === 'temiz').length, 6);
  assert.equal(b.turlar.filter(x => x.sonuc === 'kesildi').length, 1);   // yalnız (4,5)'e sekme zinciri kesilir
  assert.equal(b.kesildiMi, true);
  const c = B.turlarUret(G, d, { enCokDugum: 3 });
  assert.equal(c.kesildiMi, true);
  const e = B.turlarUret(G, d, { sonTarih: -1 });                     // zaman kontrolü her 256 düğümde; küçük konumda geçmez
  assert.equal(e.turlar.length, 12);
});

test('turlarUret: üretim sonrası durum değişmez', () => {
  const d = B.baslangic(G, 0); git(G, d, 4, 4);
  const once = B.kopyala(d);
  B.turlarUret(G, d);
  assert.deepEqual(d.kullanilan, once.kullanilan); assert.equal(d.top, once.top); assert.equal(d.sira, once.sira);
  assert.equal(B.anahtar(d), B.anahtar(once)); assert.equal(d.gecmis.length, 4, 'tek hamle kaydı (4 değer)');
});

test('golTuruBul ve guvenliTurVar', () => {
  const ust = konum(G, { top: [4, 1], sira: 0, kenarlar: [kenar([4, 2], [4, 1])] });
  const yol = B.golTuruBul(G, ust);
  assert.ok(yol && yol.length >= 2);
  const k = B.kopyala(ust); B.uygulaTur(G, k, yol);
  assert.deepEqual(k.bitti, { kazanan: 0, sebep: 'gol' });
  assert.equal(B.golTuruBul(G, B.baslangic(G, 0)), null);
  assert.equal(B.guvenliTurVar(G, B.baslangic(G, 0)), true);
  // kendi kaleye gitmekten başka çaresi olmayan durum: top (4,0), yalnız kaleye inen kenarlar açık
  const kn = [[3, 0], [5, 0], [3, 1], [4, 1], [5, 1]].map(q => kenar([4, 0], q));
  const kapali = konum(G, { top: [4, 0], sira: 1, kenarlar: kn });
  assert.equal(B.guvenliTurVar(G, kapali), false);
  const t = B.turlarUret(G, kapali).turlar;
  assert.ok(t.length > 0 && t.every(x => x.sonuc === 'gol' && x.kazanan === 0));
});

test('uygulaTur / turuGeriAl', () => {
  const d = B.baslangic(G, 0), bas = B.kopyala(d);
  git(G, d, 4, 4); git(G, d, 3, 5);
  const t = B.turlarUret(G, d).turlar.find(x => x.kenarlar.length === 2);
  B.uygulaTur(G, d, t.kenarlar);
  assert.equal(d.sira, 1);
  B.turuGeriAl(G, d, 4);
  assert.equal(B.anahtar(d), B.anahtar(bas));
});

test('turlarUret: (1,1) örneği, elle sayılmış: 20 tur (kesişme kapalıyken 19)', () => {
  // (1,1)'den: 18 temiz tur + köşeye (0,0) girip sıkışma; kesişme açıkken (1,0)→(0,1)→(1,1) üçgeni ikinci bir sıkışma verir
  const a = B.turlarUret(G, konum(G, { top: [1, 1] })).turlar;
  assert.equal(a.length, 20); assert.equal(a.filter(x => x.sonuc === 'sikisma').length, 2);
  const b = B.turlarUret(GK, konum(GK, { top: [1, 1] })).turlar;
  assert.equal(b.length, 19); assert.equal(b.filter(x => x.sonuc === 'sikisma').length, 1);
});

test('golTuruBul (yalnız gol sayar): tam sayımla aynı sonuç, rastgele orta oyun konumlarında', () => {
  const buyuk = { enCokTur: 100000, enUzunZincir: 200, enCokDugum: 5e6 };
  let golVar = 0;
  for (let tohum = 1; tohum <= 40; tohum++) {
    const rnd = lcg(tohum * 13), d = B.baslangic(G, 0);
    for (let i = 0; i < 10 + (tohum % 8) * 6 && !d.bitti; i++) { const l = B.yasalListe(G, d); B.yap(G, d, l[Math.floor(rnd() * l.length)]); }
    if (d.bitti) continue;
    const tam = B.turlarUret(G, d, buyuk).turlar.some(t => t.sonuc === 'gol' && t.kazanan === d.sira);
    const hizli = B.golTuruBul(G, d, buyuk) !== null;
    assert.equal(hizli, tam, 'tohum ' + tohum);
    if (tam) golVar++;
  }
  assert.ok(golVar >= 0);
});

/* ---------- seçilebilir kurallar: ağız ortası, tek sayılı H ---------- */

const GA = B.kur({ W: 8, H: 10, kesisme: true, agizSeker: false });   // ağız ortası temiz
const GU = B.kur({ W: 8, H: 11, kesisme: true });                     // uzun saha (tek H)

test('ağız ortası sekmez seçeneği: (4,0) ve (4,10) temiz, oraya varan top sıra geçirir', () => {
  const d = B.baslangic(GA, 0);
  assert.ok(!B.ziyaretli(GA, d, B.nokta(GA, 4, 0))); assert.ok(!B.ziyaretli(GA, d, B.nokta(GA, 4, 10)));
  assert.ok(B.ziyaretli(GA, d, B.nokta(GA, 3, 0)), 'direk yine ziyaretli');
  let k = konum(GA, { top: [4, 1], sira: 0 });
  assert.deepEqual(git(GA, k, 4, 0), { gol: null, sikisti: null, sekti: false, siraGecti: true });
  assert.equal(k.sira, 1);
  k = konum(GA, { top: [3, 0], sira: 0 });
  assert.equal(git(GA, k, 4, 0).sekti, false, 'ağız boyunca yatay hamle de sekmez');
  assert.deepEqual(GA.sayilar, G.sayilar, 'kenar kümesi değişmez');
});

test('tek sayılı H: 8×11 sayıları ve başlangıç noktası başlayana göre', () => {
  assert.deepEqual(GU.sayilar, { nokta: 114, kenar: 389, cizili: 42, oynanabilir: 347 });
  const xy = (g, p) => [g.nx[p], g.ny[p]];
  assert.deepEqual(xy(GU, B.baslangicNoktasi(GU, 0)), [4, 6], 'oyuncu 0 kendi (alt) kalesine yakın satırdan başlar');
  assert.deepEqual(xy(GU, B.baslangicNoktasi(GU, 1)), [4, 5], 'oyuncu 1 kendi (üst) kalesine yakın satırdan başlar');
  assert.deepEqual(xy(G, B.baslangicNoktasi(G, 0)), [4, 5]); assert.deepEqual(xy(G, B.baslangicNoktasi(G, 1)), [4, 5]);
  assert.deepEqual(xy(GU, B.baslangic(GU, 1).top), [4, 5]);
  assert.equal(B.turlarUret(GU, B.baslangic(GU, 0)).turlar.length, 8);
});

test('referans: ağız ortası kapalı ve 8×11 konumlarında tur üretimi aynı', () => {
  for (const [g, ref, H] of [[GA, referans(8, 10, true, false), 10], [GU, referans(8, 11, true), 11]]) {
    assert.deepEqual([...ref.cizili].sort(), [...ciziliKume(g)].sort());
    for (let tohum = 1; tohum <= 6; tohum++) {
      const rnd = lcg(tohum * 11 + H), d = B.baslangic(g, tohum % 2);
      for (let i = 0; i < 16 && !d.bitti; i++) { const l = B.yasalListe(g, d); B.yap(g, d, l[Math.floor(rnd() * l.length)]); }
      if (d.bitti) continue;
      karsilastir(g, ref, d, `H ${H} tohum ${tohum}`);
    }
    // ağız ortasına yakın bir konum (gol ve ağız ortası davranışı birlikte)
    const d = konum(g, { top: [4, 1], sira: 0, kenarlar: [kenar([4, 2], [4, 1])] });
    karsilastir(g, ref, d, `H ${H} ağız`);
  }
});

test('yap/geriAl ve hash: 8×11 ve ağız ortası kapalıyken de tutarlı', () => {
  for (const g of [GA, GU]) {
    for (let tohum = 1; tohum <= 10; tohum++) {
      const rnd = lcg(tohum), d = B.baslangic(g, tohum % 2), bas = B.kopyala(d);
      while (!d.bitti) {
        B.yap(g, d, B.yasalListe(g, d)[Math.floor(rnd() * B.yasalListe(g, d).length)]);
        const h = { h1: d.h1, h2: d.h2 }; B.hashHesapla(g, d); assert.deepEqual({ h1: d.h1, h2: d.h2 }, h);
      }
      while (d.gecmis.length) B.geriAl(g, d);
      assert.equal(B.anahtar(d), B.anahtar(bas)); assert.equal(d.top, bas.top);
    }
  }
});
