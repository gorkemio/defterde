import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as A from '../engine/atis.js';
import * as K from '../engine/kamera2d.js';
import * as Y from '../engine/physics.js';

const yakin = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));

test('fare atışı: ekran boyutundan bağımsız (ppm ile), geri çekme yönü açıyı verir', () => {
  // telefon (ppm 100) ve masaüstü (ppm 220): aynı metre çekme → aynı atış
  const t = A.fareAtisi([500, 300], [500 - 60, 300 + 60], 100), m = A.fareAtisi([500, 300], [500 - 132, 300 + 132], 220);
  yakin(t.hiz, m.hiz, 1e-9); yakin(t.aci, 45, 1e-9); yakin(m.aci, 45, 1e-9);
  assert.equal(A.fareAtisi([0, 0], [2, 2], 100), null, 'çok kısa');
  yakin(A.fareAtisi([0, 0], [-500, 0], 100).hiz, 12);
  yakin(A.fareAtisi([0, 0], [-500, 500], 100).aci, 45);
  yakin(A.fareAtisi([0, 0], [-500, -500], 100).aci, -20, 1e-9);   // aşağı nişan sınırlanır
});

test('dokunma atışı: parmak hızı sahne m/s cinsinden; yavaş savurma atış değil', () => {
  const g = (dx, dy, ms) => [{ p: [0, 0], t: 0 }, { p: [dx, dy], t: ms }];
  assert.equal(A.dokunmaAtisi(g(5, 0, 100), 100), null);
  const yavas = A.dokunmaAtisi(g(30, 0, 100), 100), hizli = A.dokunmaAtisi(g(90, -30, 100), 100);
  assert.ok(hizli.hiz > yavas.hiz);
  yakin(hizli.aci, Math.atan2(30, 90) * 180 / Math.PI, 1e-9);
  // aynı fiziksel savurma iki ekranda aynı
  const k = A.dokunmaAtisi(g(60, 0, 100), 100), b = A.dokunmaAtisi(g(132, 0, 100), 220);
  yakin(k.hiz, b.hiz, 1e-9);
  assert.ok(A.dokunmaAtisi(g(5000, 0, 100), 100).hiz === 12);
});

test('klavye gücü 3 ile 12 arasında gidip gelir; önizleme yalnız ilk anları verir', () => {
  yakin(A.klavyeGucu(0), 3); yakin(A.klavyeGucu(600), 12); yakin(A.klavyeGucu(1200), 3);
  const P = Y.parametreler(oku('ok'));
  const n = A.onizleme(P, { hiz: 8, aci: 10 }, Y.SAHNE_SINIF);
  assert.ok(n.length >= 8 && n.length <= 30);
  assert.ok(n[n.length - 1][0] - n[0][0] < 4, 'tam yörünge değil');
  assert.deepEqual(A.tekrarAtisi({ atis: { hiz: 20, aci: 10 } }), { hiz: 12, aci: 10 });
});

test('kamera: hız yönünde ileri bakar, yükseklik ve hızla uzaklaşır, sınırlı', () => {
  const dur = K.hedef({ x: 5, y: 1, vx: 0, vy: 0 }, 10, 4), git = K.hedef({ x: 5, y: 1, vx: 6, vy: 0 }, 10, 4);
  assert.ok(git.x > dur.x);
  yakin(K.yakinlastirma(1, 5), 1);
  assert.ok(K.yakinlastirma(5, 11) < 1);
  yakin(K.yakinlastirma(50, 50), 0.78);
  // yumuşatma kare hızından bağımsız: iki yarım adım = bir tam adım
  const bir = K.yumusat(0, 10, 0.1, 4), iki = K.yumusat(K.yumusat(0, 10, 0.05, 4), 10, 0.05, 4);
  yakin(bir, iki, 1e-9);
});

test('sarsıntı söner, ağır çekim yalnız olay çevresinde', () => {
  assert.deepEqual(K.sarsinti(-1), [0, 0]);
  assert.deepEqual(K.sarsinti(1), [0, 0]);
  assert.ok(Math.hypot(...K.sarsinti(0.02)) > Math.hypot(...K.sarsinti(0.3)));
  yakin(K.zamanOlcegi(1, null), 1);
  yakin(K.zamanOlcegi(0, 2), 1);
  yakin(K.zamanOlcegi(2.1, 2), 0.35);
  assert.ok(K.zamanOlcegi(1.9, 2) < 1 && K.zamanOlcegi(1.9, 2) > 0.35);
});

test('örnek ara değeri: konum, hız ve uçlar', () => {
  const o = [{ t: 0, x: 0, y: 1, th: 0, ro: 0, z: 0, v: 5 }, { t: 1, x: 4, y: 3, th: 1, ro: 0, z: 0, v: 3 }];
  const s = K.ornekAl(o, 0.25);
  yakin(s.x, 1); yakin(s.y, 1.5); yakin(s.vx, 4); yakin(s.vy, 2); yakin(s.v, 4.5);
  assert.equal(K.ornekAl(o, 5).x, 4);
});

test('ince ayar: Shift basılıyken hareketin dörtte biri işlenir, bırakınca sıçrama olmaz', () => {
  let e = [100, 100];
  e = A.efektifNokta(e, [100, 100], [140, 120], false);
  assert.deepEqual(e, [140, 120]);
  e = A.efektifNokta(e, [140, 120], [180, 160], true);
  assert.deepEqual(e, [150, 130]);
  e = A.efektifNokta(e, [180, 160], [190, 160], false);       // Shift bırakıldı: kaldığı yerden devam
  assert.deepEqual(e, [160, 130]);
  // aynı fare hareketi ince ayarda dört kat küçük açı değişimi verir
  const kaba = A.fareAtisi([0, 0], [-200, 40], 100).aci, ince = A.fareAtisi([0, 0], A.efektifNokta([-200, 0], [-200, 0], [-200, 40], true), 100).aci;
  assert.ok(Math.abs(ince) < Math.abs(kaba) / 2);
});

test('klavye: ↑/↓ açı, ←/→ güç adım adım; Shift ile ince; sınırlar', () => {
  let d = { aci: 12, hiz: A.KLAVYE.gucBaslangic };
  d = A.klavyeAyari(d, 'ArrowUp'); assert.equal(d.aci, 13);
  d = A.klavyeAyari(d, 'ArrowUp', true); assert.equal(d.aci, 13.25);
  d = A.klavyeAyari(d, 'ArrowRight'); assert.equal(d.hiz, 7.25);
  d = A.klavyeAyari(d, 'ArrowLeft', true); assert.equal(d.hiz, 7.2);
  assert.equal(A.klavyeAyari(d, 'a'), null);
  let u = { aci: 79.5, hiz: 11.9 };
  u = A.klavyeAyari(u, 'ArrowUp'); u = A.klavyeAyari(u, 'ArrowRight');
  assert.deepEqual(u, { aci: 80, hiz: 12 });
});
