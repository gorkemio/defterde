// "Notla gönder" paketi: uçak + not, bağlantıya sığacak kadar küçük. Sıkıştırma (lz-string) çağıranın işi;
// burada yalnız paketleme ve gelen paketin sıkı doğrulaması var (bağlantıdan gelen veri güvenilmez). DOM'suz.
import { TASARIM_IDLERI, TASARIM_SURUMLERI } from './tasarim.js';
import { UCLAR, UC_SIRASI, ucBul, isimStiliDuzelt, ISIM_RENKLERI, ISIM_BOYUTLARI, ISIM_BICIMLERI } from './murekkep.js';

export const NOT_SINIRI = 280, AD_SINIRI = 24, NOKTA_SINIRI = 900;
const RENKLER = ['mavi', 'kirmizi', 'yesil'];
const KANATLAR = ['sol', 'sag'];
const sinir = (v, a, b) => Math.min(b, Math.max(a, v));
const yuvarla = (v) => Math.round(v * 1000) / 1000;

export function notPaketle(ucak, metin, gonderen = '') {
  let kalan = NOKTA_SINIRI;
  const b = [];
  for (const cz of (ucak.boya && ucak.boya.cizgiler) || []) {
    if (kalan <= 0) break;
    const n = cz.noktalar.slice(0, kalan);
    kalan -= n.length;
    const yer = cz.duz ? (cz.yuz === 'arka' ? 3 : 2) : Math.max(0, KANATLAR.indexOf(cz.kanat));   // 2/3: düz kağıt ön/arka
    const c = [RENKLER.indexOf(cz.renk) >= 0 ? RENKLER.indexOf(cz.renk) : 0, yer, n.flatMap(q => [yuvarla(q[0]), yuvarla(q[1])])];
    const uc = UC_SIRASI.indexOf(ucBul(cz));
    if (uc > 0) c.push(uc);                                   // ince uç varsayılan: eski paketlerle aynı biçim
    b.push(c);
  }
  const a = ucak.ayar || {};
  const st = isimStiliDuzelt(ucak.isimStili);
  const BOY = Object.keys(ISIM_BOYUTLARI);
  return {
    i: [ISIM_RENKLERI.indexOf(st.renk), BOY.indexOf(st.boyut), ISIM_BICIMLERI.indexOf(st.bicim)],
    s: 1, v: ucak.tasarimSurumu ?? TASARIM_SURUMLERI[ucak.tasarim] ?? 1,
    t: ucak.tasarim, a: (ucak.ad || '').slice(0, AD_SINIRI), n: String(metin || '').slice(0, NOT_SINIRI),
    g: String(gonderen || '').slice(0, AD_SINIRI), k: Math.round(ucak.kalite ?? 85),
    y: [a.kanatcik || 0, a.kivrimSol || 0, a.kivrimSag || 0, a.atac || 0], b, z: new Date().toISOString().slice(0, 10),
  };
}

const metinMi = (v, n) => typeof v === 'string' && v.length <= n;
const tamsayi = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;

// Gelen paket → { tasarim, ad, not, gonderen, kalite, ayar, cizgiler, tarih } ya da hata fırlatır.
export function notCoz(p) {
  if (!p || typeof p !== 'object' || p.s !== 1) throw new Error('tanınmayan not');
  if (!TASARIM_IDLERI.includes(p.t)) throw new Error('bilinmeyen tasarım');
  if (!metinMi(p.a, AD_SINIRI) || !metinMi(p.n, NOT_SINIRI) || !metinMi(p.g ?? '', AD_SINIRI)) throw new Error('metin çok uzun');
  if (!tamsayi(p.k, 0, 100)) throw new Error('kalite geçersiz');
  if (!Array.isArray(p.y) || p.y.length !== 4 || !tamsayi(p.y[0], -2, 2) || !tamsayi(p.y[1], -1, 1) || !tamsayi(p.y[2], -1, 1) || !tamsayi(p.y[3], 0, 2)) throw new Error('ayar geçersiz');
  if (!Array.isArray(p.b)) throw new Error('boya geçersiz');
  let toplam = 0;
  const cizgiler = p.b.map(c => {
    if (!Array.isArray(c) || (c.length !== 3 && c.length !== 4) || !tamsayi(c[0], 0, 2) || !tamsayi(c[1], 0, 3) || !Array.isArray(c[2]) || c[2].length % 2) throw new Error('boya geçersiz');
    if (c.length === 4 && !tamsayi(c[3], 0, UC_SIRASI.length - 1)) throw new Error('boya geçersiz');
    const uc = UCLAR[UC_SIRASI[c[3] || 0]];
    const kalem = { kalinlik: uc.kalinlik, ...(uc.firca ? { firca: true } : {}) };
    const n = [];
    for (let i = 0; i < c[2].length; i += 2) {
      const x = c[2][i], y = c[2][i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('boya geçersiz');
      n.push([sinir(x, -0.5, 1.6), sinir(y, -0.5, 1.6)]);
    }
    toplam += n.length;
    if (c[1] >= 2) return { renk: RENKLER[c[0]], duz: true, yuz: c[1] === 3 ? 'arka' : 'on', ...kalem, noktalar: n };
    return { renk: RENKLER[c[0]], kanat: KANATLAR[c[1]], ...kalem, noktalar: n };
  });
  if (toplam > NOKTA_SINIRI) throw new Error('boya çok büyük');
  // Gönderenin kalıbı eskiyse boya noktaları yeni kalıba oturmaz: not ve uçak gelir, boya gelmez.
  const surum = Number.isInteger(p.v) ? p.v : 1;
  // ismin stili (yoksa ya da bozuksa varsayılan)
  const i = Array.isArray(p.i) ? p.i : [];
  const isimStili = isimStiliDuzelt({ renk: ISIM_RENKLERI[i[0]], boyut: Object.keys(ISIM_BOYUTLARI)[i[1]], bicim: ISIM_BICIMLERI[i[2]] });
  const eskiKalip = surum !== (TASARIM_SURUMLERI[p.t] ?? 1);
  return {
    eskiKalip,
    tasarim: p.t, ad: p.a, not: p.n, gonderen: p.g || '', kalite: p.k, isimStili,
    ayar: { kanatcik: p.y[0], kivrimSol: p.y[1], kivrimSag: p.y[2], atac: p.y[3] },
    cizgiler: eskiKalip ? [] : cizgiler, tarih: typeof p.z === 'string' ? p.z.slice(0, 10) : '',
  };
}

// Notu kağıda sığacak satırlara böl (kelime bölmeden).
export function satirlara(metin, genislik = 24) {
  const satirlar = [];
  for (const paragraf of String(metin).split('\n')) {
    let s = '';
    for (const kelime of paragraf.split(/\s+/).filter(Boolean)) {
      if ((s + ' ' + kelime).trim().length > genislik && s) { satirlar.push(s); s = kelime; } else s = (s + ' ' + kelime).trim();
    }
    satirlar.push(s);
  }
  return satirlar;
}
