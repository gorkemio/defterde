// Faz C: yatay kağıt, gerçek tasarımlar, kalıp sürümü göçü.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../engine/fold.js';
import * as P from '../engine/poz.js';
import * as G from '../engine/geom.js';
import { dogrula, TASARIM_IDLERI, TASARIM_SURUMLERI } from '../engine/tasarim.js';
import { boyaDeseni } from '../engine/baski.js';
import { notPaketle, notCoz } from '../engine/not.js';
import { depoOlustur, yeniUcak, ANAHTAR, SURUM } from '../depo.js';

const yakin = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const oku = (id) => JSON.parse(fs.readFileSync(new URL(`../tasarimlar/${id}.json`, import.meta.url), 'utf8'));
const YATAY = { en: Math.SQRT2, boy: 1 };

test('yatay kağıt: başlangıç yaprağı, çevir orta çizgiye göre, iki kez çevir = özdeşlik', () => {
  const d = F.baslangic(YATAY);
  yakin(F.alanToplami(d), Math.SQRT2);
  assert.deepEqual(F.kutu(d), [0, 0, Math.SQRT2, 1]);
  const c = F.cevir(d);
  assert.deepEqual(F.kutu(c).map(v => +v.toFixed(12)), [0, 0, +Math.SQRT2.toFixed(12), 1]);
  const cc = F.cevir(c);
  cc.poligonlar[0].noktalar.forEach((q, i) => { yakin(q[0], d.poligonlar[0].noktalar[i][0]); yakin(q[1], d.poligonlar[0].noktalar[i][1]); });
  assert.deepEqual(cc.kagit, YATAY);
});

test('ayna adımı yatay kağıdın orta çizgisine göre yansır', () => {
  const t = { kagit: YATAY, adimlar: [{ tip: 'vadi', cizgi: { nokta: [0, 0], hedef: [0.5, 0.5] }, katman: 'hepsi', ayna: true, metin: 'x' }] };
  const h = F.hareketleriAc(t);
  yakin(h[1].tut[0], Math.SQRT2 - h[0].tut[0]);
  const r = F.uygula(t);
  const k = F.kutu(r.son);
  yakin(k[0] + k[2], Math.SQRT2, 1e-9);                       // iki köşe katı simetrik
});

test('tasarım kutusu ara durumları ve hedefleri kapsar (Suzanne\'ın köşesi kağıdın altına iner)', () => {
  const r = F.uygula(oku('marti'));
  const k = F.tasarimKutusu(r);
  assert.ok(k[3] >= Math.SQRT2 - 1e-3, `alt sınır ${k[3]}`);
  for (const h of r.hareketler) if (h.tip !== 'cevir') {
    const q = F.hedef(h);
    assert.ok(q[0] >= k[0] - 1e-9 && q[0] <= k[2] + 1e-9 && q[1] >= k[1] - 1e-9 && q[1] <= k[3] + 1e-9);
  }
});

test('gerçek tasarımlar: kaynak, sürüm ve kağıt yönü', () => {
  const yatay = { marti: 'Suzanne', taklaci: 'Loop Plane', yarasa: 'Underside Plane' };
  for (const id of TASARIM_IDLERI) {
    const t = oku(id);
    assert.ok(t.kaynak && t.kaynak.length > 3, `${id} kaynak`);
    assert.equal(t.surum, TASARIM_SURUMLERI[id], `${id} sürüm`);
    if (yatay[id]) { assert.equal(t.orijinalAd, yatay[id]); assert.ok(t.kagit.en > t.kagit.boy, `${id} yatay`); }
    else assert.equal(t.kagit, undefined, `${id} dikey A4`);
  }
  assert.deepEqual(oku('taklaci').varsayilanAyar, { kanatcik: 1 });
});

test('şema: kagit, surum, varsayilanAyar doğrulanır', () => {
  const t = oku('ok');
  assert.ok(dogrula({ ...t, kagit: { en: 0, boy: 1 } }).some(h => h.includes('kagit')));
  assert.ok(dogrula({ ...t, surum: 0 }).some(h => h.includes('surum')));
  assert.ok(dogrula({ ...t, varsayilanAyar: { kanatcik: 3 } }).some(h => h.includes('kanatcik')));
  assert.ok(dogrula({ ...t, varsayilanAyar: { roket: 1 } }).some(h => h.includes('roket')));
  assert.deepEqual(dogrula({ ...t, varsayilanAyar: { kanatcik: -2, atac: 1 } }), []);
});

test('kiriş hizası: açılı menteşeli Suzanne\'da kanatlar yatay, omurga kuyruğa doğru iner', () => {
  const r = F.uygula(oku('marti'));
  const m = P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler)));
  yakin(P.dihedralOlc(m, 'sol'), 0, 1e-6);
  yakin(P.dihedralOlc(m, 'sag'), 0, 1e-6);
  const [on, arka] = ucDerinlik(m);
  assert.ok(arka > on + 0.05, `omurga kuyrukta daha derin (${arka} / ${on})`);
});

// Gövdenin ön ve arka üçte birindeki en derin nokta (omurga derinliği).
function ucDerinlik(m) {
  const govde = m.parcalar.filter(p => !p.kanat).flatMap(p => p.noktalar3);
  const xs = govde.map(q => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), L = x1 - x0;
  const derin = (a, b) => -Math.min(...govde.filter(q => q[0] >= a && q[0] <= b).map(q => q[2]));
  return [derin(x1 - L / 3, x1), derin(x0, x0 + L / 3)];
}

test('dart ailesi: gövde burunda sığ, kuyrukta derin (kanat üst kenarı gövdenin altına)', () => {
  for (const id of ['ok', 'kilit', 'buldog']) {
    const r = F.uygula(oku(id));
    const m = P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler)));
    const [on, arka] = ucDerinlik(m);
    assert.ok(arka > on + 0.05, `${id}: kuyruk ${arka} burun ${on}`);
  }
});

test('baskı deseni: yatay kağıtta arka yüz x → en − x', () => {
  const r = F.uygula(oku('taklaci'));
  const d = boyaDeseni(r.son, null, [{ duz: true, yuz: 'arka', renk: 'mavi', noktalar: [[0.2, 0.3]] }]);
  yakin(d.arka[0].noktalar[0][0], r.kagit.en - 0.2, 1e-12);
});

const sahteDepo = (veri) => {
  const m = new Map(veri ? [[ANAHTAR, JSON.stringify(veri)]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m };
};

test('göç: eski kalıplı uçağın boyası silinmez, eskiBoya\'ya taşınır; uçuşları kalır', () => {
  const eski = {
    id: 'u_eski', tasarim: 'marti', ad: 'Sessiz', kalite: 80, mod: 'elle',
    boya: { cizgiler: [{ renk: 'mavi', kanat: 'sag', noktalar: [[0.5, 1, 3, 0.1, 0.2]] }] },
    istatistik: { ucus: 4, enUzak: 9.5 }, gunluk: [{ mesafe: 9.5 }],
  };
  const s = sahteDepo({ surum: SURUM, ucaklar: [eski], ayarlar: {} });
  const D = depoOlustur(s);
  const u = D.ucak('u_eski');
  assert.equal(u.tasarimSurumu, TASARIM_SURUMLERI.marti);
  assert.equal(u.eskiModel, true);
  assert.deepEqual(u.boya.cizgiler, []);
  assert.equal(u.eskiBoya.cizgiler.length, 1);
  assert.equal(u.eskiBoya.surum, 1);
  assert.equal(u.istatistik.enUzak, 9.5);
  assert.equal(u.ad, 'Sessiz');
  // yeniden boyayınca not kalkar, eski boya yine saklı
  const g = D.ucakGuncelle('u_eski', { boya: { cizgiler: [] }, eskiModel: false });
  assert.equal(g.eskiModel, false);
  assert.equal(g.eskiBoya.cizgiler.length, 1);
  // güncel sürümle katlanmış uçağa dokunulmaz
  const yeni = yeniUcak({ tasarim: 'taklaci', kalite: 90, mod: 'izle', ayar: oku('taklaci').varsayilanAyar });
  assert.equal(yeni.tasarimSurumu, TASARIM_SURUMLERI.taklaci);
  assert.equal(yeni.ayar.kanatcik, 1);
  D.ucakEkle(yeni);
  assert.equal(D.ucak(yeni.id).eskiModel, false);
});

test('not paketi: eski kalıplı boyası alıcıda atılır, güncel kalıbınki gelir', () => {
  const ucak = { tasarim: 'ok', ad: 'x', kalite: 80, boya: { cizgiler: [{ renk: 'mavi', kanat: 'sag', noktalar: [[0.6, 1]] }] } };
  const guncel = notCoz(JSON.parse(JSON.stringify(notPaketle({ ...ucak, tasarimSurumu: TASARIM_SURUMLERI.ok }, 'selam'))));
  assert.equal(guncel.eskiKalip, false);
  assert.equal(guncel.cizgiler.length, 1);
  const p = notPaketle({ ...ucak, tasarimSurumu: 1 }, 'selam');
  const eski = notCoz(JSON.parse(JSON.stringify(p)));
  assert.equal(eski.eskiKalip, true);
  assert.deepEqual(eski.cizgiler, []);
  const surumsuz = { ...p };
  delete surumsuz.v;
  assert.equal(notCoz(surumsuz).eskiKalip, true);              // eski bağlantılar (sürümsüz) eski kalıptır
});

test('kanatçık ve kıvrım açılı kanatta da doğru köşede: firar kenarının dış ucu', () => {
  for (const id of TASARIM_IDLERI) {
    const r = F.uygula(oku(id));
    const m = P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler)));
    const a = P.ayarKatlari(m, { kanatcik: 1 });
    for (const k of ['sol', 'sag']) {
      const flap = a.parcalar.filter(p => p.sanal === 'kanatcik' && p.kanat === k).flatMap(p => p.noktalar3);
      const kanat = m.parcalar.filter(p => p.kanat === k).flatMap(p => p.noktalar3);
      assert.ok(flap.length, `${id} ${k} kanatçık var`);
      const xOrt = (n) => n.reduce((s, q) => s + q[0], 0) / n.length;
      const yOrt = (n) => n.reduce((s, q) => s + Math.abs(q[1]), 0) / n.length;
      assert.ok(xOrt(flap) < xOrt(kanat), `${id} ${k} kanatçık arkada`);
      assert.ok(yOrt(flap) > yOrt(kanat) - 1e-9, `${id} ${k} kanatçık dışta`);
    }
  }
});

test('isim deseni: SVG sırasındaki matris ismin merkezini düz kağıtta aynı noktaya ve kağıdın içine koyar', async () => {
  const { isimDeseni } = await import('../engine/baski.js');
  for (const id of TASARIM_IDLERI) {
    const r = F.uygula(oku(id));
    const m = P.ucusEkseni(P.poz(r.son, P.pozAcilari(r.hareketler, P.gorunumAcilariTam(r.son, r.hareketler))));
    const ana = P.anaDuzlem(m, 'sag');
    const yer = P.isimYeri(P.kanatGeometrisi(m, 'sag'), ana.map(p => p.noktalar2.map(([x, y]) => [x * 100, y * 100])), 'Mavi Şimşek');
    const d = isimDeseni(r.son, m, yer);
    assert.ok(d, `${id} isim yeri`);
    const [a, b, c, e2, e, f] = d.svgMatris;                    // SVG: x' = a·x + c·y + e, y' = b·x + d·y + f
    const q = [a * yer.cx + c * yer.cy + e, b * yer.cx + e2 * yer.cy + f];
    yakin(q[0], d.merkez[0], 1e-9); yakin(q[1], d.merkez[1], 1e-9);
    assert.ok(q[0] >= 0 && q[0] <= r.kagit.en && q[1] >= 0 && q[1] <= r.kagit.boy, `${id} isim kağıtta (${q})`);
  }
});
