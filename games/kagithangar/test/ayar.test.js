import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../engine/fold.js';
import * as P from '../engine/poz.js';
import * as G from '../engine/geom.js';
import { TASARIM_IDLERI } from '../engine/tasarim.js';

const yukle = (id) => {
  const r = F.uygula(JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8')));
  return { r, m: P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler))) };
};
const zAraligi = (m, ad, kanat) => {
  const z = m.parcalar.filter(p => p.sanal === ad && p.kanat === kanat).flatMap(p => p.noktalar3.map(q => q[2]));
  return z.length ? [Math.min(...z), Math.max(...z)] : null;
};
const alan2 = (m) => m.parcalar.reduce((s, p) => s + Math.abs(G.alan(p.noktalar2)), 0);

test('ayar yoksa model değişmez', () => {
  const { m } = yukle('ok');
  assert.equal(P.ayarKatlari(m, { kanatcik: 0, kivrimSol: 0, kivrimSag: 0 }), m);
});

test('kanatçık yukarı/aşağı: iki kanadın arka uç köşesi aynı yöne bükülür, alan korunur', () => {
  for (const id of TASARIM_IDLERI) {
    const { m } = yukle(id);
    const yukari = P.ayarKatlari(m, { kanatcik: 2 }), asagi = P.ayarKatlari(m, { kanatcik: -1 });
    for (const k of ['sol', 'sag']) {
      assert.ok(zAraligi(yukari, 'kanatcik', k)[1] > 0.02, `${id} ${k} yukarı`);
      assert.ok(zAraligi(asagi, 'kanatcik', k)[0] < -0.01, `${id} ${k} aşağı`);
    }
    assert.ok(Math.abs(alan2(yukari) - alan2(m)) < 1e-6, `${id} alan`);
  }
});

test('kıvrım yalnız kendi kanadını büker', () => {
  const { m } = yukle('ok');
  const a = P.ayarKatlari(m, { kivrimSag: 1, kivrimSol: -1 });
  assert.ok(zAraligi(a, 'kivrim', 'sag')[1] > 0.02);
  assert.ok(zAraligi(a, 'kivrim', 'sol')[0] < -0.02);
  const b = P.ayarKatlari(m, { kivrimSag: 1 });
  assert.equal(zAraligi(b, 'kivrim', 'sol'), null);
});

test('boya noktası: kanadın görünen katmanı ve düz kağıt koordinatı', () => {
  const { r, m } = yukle('ok');
  const g = P.kanatGeometrisi(m, 'sag');
  const nokta = [(g.menteseX + g.disX) / 2, 1.2];
  const b = P.boyaNoktasi(r.son, m, 'sag', nokta);
  assert.ok(b && Number.isInteger(b.poligonId));
  const pol = r.son.poligonlar.find(p => p.id === b.poligonId);
  assert.ok(pol.etiketler.includes('kanat:sag'));
  const geri = G.donustur(G.tersT(pol.T), [b.fx, b.fy]);
  assert.ok(Math.hypot(geri[0] - nokta[0], geri[1] - nokta[1]) < 1e-9);
  assert.ok(b.fx >= 0 && b.fx <= 1 && b.fy >= 0 && b.fy <= 1.414, 'düz kağıdın içinde');
  assert.equal(P.boyaNoktasi(r.son, m, 'sag', [5, 5]), null);
});
