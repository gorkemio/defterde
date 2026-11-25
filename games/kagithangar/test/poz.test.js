import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../engine/fold.js';
import * as P from '../engine/poz.js';
import { TASARIM_IDLERI } from '../engine/tasarim.js';

const yakin = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const model = (id) => { const r = F.uygula(oku(id)); return P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler))); };

test('katlanış: θ=0 katlanmamış, θ=180 katlanmış duruma eşit, θ=90 parça menteşeye iner', () => {
  const t = { adimlar: [{ tip: 'vadi', cizgi: [[0.5, 0], [0, 0.5]], katman: 'hepsi', tut: [0, 0], metin: 'x' }] };
  const r = F.uygula(t);
  const hz = F.hazirla(r.anlar[0], r.hareketler[0]);
  const kat0 = P.katlanis(hz, 0).find(p => p.hareketli);
  hz.hareketEdenler[0].noktalar.forEach((q, i) => { yakin(kat0.noktalar[i][0], q[0]); yakin(kat0.noktalar[i][1], q[1]); });
  const kat180 = P.katlanis(hz, 180);
  const sonPoligon = r.son.poligonlar[r.son.poligonlar.length - 1];
  const hedef = F.hedef(r.hareketler[0]);
  assert.ok(kat180[kat180.length - 1].noktalar.some(q => Math.abs(q[0] - hedef[0]) < 1e-9 && Math.abs(q[1] - hedef[1]) < 1e-9));
  assert.equal(kat180[kat180.length - 1].yuz, sonPoligon.yuz);
  const kat90 = P.katlanis(hz, 90).find(p => p.hareketli);
  kat90.noktalar.forEach(q => yakin(q[0] + q[1], 0.5, 1e-9));          // hepsi x + y = 0.5 çizgisinde
});

test('dağ katında hareket eden parça yığının altında çizilir', () => {
  const t = { adimlar: [{ tip: 'dag', cizgi: [[0.5, 0], [0.5, 1.414]], katman: 'hepsi', tut: [1, 1], metin: 'x' }] };
  const r = F.uygula(t);
  const kare = P.katlanis(F.hazirla(r.anlar[0], r.hareketler[0]), 120);
  assert.ok(kare[0].hareketli && !kare[kare.length - 1].hareketli);
});

test('Ok pozu (dart): gövde düzlemde dik, kanatlar yatay, iki kanat ucu simetrik, açıklık gerçek dartınki', () => {
  const m = model('ok');
  const govde = m.parcalar.filter(p => !p.kanat);
  govde.forEach(p => p.noktalar3.forEach(q => { yakin(q[1], 0, 1e-9); assert.ok(q[2] <= 1e-9); }));
  const uc = (k) => Math.max(...m.parcalar.filter(p => p.kanat === k).flatMap(p => p.noktalar3.map(q => Math.abs(q[1]))));
  yakin(uc('sol'), uc('sag'), 1e-9);
  // Basic Dart: kanat üst kenarı gövdenin altına iner → yarı açıklık 0.5·tan(11.25°)·… ≈ 0.255 (foldnfly: 11,1 cm / 21,6 cm)
  yakin(uc('sol'), 0.2549, 1e-3);
  m.parcalar.filter(p => p.kanat).forEach(p => p.noktalar3.forEach(q => yakin(q[2], 0, 1e-9)));
  assert.ok(m.parcalar.filter(p => p.kanat === 'sag').every(p => p.noktalar3.every(q => q[1] <= 1e-9)), 'sağ kanat -Y');
});

test('altı tasarımda kanatlar gövdenin üstünde, sağ kanat sağda; kanat ucu katları yukarı', () => {
  for (const id of TASARIM_IDLERI) {
    const m = model(id);
    const sag = m.parcalar.filter(p => p.kanat === 'sag'), sol = m.parcalar.filter(p => p.kanat === 'sol');
    assert.ok(sag.length && sol.length, id);
    assert.ok(sag.every(p => p.noktalar3.every(q => q[1] <= 1e-9)), `${id} sağ kanat`);
    assert.ok(sol.every(p => p.noktalar3.every(q => q[1] >= -1e-9)), `${id} sol kanat`);
    assert.ok(m.parcalar.every(p => p.noktalar3.every(q => q[2] >= -0.4)), `${id} gövde derinliği`);
    const zEn = Math.max(...m.parcalar.flatMap(p => p.noktalar3.map(q => q[2])));
    if (id === 'taklaci') assert.ok(zEn > 0.03, `${id} uç katları yukarı (${zEn})`);   // Loop Plane: kanat uçları kalkık
    else yakin(zEn, 0, 1e-6);
  }
});

test('kanat ucu kanada bağlı kalır: ortak menteşe köşeleri 3B\'de çakışır', () => {
  const r = F.uygula(oku('taklaci'));
  const m = model('taklaci');
  const sonUc = [...r.hareketler].reverse().find(h => h.poz != null && !h.kanat);
  const noktalar = m.parcalar.flatMap(p => p.noktalar3);
  const uc = m.parcalar.filter(p => p.etiketler.some(e => e === 'h:' + sonUc.no));
  assert.ok(uc.length);
  for (const p of uc) {
    const altta = p.noktalar3.filter(q => Math.abs(q[2]) < 1e-9);
    assert.ok(altta.length >= 2, 'menteşe kenarı kanat düzleminde');
    altta.forEach(q => assert.ok(noktalar.some(r => r !== q && Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2]) < 1e-9)));
  }
});

test('izdüşüm: kamera derinliğine göre sıralı, gölge her parça için', () => {
  const m = model('ok');
  const kam = P.kamera(...P.KAMERALAR.UCUS);
  const iz = P.izdusum(m, kam);
  assert.equal(iz.parcalar.length, m.parcalar.length);
  assert.equal(iz.golge.length, m.parcalar.length);
  const ustten = P.izdusum(m, P.kamera(...P.KAMERALAR.USTTEN));
  const genislik = Math.max(...ustten.parcalar.flatMap(p => p.noktalar.map(q => q[1]))) - Math.min(...ustten.parcalar.flatMap(p => p.noktalar.map(q => q[1])));
  yakin(genislik, 2 * 0.2549, 1e-3);                                // üstten iki kanat da görünür
});

/* ---------------- Faz B: gerçek duruş, katmanlar, çizim sırası ---------------- */

const gorunumModeli = (id, o) => {
  const r = F.uygula(oku(id));
  return P.menteseleriIsaretle(P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler, P.gorunumAcilariTam(r.son, r.hareketler, o)))));
};
const kanatAcisi = (m, k) => P.dihedralOlc(m, k);

test('duruş: altı tasarımda iki kanat aynı dihedral açısıyla yukarı, gövde omurgaya göre simetrik', () => {
  for (const id of TASARIM_IDLERI) {
    const m = gorunumModeli(id);
    yakin(kanatAcisi(m, 'sol'), P.GORUNUM.dihedral, 1e-6);
    yakin(kanatAcisi(m, 'sag'), P.GORUNUM.dihedral, 1e-6);
    const uc = (k) => m.parcalar.filter(p => p.kanat === k).flatMap(p => p.noktalar3).reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a));
    assert.ok(uc('sol')[2] > 0.02 && uc('sag')[2] > 0.02, `${id} kanat uçları yukarıda`);
    yakin(uc('sol')[2], uc('sag')[2], 1e-9);
    const g = m.parcalar.filter(p => !p.kanat).flatMap(p => p.noktalar3.map(q => q[1]));
    yakin(Math.min(...g), -Math.max(...g), 1e-9);
    assert.ok(Math.max(...g) > 1e-3, `${id} V gövde açık`);
  }
  const duz = gorunumModeli('ok', { dihedral: 0, govde: 0 });
  duz.parcalar.filter(p => p.kanat).forEach(p => p.noktalar3.forEach(q => yakin(q[2], 0, 1e-9)));
});

test('kenar türleri: düz yaprakta dört kağıt kenarı; katlı uçakta kat yerleri ve menteşeler', () => {
  const tek = P.poz(F.uygula({ adimlar: [] }).son, {});
  assert.deepEqual(tek.parcalar[0].kenarTurleri, ['kenar', 'kenar', 'kenar', 'kenar']);
  const m = gorunumModeli('ok');
  for (const p of m.parcalar) assert.equal(p.kenarTurleri.length, p.noktalar3.length);
  assert.ok(m.parcalar.some(p => p.kenarTurleri.includes('kat')) && m.parcalar.some(p => p.kenarTurleri.includes('kenar')));
  assert.ok(m.parcalar.filter(p => p.kanat).some(p => p.menteseler.length), 'kanat kökünde menteşe');
  assert.ok(m.parcalar.filter(p => !p.kanat).some(p => p.menteseler.length), 'gövde üstünde menteşe');
});

test('çizim sırası: yakındaki dikey kanat ucu kanattan sonra çizilir (örtülmez)', () => {
  const m = gorunumModeli('taklaci');
  const iz = P.izdusum(m, P.kamera(...P.KAMERALAR.UCUS));
  const ana = new Set(P.anaDuzlem(m, 'sag').map(p => p.id));
  const uclar = new Set(m.parcalar.filter(p => p.kanat === 'sag' && Math.abs(p.M.R[5]) > 0.9).map(p => p.id));
  assert.ok(uclar.size, 'dikey kanat ucu var');
  const sira = iz.parcalar.map(p => p.id);
  const sonAna = Math.max(...sira.map((id, i) => (ana.has(id) ? i : -1)));
  const ilkUc = Math.min(...sira.map((id, i) => (uclar.has(id) ? i : Infinity)));
  assert.ok(ilkUc > sonAna, `kanat ucu (${ilkUc}) kanattan (${sonAna}) sonra`);
});

test('izdüşüm: grup anahtarı konumu da ayırır, katmanlar kalınlık kadar kayar, gölge ışığın tersine düşer', () => {
  const R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  assert.notEqual(P.grupAnahtari({ R, t: [0, 0, 0] }), P.grupAnahtari({ R, t: [0, 0.1, 0] }));
  const m = gorunumModeli('ok');
  const kam = P.kamera(...P.KAMERALAR.UCUS);
  const iz = P.izdusum(m, kam, { zemin: -0.5 });
  assert.equal(iz.golge.length, m.parcalar.length);
  assert.equal(iz.parcalar.length, m.parcalar.length);
  const govde = iz.parcalar.filter(p => !p.kanat);
  const tlar = new Set(govde.map(p => p.M.t.map(v => v.toFixed(6)).join()));
  assert.ok(tlar.size > 1, 'gövde katmanları farklı derinlikte');
  assert.ok(iz.parcalar.some(p => p.ustte) && iz.parcalar.some(p => !p.ustte));
  // tek nokta: zeminin 1 birim üstündeki nokta, ışığın tersine kayarak düşer
  const tekNokta = { parcalar: [{ ...m.parcalar[0], noktalar3: [[0, 0, 0.5], [0.1, 0, 0.5], [0, 0.1, 0.5]] }] };
  const g = P.izdusum(tekNokta, P.kamera(0, 90), { zemin: -0.5 }).golge[0][0];
  const L = P.ISIK;
  yakin(g[0], -L[0] / L[2], 1e-9);
});

test('kamera: perspektifte yakın nokta büyür, ortografikte değişmez', () => {
  const orto = P.kamera(-30, 20), pers = P.kamera(-30, 20, { f: 9 });
  const yakinN = [0, -0.5, 0], uzakN = [0, 0.5, 0], x = [0.3, 0, 0];
  const boy = (k, p) => Math.abs(k([p[0] + x[0], p[1], p[2]]).x - k(p).x);
  yakin(boy(orto, yakinN), boy(orto, uzakN), 1e-12);
  assert.ok(boy(pers, yakinN) > boy(pers, uzakN));
});
