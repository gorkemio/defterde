import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Y from '../engine/physics.js';
import { TASARIM_IDLERI } from '../engine/tasarim.js';

const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const ucus = (id, u, hiz, aci, sahne = Y.SAHNE_ACIK) => Y.simule(Y.parametreler(oku(id), { kalite: 100, ...u }), { hiz, aci }, sahne);

test('simetrik uçak yana sapmaz', () => {
  for (const id of TASARIM_IDLERI) {
    const r = ucus(id, {}, 8, 6);
    assert.ok(r.ornekler.every(s => Math.abs(s.z) < 1e-9), id);
  }
});

test('aynı yumuşak atışta planör dart\'tan belirgin uzun havada kalır', () => {
  const ok = ucus('ok', {}, 6, 8), marti = ucus('marti', {}, 6, 8);
  assert.ok(marti.sure > ok.sure * 1.5, `${marti.sure} vs ${ok.sure}`);
  assert.ok(ucus('yarasa', {}, 6, 8).sure > ok.sure * 1.5);
});

test('sert atışta dart planörden uzağa gider', () => {
  const ok = ucus('ok', {}, 11, 3), marti = ucus('marti', {}, 11, 3);
  assert.ok(ok.mesafe > marti.mesafe * 1.15, `${ok.mesafe} vs ${marti.mesafe}`);
});

test('aşırı hücum açısında stall: taşıma düşer', () => {
  const P = Y.parametreler(oku('ok'));
  const der = Math.PI / 180;
  assert.ok(Y.CL(P, 25 * der) < Y.CL(P, 10 * der));
  assert.ok(Y.CL(P, 10 * der) > Y.CL(P, 5 * der));
  assert.ok(Y.CL(P, -25 * der) > Y.CL(P, -10 * der), 'simetrik');
});

test('Taklacı kanatçık +2 ile takla atar; Ok aynı atışta atmaz', () => {
  const t = ucus('taklaci', { ayar: { kanatcik: 2 } }, 9, 25, Y.SAHNE_SINIF);
  assert.ok(t.loop >= 1, `loop ${t.loop}`);
  assert.equal(ucus('ok', { ayar: { kanatcik: 2 } }, 9, 25, Y.SAHNE_SINIF).loop, 0);
  assert.equal(ucus('taklaci', {}, 9, 25, Y.SAHNE_SINIF).loop, 0, 'kanatçık düzken takla yok');
});

test('sınıf: yumuşak atış sınıfın ortasında iner, sert atış duvara ya da pencereye varır', () => {
  const yumusak = ucus('ok', {}, 5, 5, Y.SAHNE_SINIF);
  assert.equal(yumusak.olay, 'indi');
  assert.ok(yumusak.mesafe > 4 && yumusak.mesafe < 8, `${yumusak.mesafe}`);
  assert.equal(ucus('ok', {}, 10, 5, Y.SAHNE_SINIF).olay, 'duvar');
  const p = ucus('kilit', {}, 10, 5, Y.SAHNE_SINIF);
  assert.equal(p.olay, 'pencere');
  assert.ok(p.mesafe > Y.SAHNE_SINIF.uzunluk, 'pencere bonusu');
});

test('kayan uçak duvarın içinden geçmez', () => {
  for (const id of TASARIM_IDLERI) {
    const r = ucus(id, {}, 7, 10, Y.SAHNE_SINIF);
    assert.ok(r.ornekler.every(s => s.x < Y.SAHNE_SINIF.uzunluk), id);
  }
});

test('ataç: daha ağır, daha alçak ve daha düz uçar', () => {
  const yok = ucus('ok', {}, 6, 8), var_ = ucus('ok', { ayar: { atac: 2 } }, 6, 8);
  assert.ok(var_.enYuksek < yok.enYuksek);
  assert.ok(Y.parametreler(oku('ok'), { ayar: { atac: 2 } }).m > Y.parametreler(oku('ok')).m);
});

test('düşük kalite: yana sapar, mesafe kısalır; sapma yönü uçağa bağlı ve tekrarlanabilir', () => {
  const iyi = ucus('ok', { id: 'u1' }, 8, 5, Y.SAHNE_SINIF);
  const kotu = ucus('ok', { id: 'u1', kalite: 40 }, 8, 5, Y.SAHNE_SINIF);
  assert.ok(Math.abs(kotu.sapma) > 0.3, `sapma ${kotu.sapma}`);
  assert.ok(kotu.mesafe < iyi.mesafe);
  assert.equal(ucus('ok', { id: 'u1', kalite: 40 }, 8, 5, Y.SAHNE_SINIF).sapma, kotu.sapma);
});

test('kıvrım yanlara saptırır, yıpranma 10 kırışıktan sonra mesafeyi kısaltır', () => {
  const sag = ucus('ok', { ayar: { kivrimSag: 1 } }, 8, 5), sol = ucus('ok', { ayar: { kivrimSol: 1 } }, 8, 5);
  assert.ok(Math.sign(sag.sapma) === -Math.sign(sol.sapma) && Math.abs(sag.sapma) > 0.1);
  const yeni = ucus('ok', { id: 'y' }, 8, 5), yorgun = ucus('ok', { id: 'y', yipranma: { kirisik: 20 } }, 8, 5);
  assert.ok(yorgun.mesafe < yeni.mesafe);
  assert.equal(ucus('ok', { id: 'y', yipranma: { kirisik: 8 } }, 8, 5).mesafe, yeni.mesafe, '10\'a kadar etkisiz');
});

test('atış sınırları ve kayıt biçimi', () => {
  assert.deepEqual(Y.atis(20, 100), { hiz: 12, aci: 80 });
  assert.deepEqual(Y.atis(1, -50), { hiz: 3, aci: -20 });
  const r = ucus('ok', {}, 7, 5, Y.SAHNE_SINIF);
  assert.ok(r.yol.length <= Y.YOL_NOKTASI && r.yol.length >= 2);
  assert.ok(r.ornekler.length > 10 && r.sure > 0 && r.enYuksek >= 1.3);
  assert.ok(['indi', 'duvar', 'pencere', 'yereCakildi', 'yanDuvar'].includes(r.olay));
});

/* ---------------- Faz D: fizik düzeltmeleri ---------------- */

test('stall sonrası sürükleme artar (kopan akış)', () => {
  const P = Y.parametreler(oku('ok'));
  const der = Math.PI / 180;
  assert.ok(Y.CD(P, 25 * der) > Y.CD(P, 13 * der));
  assert.ok(Y.CD(P, 13 * der) > Y.CD(P, 5 * der));
  assert.ok(Math.abs(Y.CD(P, 0) - P.CD0) < 1e-12);
});

test('yanal sapma sınırlı: kötü katlanmış uçak bile geri dönmez, ileri gider', () => {
  const r = ucus('ok', { id: 'kotu', kalite: 0, ayar: { kivrimSol: -1, kivrimSag: 1 } }, 6, 30, Y.SAHNE_ACIK);
  for (let i = 1; i < r.ornekler.length; i++) assert.ok(r.ornekler[i].x >= r.ornekler[i - 1].x - 1e-9, `örnek ${i} geri gitti`);
});

test('sapma yönü yıpranmayla değişmez (aynı uçak hep aynı yöne kayar)', () => {
  const P0 = Y.parametreler(oku('ok'), { id: 'u_yon', kalite: 50 });
  const P20 = Y.parametreler(oku('ok'), { id: 'u_yon', kalite: 50, yipranma: { kirisik: 20 } });
  assert.equal(Math.sign(P0.sapma), Math.sign(P20.sapma));
});

test('duvar sekmesi takla sayılmaz', () => {
  for (const id of ['ok', 'kilit', 'buldog']) {
    const r = ucus(id, {}, 12, 5, Y.SAHNE_SINIF);
    assert.equal(r.olay, 'duvar', id);
    assert.equal(r.loop, 0, id);
  }
});

test('Taklacı varsayılan kanatçıkla (+1) takla atar', () => {
  const t = JSON.parse(fs.readFileSync(new URL('../tasarimlar/taklaci.json', import.meta.url), 'utf8'));
  for (const [hiz, aci] of [[9, 25], [11, 25]]) {
    assert.ok(ucus('taklaci', { ayar: t.varsayilanAyar }, hiz, aci, Y.SAHNE_SINIF).loop >= 1, `${hiz}/${aci}`);
  }
});

test('görüntü yalpası sıçramaz: inişte yumuşakça düzelir', () => {
  const r = ucus('ok', { id: 'r', kalite: 30 }, 7, 8, Y.SAHNE_SINIF);
  for (let i = 1; i < r.ornekler.length; i++) assert.ok(Math.abs(r.ornekler[i].ro - r.ornekler[i - 1].ro) < 0.06, `örnek ${i}`);
});

test('yükseltilmiş zemine alttan girilmez: kenarına çarpar', () => {
  const sahne = { ...Y.SAHNE_ACIK, id: 'test', zeminY: (x) => (x >= 3 && x <= 6 ? 1.0 : 0) };
  const r = Y.simule(Y.parametreler(oku('ok')), { hiz: 7, aci: 0, x0: 0.5, y0: 0.6 }, sahne);
  assert.ok(r.olaylar.some(e => e.tur === 'duvar'), 'sahanlık kenarı duvar gibi');
  for (const o of r.ornekler) if (o.x >= 3 && o.x <= 6) assert.ok(o.y >= 1 - 1e-9 || o.y < 0.99, 'ışınlanma yok');
});

test('kroki yolu iniş noktasını içerir ve sınırı aşmaz', () => {
  for (const [h, a] of [[5, 5], [8, 30], [3, 60]]) {
    const r = ucus('marti', {}, h, a, Y.SAHNE_ACIK);
    assert.ok(r.yol.length <= Y.YOL_NOKTASI);
    const son = r.ornekler[r.ornekler.length - 1];
    assert.deepEqual(r.yol[r.yol.length - 1], [+son.x.toFixed(2), +son.z.toFixed(2)]);
  }
});

test('planör dalgalanarak süzülür: yükseldikten sonra dalar, sonra yatıp uzun süzülür', () => {
  const r = Y.simule(Y.parametreler(oku('marti')), { hiz: 9, aci: 10, x0: 0.5, y0: 4 }, Y.SAHNE_ACIK);
  const y = r.ornekler.map(o => o.y);
  const tepe = y.indexOf(Math.max(...y));
  assert.ok(Math.max(...y) > 5, 'tırmanır');
  // tepeden sonra en hızlı iniş, son bölümdeki inişten belirgin dik (dalış → süzülüş)
  const egim = (i, j) => (y[j] - y[i]) / ((j - i) / 60);
  const dalis = egim(tepe + 30, tepe + 60), suzulus = egim(tepe + 120, tepe + 150);
  assert.ok(dalis < suzulus * 2, `dalış ${dalis}, süzülüş ${suzulus}`);
});

test('yan duvara sürtünme tek kırışık: ardışık temas olayları bir sayılır', async () => {
  const { temasSayisi } = await import('../engine/physics.js');
  const surtunme = Array.from({ length: 120 }, (_, i) => ({ tur: 'yanDuvar', t: 1 + i / 120 }));
  assert.equal(temasSayisi(surtunme), 1);
  assert.equal(temasSayisi([{ tur: 'duvar', t: 1 }, { tur: 'yanDuvar', t: 1.05 }, { tur: 'yanDuvar', t: 2 }, { tur: 'indi', t: 2.2 }]), 3);
  assert.equal(temasSayisi([{ tur: 'tavan', t: 1 }, { tur: 'indi', t: 2 }]), 0);
});
