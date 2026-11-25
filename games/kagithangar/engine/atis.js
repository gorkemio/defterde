// Fırlatma jestleri → atış (hız m/s, açı derece). DOM'suz; ekran ölçüsünden bağımsız: hep sahnenin
// piksel/metre oranıyla (ppm) normalize edilir, böylece telefonda da büyük ekranda da aynı el hareketi aynı atış.
import { atis as sinirla, simule } from './physics.js';

export const EN_AZ = 3, EN_COK = 12;
export const CEKME_TAM = 1.2;            // fare: 1,2 m geri çekmek tam güç
export const SAVURMA_EN_AZ = 1.5, SAVURMA_ARALIK = 10;    // dokunma: parmak hızı (sahne m/s) → güç; ~15 m/s tam güç
const DER = 180 / Math.PI;
const sinir = (v, a, b) => Math.min(b, Math.max(a, v));

// Fare/kalem: basılan noktadan geri çekip bırak. bas/son: ekran px; dönüş null (çok kısa) ya da atış + çekme (0..1).
export function fareAtisi(bas, son, ppm) {
  const dx = bas[0] - son[0], dy = bas[1] - son[1];
  const L = Math.hypot(dx, dy);
  if (L < 6) return null;
  const cekme = sinir(L / (CEKME_TAM * ppm), 0, 1);
  return { ...sinirla(EN_AZ + (EN_COK - EN_AZ) * cekme, Math.atan2(-dy, dx) * DER), cekme, L };   // ekranda y aşağı
}

// Dokunma: parmağı ileri savur. gecmis: [{ p: [x, y], t: ms }] (son ~140 ms). Dönüş null (çok yavaş) ya da atış.
export function dokunmaAtisi(gecmis, ppm) {
  if (!gecmis || gecmis.length < 2) return null;
  const a = gecmis[0], b = gecmis[gecmis.length - 1];
  const sure = Math.max(0.016, (b.t - a.t) / 1000);
  const vx = (b.p[0] - a.p[0]) / sure, vy = (b.p[1] - a.p[1]) / sure;
  const v = Math.hypot(vx, vy) / ppm;                      // parmak hızı, sahne m/s
  if (v < SAVURMA_EN_AZ * 0.6) return null;
  const guc = sinir((v - SAVURMA_EN_AZ) / SAVURMA_ARALIK, 0, 1);
  return { ...sinirla(EN_AZ + (EN_COK - EN_AZ) * guc, Math.atan2(-vy, vx) * DER), cekme: guc };
}

// Dokunmada nişan (parmak sürüklenirken, bırakmadan önce): yön parmağın gittiği yön.
export function dokunmaNisani(bas, son, ppm) {
  const dx = son[0] - bas[0], dy = son[1] - bas[1];
  const L = Math.hypot(dx, dy);
  if (L < 6) return null;
  return { aci: sinir(Math.atan2(-dy, dx) * DER, -20, 80), cekme: sinir(L / (CEKME_TAM * ppm), 0, 1), L };
}

// Klavye: boşluk basılı tutuldukça güç 3 → 12 → 3 (1,2 s'de bir tur).
export const klavyeGucu = (ms) => EN_AZ + (EN_COK - EN_AZ) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ms / 1200));

// Kurşun kalem tahmin yayı: yalnız ilk ~0,35 s (tam yörünge değil; nişan yardımı, hile değil).
export function onizleme(P, atis, sahne, sure = 0.35) {
  const r = simule(P, atis, sahne, { enUzunSure: sure });
  return r.ornekler.filter((_, i) => i % 2 === 0).map(o => [o.x, o.y]);
}

// "Aynı atışı tekrarla" için kayıttaki atış.
export const tekrarAtisi = (sonuc) => (sonuc && sonuc.atis ? sinirla(sonuc.atis.hiz, sonuc.atis.aci) : null);

/* ---------- ince ayar ---------- */

// Fareyle çekerken Shift basılıysa hareketin yalnız INCE_ORAN'ı işlenir: açı ve güç ince ayarlanır.
// Noktayı adım adım biriktirir; Shift bırakılınca sıçrama olmaz. efektif: şu ana dek işlenmiş nokta.
export const INCE_ORAN = 0.25;
export function efektifNokta(efektif, onceki, yeni, ince) {
  const k = ince ? INCE_ORAN : 1;
  return [efektif[0] + (yeni[0] - onceki[0]) * k, efektif[1] + (yeni[1] - onceki[1]) * k];
}

// Klavye: ↑/↓ açı, ←/→ güç; Shift ile daha küçük adım. Değerler sınırlanır ve yuvarlama gürültüsü temizlenir.
export const KLAVYE = { aciAdim: 1, aciInce: 0.25, gucAdim: 0.25, gucInce: 0.05, gucBaslangic: 7 };
export function klavyeAyari({ aci, hiz }, tus, ince = false) {
  const yuvarla = (v) => Math.round(v * 100) / 100;
  const da = ince ? KLAVYE.aciInce : KLAVYE.aciAdim, dh = ince ? KLAVYE.gucInce : KLAVYE.gucAdim;
  if (tus === 'ArrowUp') aci += da;
  else if (tus === 'ArrowDown') aci -= da;
  else if (tus === 'ArrowRight') hiz += dh;
  else if (tus === 'ArrowLeft') hiz -= dh;
  else return null;
  return { aci: yuvarla(sinir(aci, -20, 80)), hiz: yuvarla(sinir(hiz, EN_AZ, EN_COK)) };
}
