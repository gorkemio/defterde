import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../engine/elle.js';
import * as F from '../engine/fold.js';
import * as P from '../engine/poz.js';

const yakin = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const yarim = { cizgi: [[0.5, 0], [0.5, 1.414]], tut: [1, 1.414], tip: 'vadi' };
const kose = { cizgi: [[0.5, 0], [0, 0.5]], tut: [0, 0], tip: 'vadi' };

test('sürükleme açısı: tut\'ta 0, çizgide 90, hedefte 180; çizgi boyunca kayma açıyı değiştirmez', () => {
  assert.equal(E.suruklemeAcisi(yarim, [1, 1.414]), 0);
  yakin(E.suruklemeAcisi(yarim, [0.5, 0.9]), 90);
  assert.equal(E.suruklemeAcisi(yarim, [0, 1.414]), 180);
  yakin(E.suruklemeAcisi(yarim, [0.75, 0.2]), E.suruklemeAcisi(yarim, [0.75, 1.3]));
  assert.equal(E.suruklemeAcisi(yarim, [-0.4, 1]), 180, 'hedefin ötesi 180\'de kalır');
  assert.equal(E.suruklemeAcisi(yarim, [1.5, 1]), 0, 'tut\'un gerisi 0\'da kalır');
});

test('açı üstten görünüşün tersidir: tut d_T·cos θ\'ya izdüşer', () => {
  const { dT } = E.eksen(kose);
  for (const th of [30, 60, 120, 150]) {
    const c = Math.cos(th * Math.PI / 180);
    const dP = dT * c;
    const { a, n } = E.eksen(kose);
    yakin(E.suruklemeAcisi(kose, [a[0] + n[0] * dP, a[1] + n[1] * dP]), th, 1e-6);
  }
});

test('ölü bölge ve yapışma', () => {
  const { a, n, dT } = E.eksen(yarim);
  const nokta = (t) => { const dP = dT * (1 - 2 * t); return [a[0] + n[0] * dP, 0.7]; };
  assert.equal(E.suruklemeAcisi(yarim, nokta(0.01)), 0);
  assert.equal(E.suruklemeAcisi(yarim, nokta(0.98)), 180);
  void n;
});

test('bırakma: hedefte 100, toleransta 0, dışında ret', () => {
  const tol = E.tolerans(yarim);
  yakin(tol, 0.10);
  assert.deepEqual(E.birak(yarim, [0, 0.3]).hassasiyet, 100);
  assert.equal(E.birak(yarim, [0.05, 0.3]).hassasiyet, 50);
  assert.ok(E.birak(yarim, [0.09, 1]).kabul);
  assert.ok(!E.birak(yarim, [0.12, 1]).kabul);
  assert.ok(!E.birak(yarim, [-0.12, 1]).kabul, 'fazla çekmek de hata');
});

test('tolerans kısa katta sıkı, uzun katta en çok 0.10', () => {
  const kilit = { cizgi: [[0, 1.1], [1, 1.1]], tut: [0.5, 1.2], tip: 'vadi' };
  yakin(E.tolerans(kilit), 0.04);
  yakin(E.tolerans({ cizgi: [[0, 0.05], [1, 0.05]], tut: [0.5, 0], tip: 'vadi' }), 0.03);
  yakin(E.tolerans(yarim), 0.10);
});

test('kalite: adım ortalamalarının ortalaması; ayna adımı tek adım sayılır', () => {
  assert.equal(E.kalite({}), null);
  assert.equal(E.kalite({ 1: [100, 60], 3: [90] }), 85);
  assert.equal(E.kalite({ 0: [E.IZLE_KALITESI] }), 85);
});

test('kalite düşükse iki kanat farklı açıda: sağ sarkar, sol kalkar (asimetri)', () => {
  const t = JSON.parse(fs.readFileSync(new URL('../tasarimlar/ok.json', import.meta.url), 'utf8'));
  const r = F.uygula(t);
  const model = (kalite) => P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler, P.kaliteAcilari(r.hareketler, kalite))));
  // kanat ucunun yüksekliği (gövdeden en uzak nokta)
  const uc = (m, k) => m.parcalar.filter(p => p.kanat === k).flatMap(p => p.noktalar3).reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a))[2];
  yakin(uc(model(100), 'sag'), 0, 1e-6);
  yakin(uc(model(100), 'sol'), 0, 1e-6);
  const kotu = model(40);
  assert.ok(uc(kotu, 'sag') < -0.015, 'sağ kanat sarkar');
  assert.ok(uc(kotu, 'sol') > 0.01, 'sol kanat kalkar');
  assert.ok(Math.abs(uc(kotu, 'sag')) > Math.abs(uc(kotu, 'sol')), 'sapmalar farklı: uçak yalpalar');
  assert.deepEqual(P.kaliteAcilari(r.hareketler, 100), {});
  // taban açılarına (dihedral) eklenir
  const taban = P.gorunumAcilari(r.hareketler);
  const k = P.kaliteAcilari(r.hareketler, 40, taban);
  const sag = r.hareketler.filter(h => h.kanat === 'sag').pop();
  yakin(k[sag.no], taban[sag.no] + 60 * 0.09);
});

test('ELLE etkileşimi: ön kırışık sürüklenir ama sayılmaz, çevir dokunuştur', () => {
  const vadi = { tip: 'vadi', cizgi: [[0.5, 0], [0.5, 1.414]], tut: [1, 0.707] };
  const ac = { ...vadi, ac: true };
  const cevir = { tip: 'cevir' };
  assert.equal(E.surukle(vadi), true);
  assert.equal(E.surukle(ac), true);
  assert.equal(E.surukle(cevir), false);
  assert.equal(E.sayilir(ac), false);
  assert.equal(E.sayilir(vadi), true);
  assert.equal(E.surukle(null), false);
  assert.equal(E.kabulAnimasyonu(ac), 'kapat-ac');
  assert.equal(E.kabulAnimasyonu(vadi), 'kapat');

  const tablo = [
    [vadi, 'elle', 'surukle', 'Katla →', true],
    [ac, 'elle', 'surukle', 'Katla ve aç →', false],
    [cevir, 'elle', 'dokun', 'Çevir →', false],
    [vadi, 'izle', 'dugme', 'Katla →', false],
    [ac, 'izle', 'dugme', 'Katla ve aç →', false],
    [cevir, 'izle', 'dugme', 'Çevir →', false],
  ];
  for (const [h, mod, tur, dugme, sayilir] of tablo) {
    const et = E.etkilesim(h, mod);
    assert.equal(et.tur, tur, `${h.tip}${h.ac ? '+ac' : ''} ${mod}`);
    assert.equal(et.dugme, dugme);
    assert.equal(et.sayilir, sayilir);
    assert.ok(et.ipucu.length > 5);
  }
});

test('ilk adım (ön kırışık) elle sürüklenip hedefte bırakılınca kabul edilir', () => {
  for (const id of ['ok', 'kilit', 'buldog', 'marti', 'taklaci', 'yarasa']) {
    const t = JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
    const h = F.hareketleriAc(t)[0];
    assert.ok(h.ac && E.surukle(h), id);
    const hedefNokta = F.hedef(h);
    assert.equal(E.suruklemeAcisi(h, hedefNokta), 180);
    assert.equal(E.birak(h, hedefNokta).kabul, true);
  }
});
