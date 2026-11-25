// Hangar deposu: localStorage'da sürümlü tek kayıt. Tarayıcıda localStorage, testte sahte depo verilir.
// Okuma hatası ya da bilinmeyen sürüm veriyi SİLMEZ: bellekte boş hangarla çalışılır, kayıtlı veri dokunulmadan kalır.
import { TASARIM_SURUMLERI } from './engine/tasarim.js';
import { SAHNE_IDLERI } from './engine/sahneler.js';
import { isimStiliDuzelt } from './engine/murekkep.js';

export const ANAHTAR = 'kagithangar.v1';
export const SURUM = 1;
const GUNLUK_SINIRI = 50, YOL_SINIRI = 60;

export const varsayilanAyar = () => ({ kanatcik: 0, kivrimSol: 0, kivrimSag: 0, atac: 0 });
const varsayilanAyarlar = () => ({ sessiz: false, sonSahne: 'sinif', sonMod: 'izle', ipuclari: {}, gununBasari: 0 });
const bos = () => ({ surum: SURUM, ucaklar: [], ayarlar: varsayilanAyarlar() });

// Ayarlar: eksikler varsayılanla dolar, bilinen alanlar sınırlanır; bilinmeyenler olduğu gibi kalır.
export function ayarDuzelt(a) {
  const v = { ...varsayilanAyarlar(), ...(a && typeof a === 'object' ? a : {}) };
  if (!SAHNE_IDLERI.includes(v.sonSahne)) v.sonSahne = 'sinif';
  if (v.sonMod !== 'elle' && v.sonMod !== 'izle') v.sonMod = 'izle';
  v.gununBasari = Math.max(0, Math.floor(Number(v.gununBasari) || 0));
  v.ipuclari = v.ipuclari && typeof v.ipuclari === 'object' ? { ...v.ipuclari } : {};
  if (v.pilotAdi != null) v.pilotAdi = String(v.pilotAdi).slice(0, 24);
  return v;
}

export function kimlik() {
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const tasarimSurumu = (tasarim) => TASARIM_SURUMLERI[tasarim] ?? 1;

// Yeni uçak kaydı (katlama bitince oluşturulur). ayar: tasarımın varsayılan ayarı (ör. Taklacı'da kanatçık yukarı).
export function yeniUcak({ tasarim, kalite, mod, hassasiyetler, ayar }) {
  return {
    id: kimlik(), tasarim, tasarimSurumu: tasarimSurumu(tasarim), ad: '', tarih: new Date().toISOString(),
    kalite, mod, hassasiyetler: hassasiyetler || [],
    boya: { cizgiler: [] }, ayar: { ...varsayilanAyar(), ...(ayar || {}) },
    yipranma: { kirisik: 0, utu: 0 }, emekli: false,
    istatistik: { ucus: 0, enUzak: 0, enUzun: 0, enYuksek: 0, loop: 0, duvar: 0, pencere: 0, sahneler: {} },
    gunluk: [],
  };
}

// Eksik alanları tamamla, tipleri sınırla (eski ya da elle düzenlenmiş kayıtlar için).
function ucakDuzelt(u) {
  if (!u || typeof u !== 'object' || typeof u.id !== 'string' || typeof u.tasarim !== 'string') return null;
  const temel = yeniUcak({ tasarim: u.tasarim, kalite: 85, mod: 'izle' });
  const v = { ...temel, ...u, id: u.id };
  v.ad = typeof v.ad === 'string' ? v.ad.slice(0, 24) : '';
  v.kalite = Math.max(0, Math.min(100, Number(v.kalite) || 0));
  v.ayar = { ...varsayilanAyar(), ...(u.ayar || {}) };
  v.boya = { cizgiler: Array.isArray(u.boya && u.boya.cizgiler) ? u.boya.cizgiler : [] };
  v.yipranma = { ...temel.yipranma, ...(u.yipranma || {}) };
  v.istatistik = { ...temel.istatistik, ...(u.istatistik || {}) };
  v.gunluk = Array.isArray(u.gunluk) ? u.gunluk.slice(-GUNLUK_SINIRI) : [];
  // dijital ikiz: gerçekte atılan mesafeler (elle girilir)
  v.gercek = (Array.isArray(u.gercek) ? u.gercek : [])
    .filter(g => g && Number.isFinite(g.mesafe) && g.mesafe > 0 && g.mesafe <= 100)
    .map(g => ({ tarih: String(g.tarih || '').slice(0, 30), mesafe: Math.round(g.mesafe * 10) / 10 })).slice(-GUNLUK_SINIRI);
  // notla gelen uçak: notun kendisi
  v.not = u.not && typeof u.not.metin === 'string'
    ? { metin: u.not.metin.slice(0, 280), gonderen: String(u.not.gonderen || '').slice(0, 24), tarih: String(u.not.tarih || '').slice(0, 30) }
    : null;
  v.kaynak = typeof u.kaynak === 'string' ? u.kaynak.slice(0, 64) : null;
  v.isimStili = isimStiliDuzelt(u.isimStili);               // kanattaki ismin rengi, boyutu, biçimi
  // Kalıbı değişen tasarım: boya eski katların koordinatına bağlı, yeni kalıba oturmaz. Silinmez, eskiBoya'da
  // saklanır; uçak yeni kalıpla görünür ve fişinde not çıkar (eskiModel). Uçuşlar, rekorlar, isim kalır.
  const guncel = tasarimSurumu(v.tasarim);
  v.tasarimSurumu = Number.isInteger(u.tasarimSurumu) ? u.tasarimSurumu : 1;
  v.eskiBoya = u.eskiBoya && Array.isArray(u.eskiBoya.cizgiler) ? { surum: u.eskiBoya.surum ?? 1, cizgiler: u.eskiBoya.cizgiler } : null;
  v.eskiModel = !!u.eskiModel;
  if (v.tasarimSurumu !== guncel) {
    if (v.boya.cizgiler.length) v.eskiBoya = { surum: v.tasarimSurumu, cizgiler: v.boya.cizgiler };
    v.boya = { cizgiler: [] };
    v.eskiModel = true;
    v.tasarimSurumu = guncel;
  }
  return v;
}

export function cozumle(metin) {
  const veri = JSON.parse(metin);
  if (!veri || veri.surum !== SURUM || !Array.isArray(veri.ucaklar)) throw new Error('tanınmayan hangar dosyası');
  return { ...bos(), ...veri, ayarlar: ayarDuzelt(veri.ayarlar), ucaklar: veri.ucaklar.map(ucakDuzelt).filter(Boolean) };
}

export function depoOlustur(saklama) {
  let veri = bos();
  let yazilabilir = true;
  try {
    const metin = saklama && saklama.getItem(ANAHTAR);
    if (metin) veri = cozumle(metin);
  } catch (e) {
    yazilabilir = false;                                  // bozuk/yeni sürüm kayıt: üstüne yazma
  }
  const yaz = () => {
    if (!yazilabilir) return false;
    try { saklama && saklama.setItem(ANAHTAR, JSON.stringify(veri)); return true; } catch (e) { return false; }
  };
  const bul = (id) => veri.ucaklar.find(u => u.id === id) || null;

  return {
    get yazilabilir() { return yazilabilir; },
    ucaklar: () => veri.ucaklar.slice(),
    ucak: (id) => { const u = bul(id); return u ? structuredClone(u) : null; },
    ucakEkle(u) { veri.ucaklar.push(ucakDuzelt(u)); yaz(); return u.id; },
    ucakGuncelle(id, yama) {
      const i = veri.ucaklar.findIndex(u => u.id === id);
      if (i < 0) return null;
      veri.ucaklar[i] = ucakDuzelt({ ...veri.ucaklar[i], ...yama, id });
      yaz();
      return structuredClone(veri.ucaklar[i]);
    },
    ucakSil(id) { veri.ucaklar = veri.ucaklar.filter(u => u.id !== id); yaz(); },
    // Uçuş fişi günlüğe (Faz 5).
    ucusEkle(id, fis) {
      const u = bul(id);
      if (!u) return null;
      u.gunluk.push({ ...fis, yol: (fis.yol || []).slice(0, YOL_SINIRI) });
      u.gunluk = u.gunluk.slice(-GUNLUK_SINIRI);
      yaz();
      return structuredClone(u);
    },
    ayarlar: () => ({ ...veri.ayarlar }),
    ayarGuncelle(yama) { veri.ayarlar = ayarDuzelt({ ...veri.ayarlar, ...yama }); yaz(); return { ...veri.ayarlar }; },
    // Dijital ikiz: gerçek bir atışın mesafesi (m).
    gercekEkle(id, mesafe) {
      const u = bul(id);
      if (!u || !Number.isFinite(mesafe) || mesafe <= 0 || mesafe > 100) return null;
      return this.ucakGuncelle(id, { gercek: [...(u.gercek || []), { tarih: new Date().toISOString(), mesafe }] });
    },
    yedekle: () => JSON.stringify(veri, null, 1),
    geriYukle(metin, { birlestir = false } = {}) {
      const gelen = cozumle(metin);
      if (birlestir) {
        const var_ = new Set(veri.ucaklar.map(u => u.id));
        veri.ucaklar.push(...gelen.ucaklar.filter(u => !var_.has(u.id)));
      } else veri = gelen;
      yazilabilir = true;
      yaz();
      return veri.ucaklar.length;
    },
    // Her şeyi sil: bütün uçaklar, günlükler, rekorlar ve ayarlar. Kullanıcının açık isteğiyle çağrılır; kayıt
    // okunamıyor olsa bile (bilinmeyen sürüm, bozuk) üstüne boş hangar yazılır.
    sifirla() {
      veri = bos();
      yazilabilir = true;
      return yaz();
    },
  };
}

// Tarayıcıdaki tek depo. Safari'de localStorage atabilir: o zaman yalnız bellekte çalışır.
let tarayiciDeposu = null;
export function depo() {
  if (!tarayiciDeposu) {
    let s = null;
    try { s = window.localStorage; s.getItem(ANAHTAR); } catch (e) { s = null; }
    tarayiciDeposu = depoOlustur(s);
  }
  return tarayiciDeposu;
}
