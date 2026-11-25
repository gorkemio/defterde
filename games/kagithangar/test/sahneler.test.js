import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Y from '../engine/physics.js';
import { sahneHazirla, gununUcusu, SAHNE_IDLERI, ruzgarFonksiyonu } from '../engine/sahneler.js';

const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const P = (id, u = {}) => Y.parametreler(oku(id), { kalite: 100, ...u });

test('her sahnede uçuş biter, elden başlar, zeminin altına inmez', () => {
  for (const id of SAHNE_IDLERI) {
    const s = sahneHazirla(id);
    const r = Y.simule(P('ok'), { hiz: 8, aci: 8 }, s);
    assert.equal(r.ornekler[0].x, s.el[0]);
    assert.equal(r.ornekler[0].y, s.el[1]);
    assert.ok(r.ornekler.every(o => o.y >= s.zeminY(o.x) - 1e-9), id);
    assert.ok(r.sure > 0 && r.sahne === id, id);
  }
});

test('koridorda 12 m duvarı yok: sert atış sınıftakinden uzağa gider', () => {
  const sinif = Y.simule(P('ok'), { hiz: 11, aci: 3 }, sahneHazirla('sinif'));
  const koridor = Y.simule(P('ok'), { hiz: 11, aci: 3 }, sahneHazirla('koridor'));
  assert.ok(koridor.mesafe > 13, `${koridor.mesafe}`);
  assert.ok(koridor.mesafe > sinif.mesafe);
});

test('merdiven boşluğunda iki kat yukarıdan: planör sınıftakinden çok daha uzun havada kalır', () => {
  const s = Y.simule(P('marti'), { hiz: 5, aci: 0 }, sahneHazirla('merdiven'));
  const sinif = Y.simule(P('marti'), { hiz: 5, aci: 0 }, sahneHazirla('sinif'));
  assert.ok(s.sure > sinif.sure * 1.8, `${s.sure} vs ${sinif.sure}`);
});

test('rüzgâr: balkondan süzülen planörü arkadan esen uzağa, karşıdan esen yakına taşır; aynı tohum aynı rüzgâr', () => {
  const arka = Y.simule(P('marti'), { hiz: 6, aci: 5 }, sahneHazirla('balkon', { ruzgar: { ort: 3, sert: 0 } }));
  const sakin = Y.simule(P('marti'), { hiz: 6, aci: 5 }, sahneHazirla('balkon', { ruzgar: { ort: 0, sert: 0 } }));
  const karsi = Y.simule(P('marti'), { hiz: 6, aci: 5 }, sahneHazirla('balkon', { ruzgar: { ort: -3, sert: 0 } }));
  assert.ok(arka.mesafe > sakin.mesafe * 1.2 && sakin.mesafe > karsi.mesafe * 1.5, `${arka.mesafe} ${sakin.mesafe} ${karsi.mesafe}`);
  const f1 = ruzgarFonksiyonu({ ort: 1, sert: 2 }, 'x'), f2 = ruzgarFonksiyonu({ ort: 1, sert: 2 }, 'x');
  assert.equal(f1(1.7), f2(1.7));
  assert.equal(ruzgarFonksiyonu(null), null);
});

test('balkon: sahanlıktan ileri atılan uçak aşağıdaki zemine iner', () => {
  const r = Y.simule(P('yarasa'), { hiz: 6, aci: 5 }, sahneHazirla('balkon', { ruzgar: { ort: 0, sert: 0 } }));
  const son = r.ornekler[r.ornekler.length - 1];
  assert.equal(son.y, 0);
  assert.ok(r.mesafe > 15, `${r.mesafe}`);
});

test('günün uçuşu: aynı gün aynı görev, farklı gün farklı', () => {
  const a = gununUcusu('2026-10-18'), b = gununUcusu('2026-10-18');
  assert.deepEqual(a, b);
  assert.ok(SAHNE_IDLERI.includes(a.sahne) && a.hedef > 0);
  const gunler = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(gununUcusu(`2026-11-${String(i + 1).padStart(2, '0')}`))));
  assert.ok(gunler.size > 20);
});

test('günün uçuşu yerel takvim gününe göre (UTC gece yarısında değişmez)', () => {
  assert.equal(gununUcusu(new Date(2026, 9, 19, 1, 30)).gun, '2026-10-19');
  assert.equal(gununUcusu(new Date(2026, 9, 19, 23, 50)).gun, '2026-10-19');
  assert.deepEqual(gununUcusu(new Date(2026, 9, 19, 12)), gununUcusu('2026-10-19'));
});
