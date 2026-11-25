import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../engine/fold.js';
import * as G from '../engine/geom.js';

const yakin = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const tasarim = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const adim = (o) => ({ adimlar: [{ metin: 'x', katman: 'hepsi', ...o }] });
const tekKat = (o) => { const r = F.uygula(adim(o)); return r.son; };
const ORTA = [[0.5, 0], [0.5, F.A4]];

test('başlangıç: tek poligon, A4 alanı, ön yüz, birim dönüşüm', () => {
  const d = F.baslangic();
  assert.equal(d.poligonlar.length, 1);
  yakin(F.alanToplami(d), F.A4);
  assert.equal(d.poligonlar[0].yuz, 'on');
  assert.equal(G.detT(d.poligonlar[0].T), 1);
});

test('vadi: hareket eden yarı üste, arka yüzü görünür; dağ: alta', () => {
  const v = tekKat({ tip: 'vadi', cizgi: ORTA, tut: [1, 0.7] });
  assert.equal(v.poligonlar.length, 2);
  assert.equal(v.poligonlar[1].yuz, 'arka');
  assert.equal(v.poligonlar[0].yuz, 'on');
  assert.ok(v.poligonlar.every(p => p.noktalar.every(q => q[0] <= 0.5 + 1e-9)));
  const d = tekKat({ tip: 'dag', cizgi: ORTA, tut: [1, 0.7] });
  assert.equal(d.poligonlar[0].yuz, 'arka');
  assert.equal(d.poligonlar[1].yuz, 'on');
  const h = F.hedef({ cizgi: ORTA, tut: [1, 0.7] });
  yakin(h[0], 0); yakin(h[1], 0.7);
});

test('aç (ac): geometri değişmez, düz kağıtta x=0.5 kırışığı kalır', () => {
  const d = tekKat({ tip: 'vadi', cizgi: ORTA, tut: [1, 0.7], ac: true });
  assert.equal(d.poligonlar.length, 1);
  assert.equal(d.kirisiklar.length, 1);
  const k = d.kirisiklar[0];
  assert.equal(k.tip, 'ac');
  yakin(k.p1[0], 0.5); yakin(k.p2[0], 0.5);
  assert.equal(F.kirisikler(d, d.poligonlar[0]).length, 1);
});

test('ayna: köşe katları simetrik, kapak alanları 0.125', () => {
  const r = F.uygula({ adimlar: tasarim('ok').adimlar.slice(0, 2) });
  const d = r.son;
  assert.equal(d.poligonlar.length, 3);
  const kapaklar = d.poligonlar.filter(p => p.yuz === 'arka');
  assert.equal(kapaklar.length, 2);
  kapaklar.forEach(p => yakin(Math.abs(G.alan(p.noktalar)), 0.125));
  const [x0, , x1] = F.kutu(d);
  yakin(x0, 0); yakin(x1, 1);
});

test('çevir iki kez: özdeşlik', () => {
  const d = F.uygula({ adimlar: tasarim('ok').adimlar.slice(0, 3) }).son;
  const dd = F.cevir(F.cevir(d));
  assert.deepEqual(dd.poligonlar.map(p => p.id), d.poligonlar.map(p => p.id));
  dd.poligonlar.forEach((p, i) => {
    assert.equal(p.yuz, d.poligonlar[i].yuz);
    p.noktalar.forEach((q, j) => { yakin(q[0], d.poligonlar[i].noktalar[j][0]); yakin(q[1], d.poligonlar[i].noktalar[j][1]); });
    p.T.forEach((v, j) => yakin(v, d.poligonlar[i].T[j]));
  });
});

test('Ok: yarım kattan sonra 8 katman, kanat katı yalnız üst yarının 4 katmanını taşır', () => {
  const r = F.uygula(tasarim('ok'));
  const yarimSonrasi = r.anlar[6];
  assert.equal(yarimSonrasi.poligonlar.length, 8);
  assert.ok(yarimSonrasi.poligonlar.every(p => p.noktalar.every(q => q[0] <= 0.5 + 1e-9)));
  const hz = F.hazirla(yarimSonrasi, r.hareketler[6]);
  assert.deepEqual(hz.hareketEdenler.map(m => m.indeks), [4, 5, 6, 7]);
  const sonra = r.anlar[7];
  sonra.poligonlar.slice(0, 4).forEach((p, i) => assert.equal(p.id, yarimSonrasi.poligonlar[i].id));   // alt yarı yerinde
  // taşınan kanat katmanları kat çizgisinin öbür yanına geçer (burundan inen açılı çizgi)
  const h = r.hareketler[6], tutYani = Math.sign(G.taraf(h.cizgi, h.tut));
  sonra.poligonlar.slice(-4).forEach(p => p.noktalar.forEach(q => assert.ok(G.taraf(h.cizgi, q) * tutYani <= 1e-9)));
});

test('her adımda düz kağıda taşınan alan toplamı kağıdın alanı, dönüşümler izometri', () => {
  for (const id of ['ok', 'kilit', 'marti', 'taklaci']) {
    const r = F.uygula(tasarim(id));
    const alan = r.kagit.en * r.kagit.boy;
    for (const d of r.anlar) {
      yakin(F.alanToplami(d), alan);
      const duzAlan = d.poligonlar.reduce((s, p) => s + Math.abs(G.alan(p.noktalar.map(q => G.donustur(p.T, q)))), 0);
      yakin(duzAlan, alan);
      d.poligonlar.forEach(p => {
        yakin(Math.abs(G.detT(p.T)), 1);
        assert.equal(p.yuz === 'on', G.detT(p.T) > 0, `poligon ${p.id} yüz/det tutarlı`);
      });
    }
  }
});

test('Kilit: kilit adımı tam 3 parçayı (uç + iki kapak ucu) kaldırır, dağ yarım kattan sonra kilit dışta', () => {
  const r = F.uygula(tasarim('kilit'));
  const h = r.hareketler.find(x => x.adim === 4);
  const hz = F.hazirla(r.anlar[h.no], h);
  assert.equal(hz.hareketEdenler.length, 3);
  const kilitIdleri = r.anlar[h.no + 1].poligonlar.slice(-3).map(p => p.id);
  const dag = r.anlar[h.no + 2].poligonlar;
  const enAlt = dag[0], enUst = dag[dag.length - 1];
  assert.ok(enAlt.etiketler.includes('h:' + h.no) && enUst.etiketler.includes('h:' + h.no),
    'kilit parçaları yığının iki dış yüzünde');
  assert.equal(kilitIdleri.length, 3);
});

test('kanat ucu katı (ust) yalnız üstteki kanadın parçalarını taşır', () => {
  for (const id of ['taklaci']) {
    const r = F.uygula(tasarim(id));
    const h = r.hareketler.find(x => x.adim === r.hareketler[r.hareketler.length - 1].adim - 2);
    const hz = F.hazirla(r.anlar[h.no], h);
    assert.ok(hz.hareketEdenler.length >= 1);
    const kanat = hz.hareketEdenler[0].kaynak.etiketler.find(e => e.startsWith('kanat:'));
    assert.ok(kanat, `${id}: taşınan parça bir kanata ait`);
    assert.ok(hz.hareketEdenler.every(m => m.kaynak.etiketler.includes(kanat)), `${id}: hepsi aynı kanattan`);
  }
});

test('hatalar: tut çizgide, kağıt dışında, desteklenmeyen katman ve poz', () => {
  assert.throws(() => tekKat({ tip: 'vadi', cizgi: ORTA, tut: [0.5, 0.3] }), e => e.kod === 'TutCizgiUstunde');
  assert.throws(() => tekKat({ tip: 'vadi', cizgi: [[2, 0], [2, 1]], tut: [3, 0.5] }), e => e.kod === 'HareketEdenYok');
  assert.throws(() => tekKat({ tip: 'vadi', cizgi: ORTA, tut: [3, 0.5], katman: 'ust' }), e => e.kod === 'TutKagitDisinda');
  assert.throws(() => tekKat({ tip: 'vadi', cizgi: ORTA, tut: [1, 0.5], katman: 2 }), e => e.kod === 'Desteklenmiyor');
  assert.throws(() => tekKat({ tip: 'vadi', cizgi: ORTA, tut: [1, 0.5], ayna: true, poz: 90 }), e => e.kod === 'AynaPoz');
});

test('kırışıklar her zaman kendi poligonunun içinde kalır (yansımış poligonlarda da)', () => {
  for (const id of ['ok', 'kilit', 'yarasa']) {
    for (const d of F.uygula(tasarim(id)).anlar) {
      for (const p of d.poligonlar) {
        for (const s of F.kirisikler(d, p, null)) {
          for (const q of s) assert.ok(G.icinde(p.noktalar, q, 1e-6), `${id} poligon ${p.id} dışında kırışık`);
        }
      }
    }
  }
});
