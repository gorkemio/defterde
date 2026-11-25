// Tasarım JSON şeması: doğrulama ve liste. DOM'suz (yükleme UI'da fetch, testte fs ile).
export const TASARIM_IDLERI = ['ok', 'kilit', 'buldog', 'marti', 'taklaci', 'yarasa'];
// Katlama dizisi değişen tasarımların sürümü. Eski sürümle katlanmış uçağın boyası yeni kalıba oturmaz (depo göçü).
// 2 (18 Eki 2026): altısı da kaynaklarla karşılaştırılıp yeniden katlandı (açılı dart kanatları, Suzanne, Loop Plane,
// Underside Plane).
export const TASARIM_SURUMLERI = { ok: 2, kilit: 2, buldog: 2, marti: 2, taklaci: 2, yarasa: 2 };
export const TURLER = { mesafe: 'Mesafe', suzulme: 'Süzülme', akrobasi: 'Akrobasi' };

const nokta = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

// Hata listesi döndürür; boş liste = geçerli.
export function dogrula(t) {
  const h = [];
  if (!t || typeof t !== 'object') return ['tasarım nesne değil'];
  for (const k of ['id', 'ad', 'orijinalAd', 'aciklama']) if (typeof t[k] !== 'string' || !t[k]) h.push(`${k} eksik`);
  if (![1, 2, 3].includes(t.zorluk)) h.push('zorluk 1–3 olmalı');
  if (!(t.tur in TURLER)) h.push('tur mesafe/suzulme/akrobasi olmalı');
  for (const k of ['hiz', 'suzulme', 'denge', 'akrobasi']) {
    const v = t.karakter && t.karakter[k];
    if (!Number.isInteger(v) || v < 1 || v > 10) h.push(`karakter.${k} 1–10 olmalı`);
  }
  if (t.kagit != null) {
    const { en, boy } = t.kagit;
    if (!(en > 0 && boy > 0 && Number.isFinite(en) && Number.isFinite(boy))) h.push('kagit {en, boy} pozitif olmalı');
  }
  if (t.surum != null && !(Number.isInteger(t.surum) && t.surum >= 1)) h.push('surum pozitif tamsayı olmalı');
  if (t.kaynak != null && (typeof t.kaynak !== 'string' || !t.kaynak)) h.push('kaynak metin olmalı');
  if (t.varsayilanAyar != null) {
    const a = t.varsayilanAyar;
    const sinir = { kanatcik: 2, kivrimSol: 1, kivrimSag: 1, atac: 2 };
    for (const [k, v] of Object.entries(a)) {
      if (!(k in sinir)) h.push(`varsayilanAyar.${k} tanımsız`);
      else if (!Number.isInteger(v) || Math.abs(v) > sinir[k] || (k === 'atac' && v < 0)) h.push(`varsayilanAyar.${k} aralık dışı`);
    }
  }
  if (!Array.isArray(t.adimlar) || !t.adimlar.length) { h.push('adimlar boş'); return h; }
  t.adimlar.forEach((a, i) => {
    const n = `adım ${i + 1}`;
    if (typeof a.metin !== 'string' || !a.metin) h.push(`${n}: metin eksik`);
    if (a.tip === 'cevir') return;
    if (a.tip !== 'vadi' && a.tip !== 'dag') { h.push(`${n}: tip vadi/dag/cevir olmalı`); return; }
    const c = a.cizgi;
    const cizgiOk = (Array.isArray(c) && c.length === 2 && c.every(nokta)) || (c && nokta(c.nokta) && nokta(c.hedef));
    if (!cizgiOk) h.push(`${n}: cizgi iki nokta ya da {nokta, hedef} olmalı`);
    if (a.tut != null && !nokta(a.tut)) h.push(`${n}: tut [x, y] olmalı`);
    if (a.tut == null && !(c && c.nokta)) h.push(`${n}: tut eksik`);
    if (a.katman != null && a.katman !== 'hepsi' && a.katman !== 'ust') h.push(`${n}: katman hepsi/ust olmalı`);
    if (a.kanat != null && a.kanat !== 'sol' && a.kanat !== 'sag') h.push(`${n}: kanat sol/sag olmalı`);
    if (a.poz != null && !(a.poz >= 0 && a.poz <= 180)) h.push(`${n}: poz 0–180 olmalı`);
  });
  return h;
}
