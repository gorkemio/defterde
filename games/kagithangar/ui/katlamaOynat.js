// Bütün katlama dizisini hızlıca ileri (katla) ya da geri (aç) oynatır. Notla gönder/al sayfaları kullanır.
// Geri oynatma motorun tersine çalışmasıdır: her hareket 180°'den 0°'a.
import { hazirla } from '../engine/fold.js';
import { katlanis } from '../engine/poz.js';
import { durumCiz, kareCiz } from './ucakCiz.js';
import { satirlara } from '../engine/not.js';

const egri = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

function oynat(sure, kare, gecerli) {
  const KL = window.Kit.kalem;
  return new Promise((bitir) => {
    if (!KL.animasyonVar()) { kare(1); bitir(); return; }
    const t0 = performance.now();
    const tik = (simdi) => {
      if (gecerli && !gecerli()) { bitir(); return; }
      const u = Math.min(1, (simdi - t0) / sure);
      kare(egri(u));
      if (u < 1) requestAnimationFrame(tik); else bitir();
    };
    requestAnimationFrame(tik);
  });
}

async function hareket(g, katlama, h, yon, o) {
  const S = o.olcek, KL = window.Kit.kalem;
  const once = katlama.anlar[h.no], sonra = katlama.anlar[h.no + 1];
  if (h.ac) return;                                      // ön kırışık: hızlı oynatmada atlanır
  if (h.tip === 'cevir') {
    await oynat(o.sure * 1.1, (e) => {
      const u = yon > 0 ? e : 1 - e;
      g.textContent = '';
      const k = Math.cos(Math.PI * u);
      const orta = katlama.kagit.en / 2 * S;
      const ic = KL.svgEl('g', { transform: `translate(${orta} 0) scale(${Math.max(0.02, Math.abs(k)).toFixed(3)} 1) translate(${-orta} 0)` }, g);
      durumCiz(ic, u < 0.5 ? once : sonra, { olcek: S });
    }, o.gecerli);
    return;
  }
  const hz = hazirla(once, h);
  await oynat(o.sure, (e) => { g.textContent = ''; kareCiz(g, katlanis(hz, 180 * (yon > 0 ? e : 1 - e)), { olcek: S }); }, o.gecerli);
}

export async function hepsiniKatla(g, katlama, o) {
  for (const h of katlama.hareketler) { await hareket(g, katlama, h, 1, o); if (o.gecerli && !o.gecerli()) return; }
  g.textContent = '';
  durumCiz(g, katlama.son, { olcek: o.olcek });
}

export async function hepsiniAc(g, katlama, o) {
  for (const h of [...katlama.hareketler].reverse()) { await hareket(g, katlama, h, -1, o); if (o.gecerli && !o.gecerli()) return; }
  g.textContent = '';
  durumCiz(g, katlama.anlar[0], { olcek: o.olcek });
}

// Düz kağıdın ön yüzüne el yazısı not (kağıt koordinatı × S). Sahibinin mürekkebi: mavi tükenmez.
// o.kagit: { en, boy } — yatay kağıtta satırlar daha uzun, satır sayısı daha az.
export const NOT_DUZENI = {
  dikey: { genislik: 20, satir: 14, ust: 0.34, ara: 0.082, boyut: 0.066 },
  yatay: { genislik: 30, satir: 10, ust: 0.2, ara: 0.07, boyut: 0.058 },
};
export function notuYaz(g, metin, S, o = {}) {
  const KL = window.Kit.kalem;
  const kagit = o.kagit || { en: 1, boy: 1.414 };
  const d = kagit.en > kagit.boy ? NOT_DUZENI.yatay : NOT_DUZENI.dikey;
  const satirlar = satirlara(metin, d.genislik).slice(0, d.satir);
  satirlar.forEach((s, i) => {
    KL.metinSvg(g, s, { x: 0.1 * S, y: (d.ust + i * d.ara) * S, boyut: d.boyut * S, hiza: 'start', renk: 'mavi', tohum: ['not', i, s], gecikme: (o.gecikme || 0) + i * 120, anlik: o.anlik });
  });
  if (o.imza) KL.metinSvg(g, `— ${o.imza}`, { x: (kagit.en - 0.14) * S, y: (d.ust + (satirlar.length + 0.8) * d.ara) * S, boyut: 0.046 * S, hiza: 'end', renk: 'mavi', aci: -3, anlik: o.anlik, gecikme: (o.gecikme || 0) + satirlar.length * 120 });
}
