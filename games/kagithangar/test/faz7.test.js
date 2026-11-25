import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../engine/fold.js';
import * as P from '../engine/poz.js';
import { kirisikDeseni, boyaDeseni, isimDeseni } from '../engine/baski.js';
import { notPaketle, notCoz, satirlara, NOT_SINIRI } from '../engine/not.js';
import { pilotKarti, ROZETLER } from '../engine/pilot.js';

const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const yukle = (id) => { const r = F.uygula(oku(id)); return { r, m: P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler))) }; };

test('kırışık deseni: her kırışık vadi ya da dağ, her katlama adımına bir numara', () => {
  const t = oku('ok');
  const { r } = yukle('ok');
  const d = kirisikDeseni(r.son);
  assert.equal(d.kirisikler.length, r.son.kirisiklar.length);
  assert.ok(d.kirisikler.every(k => k.tur === 'vadi' || k.tur === 'dag'));
  const katlamaAdimlari = t.adimlar.map((a, i) => (a.tip === 'cevir' ? null : i + 1)).filter(Boolean);
  assert.deepEqual(d.etiketler.map(e => e.no).sort((a, b) => a - b), katlamaAdimlari);
  d.etiketler.forEach(e => assert.ok(e.nokta[0] >= -1e-9 && e.nokta[0] <= 1 + 1e-9 && e.nokta[1] >= -1e-9 && e.nokta[1] <= 1.414 + 1e-9));
  // ilk adım (orta kırışık, ön yüz yukarıdayken vadi) önden vadi görünür
  assert.ok(d.kirisikler.filter(k => k.adim === 0).every(k => k.tur === 'vadi'));
});

test('kırışık deseni simetrik: iki kanat katı önden aynı türde', () => {
  for (const id of ['ok', 'kilit', 'buldog']) {
    const t = oku(id);
    const { r } = yukle(id);
    const d = kirisikDeseni(r.son);
    const kanatAdimlari = t.adimlar.map((a, i) => (a.kanat ? i : -1)).filter(i => i >= 0);
    const turler = kanatAdimlari.map(i => new Set(d.kirisikler.filter(k => k.adim === i).map(k => k.tur)));
    assert.deepEqual([...turler[0]], [...turler[1]], id);
  }
});

test('boya deseni: kanattaki çizgi düz kağıdın içine, doğru yüze düşer', () => {
  const { r, m } = yukle('ok');
  const g = P.kanatGeometrisi(m, 'sag');
  const noktalar = [0.3, 0.4, 0.5, 0.6].map(t => {
    const x = g.disX + (g.menteseX - g.disX) * t, y = 1.2;
    const b = P.boyaNoktasi(r.son, m, 'sag', [x, y]);
    return [x, y, b.poligonId, b.fx, b.fy];
  });
  const d = boyaDeseni(r.son, m, [{ renk: 'mavi', kanat: 'sag', noktalar }]);
  const hepsi = [...d.on, ...d.arka].flatMap(p => p.noktalar);
  assert.equal(hepsi.length, 4);
  hepsi.forEach(([x, y]) => assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1.414));
});

test('isim deseni: kağıdın içinde, okunur yönde çevrilebilir', () => {
  const { r, m } = yukle('ok');
  const ana = P.anaDuzlem(m, 'sag');
  const yer = P.isimYeri(P.kanatGeometrisi(m, 'sag'), ana.map(p => p.noktalar2.map(([x, y]) => [x * 100, y * 100])), 'Mavi Şimşek');
  const d = isimDeseni(r.son, m, yer);
  assert.ok(d && (d.yuz === 'on' || d.yuz === 'arka'));
  assert.ok(d.merkez[0] > 0 && d.merkez[0] < 1 && d.merkez[1] > 0 && d.merkez[1] < 1.414);
});

test('not paketi: gidip gelir, güvenilmez girdiyi reddeder', () => {
  const ucak = { tasarim: 'marti', ad: 'Sessiz Martı', kalite: 88.4, ayar: { kanatcik: 1, kivrimSol: 0, kivrimSag: -1, atac: 2 },
    boya: { cizgiler: [{ renk: 'kirmizi', kanat: 'sag', noktalar: [[0.31234, 1.2, 9, 0.1, 0.2], [0.35, 1.25, 9, 0.1, 0.2]] }] } };
  const p = notPaketle(ucak, 'Teneffüste bahçede buluşalım!', 'Deniz');
  const geri = notCoz(JSON.parse(JSON.stringify(p)));
  assert.equal(geri.tasarim, 'marti');
  assert.equal(geri.not, 'Teneffüste bahçede buluşalım!');
  assert.equal(geri.gonderen, 'Deniz');
  assert.equal(geri.kalite, 88);
  assert.deepEqual(geri.ayar, ucak.ayar);
  assert.deepEqual(geri.cizgiler[0].noktalar[0], [0.312, 1.2]);
  assert.equal(geri.cizgiler[0].renk, 'kirmizi');
  assert.equal(notPaketle(ucak, 'x'.repeat(500)).n.length, NOT_SINIRI);
  for (const bozuk of [null, {}, { ...p, s: 2 }, { ...p, t: 'roket' }, { ...p, n: 'x'.repeat(400) }, { ...p, y: [5, 0, 0, 0] },
    { ...p, k: 140 }, { ...p, b: [[0, 0, [1, 'a']]] }, { ...p, b: [[9, 0, []]] }, { ...p, b: [[0, 0, Array(2000).fill(0.5)]] }]) {
    assert.throws(() => notCoz(bozuk));
  }
});

test('not satırlara bölünür, kelime bölünmez', () => {
  const s = satirlara('Merhaba bu bir deneme notu ve biraz uzun bir cümle', 12);
  assert.ok(s.every(l => l.length <= 12 || !l.includes(' ')));
  assert.equal(s.join(' '), 'Merhaba bu bir deneme notu ve biraz uzun bir cümle');
});

test('pilot kartı: boş hangar çaylak, uçtukça rütbe ve rozet', () => {
  const bos = pilotKarti([]);
  assert.equal(bos.rutbe, 'Çaylak');
  assert.equal(bos.rozetler.filter(r => r.kazanildi).length, 0);
  assert.equal(bos.rozetler.length, ROZETLER.length);
  const sahneler = { koridor: { enUzak: 22 }, merdiven: { enUzun: 6 }, park: { enUzak: 31 } };
  const ucak = (o) => ({ tasarim: 'ok', mod: 'elle', kalite: 96, istatistik: { ucus: 30, enUzak: 12.4, loop: 2, pencere: 1, sahneler }, yipranma: { utu: 1 }, ...o });
  const ucaklar = ['ok', 'kilit', 'buldog', 'marti', 'taklaci', 'yarasa'].map(t => ucak({ tasarim: t, ad: t })).concat([ucak({ emekli: true, not: { metin: 'x' }, gercek: [{ mesafe: 6 }] })]);
  const k = pilotKarti(ucaklar, { gunun: { basarili: true }, duello: { oynanan: 1 } });
  assert.ok(k.rozetler.every(r => r.kazanildi), JSON.stringify(k.rozetler.filter(r => !r.kazanildi)));
  assert.equal(k.ozet.enUzak, 12.4);
  assert.equal(k.rutbe, 'Gökyüzü Efsanesi');
  assert.equal(k.sonraki, null);
  const ayarsiz = pilotKarti(ucaklar);
  assert.ok(!ayarsiz.rozetler.find(r => r.id === 'duello').kazanildi && !ayarsiz.rozetler.find(r => r.id === 'gunun').kazanildi);
});

test('düz kağıt mürekkebi: her parçada düz nokta, katlanmış uçakta aynı 3B noktaya iner', async () => {
  const { r, m } = yukle('marti');
  const kam = P.kamera(...P.KAMERALAR.UCUS);
  const ekran = (q) => q;
  const iz = P.izdusum(m, kam);
  const G = await import('../engine/geom.js');
  for (const p of iz.parcalar) {
    const pol = r.son.poligonlar.find(q => q.id === p.id);
    const yerel = G.merkez(p.noktalar2);
    const duz = G.donustur(pol.T, yerel);
    const A = P.duzdenEkrana(pol.T, p.M, kam, ekran, duz);
    const ekranda = [A[0] * duz[0] + A[2] * duz[1] + A[4], A[1] * duz[0] + A[3] * duz[1] + A[5]];
    // çizilen (kalınlık kadar kaydırılmış) düzlemde parçanın merkezi
    const R = p.M.R, t = p.M.t;
    const uc = [R[0] * yerel[0] + R[1] * yerel[1] + t[0], R[3] * yerel[0] + R[4] * yerel[1] + t[1], R[6] * yerel[0] + R[7] * yerel[1] + t[2]];
    const beklenen = kam(uc);
    assert.ok(Math.hypot(ekranda[0] - beklenen.x, ekranda[1] - beklenen.y) < 1e-9, `parça ${p.id}`);
  }
});

test('düz kağıt çizgileri baskıya ve not paketine olduğu gibi geçer', () => {
  const { r, m } = yukle('ok');
  const cizgiler = [{ renk: 'yesil', duz: true, yuz: 'arka', kalinlik: 1.1, noktalar: [[0.2, 0.3], [0.3, 0.35]] }, { renk: 'mavi', duz: true, yuz: 'on', noktalar: [[0.5, 1]] }];
  const d = boyaDeseni(r.son, m, cizgiler);
  assert.deepEqual(d.arka[0].noktalar, [[0.8, 0.3], [0.7, 0.35]], 'arka yüz kağıdın arkasından bakış');
  assert.deepEqual(d.on[0].noktalar, [[0.5, 1]]);
  const p = notPaketle({ tasarim: 'ok', ad: 'x', kalite: 80, boya: { cizgiler } }, 'n');
  const geri = notCoz(JSON.parse(JSON.stringify(p)));
  assert.equal(geri.cizgiler[0].duz, true);
  assert.equal(geri.cizgiler[0].yuz, 'arka');
  assert.equal(geri.cizgiler[1].yuz, 'on');
});
