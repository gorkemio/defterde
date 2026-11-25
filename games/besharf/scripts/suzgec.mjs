// scripts/suzgec.mjs — TDK maddelerinden cevap ve tahmin listesine SAF karar. Ağ ve dosya yok; kelimeler.mjs kullanır,
// test/kelimeler.test.mjs sınar. Anlam seçimi ve kısaltma adamasmaca/scripts/filtre.mjs'ten taşındı.
//
// TDK kaydı (v12): { madde, ozel_mi: "0"|"1", kac, taki, anlamlarListe: [{ anlam_sira, fiil: "0"|"1", anlam,
//   ozelliklerListe: [{ tur: "1" alan | "3" söz türü | "4" kullanım, tam_adi }] }] }
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const tr = require('../kit/tr.js');

/* ---------- etiketler ---------- */

export const KABA = ['kaba konuşmada', 'hakaret yollu'];              // herhangi bir anlamda → iki listeden de çıkar
export const ARGO_ANA = ['argo', 'alay yollu'];                        // ana anlamda → cevap olamaz
export const ESKI = ['eskimiş', 'ağızlardan', 'halk ağzında'];        // ana anlamda → cevap olamaz, kök olamaz
const SAKINCALI = new Set([...KABA, ...ARGO_ANA]);

const TUR_HARF = {
  isim: 'a', sıfat: 's', zarf: 'z', ünlem: 'ü', edat: 'e', bağlaç: 'b', zamir: 'm',
  nesnesiz: 'f', '-i': 'f', '-e': 'f', '-de': 'f', '-den': 'f', '-le': 'f', 'yardımcı fiil': 'f',
};
export const TUR_ADI = { a: 'isim', s: 'sıfat', z: 'zarf', ü: 'ünlem', e: 'edat', b: 'bağlaç', m: 'zamir', f: 'fiil', '?': 'türsüz' };

export const anlamlar = (m) => (m.anlamlarListe || []).slice().sort((a, b) => Number(a.anlam_sira) - Number(b.anlam_sira));
const temizEtiket = (s) => tr.kucult(s || '').replace(/\s+/g, ' ').trim();
export const etiketler = (a) => new Set((a.ozelliklerListe || []).map((o) => temizEtiket(o.tam_adi)));
const birinde = (kume, liste) => liste.some((e) => kume.has(e));

export function turBul(m) {
  const anl = anlamlar(m);
  if (anl.some((a) => a.fiil === '1')) return 'f';
  for (const a of anl) for (const o of a.ozelliklerListe || []) {
    if (o.tur !== '3') continue;
    const t = TUR_HARF[temizEtiket(o.tam_adi)];
    if (t) return t;
  }
  return '?';
}

/* ---------- tanım (adamasmaca'dan) ---------- */

const ROMEN = '(?:I|II|III|IV|V|VI|VII|VIII|IX|X)';

export function kisalt(metin, enCok = 120) {
  let t = String(metin).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const nokta = t.indexOf(';');
  if (nokta >= 10) t = t.slice(0, nokta);
  t = t.replace(/\s*\([A-Z][a-z]+ [a-z]+[^)]*\)/g, '').replace(/,\s*[^,;]{1,40}\skarşıtı\s*$/, '').replace(/[:;,]+$/, '').trim();
  const sinif = t.replace(/^[^\s,]{3,30}(?:lerden|lardan),\s+(?=[a-zçğıöşü])/, '');
  if (sinif !== t && sinif.length >= 12) t = tr.buyut(sinif[0]) + sinif.slice(1);
  if (Array.from(t).length <= enCok) return t;
  t = Array.from(t).slice(0, enCok - 1).join('');
  t = t.slice(0, Math.max(t.lastIndexOf(' '), 1));
  if (t.split('(').length > t.split(')').length) t = t.slice(0, t.lastIndexOf('(')).trim();
  return t.replace(/[\s,;:(\-–]+$/, '') + '…';
}

export function gondermeMetni(metin) {
  const t = String(metin).replace(/^►\s*/, '').replace(new RegExp('\\s*\\(' + ROMEN + '\\)\\s*', 'g'), ' ').trim();
  if (!t || /[,;()]|karşıtı|bkz/i.test(t)) return null;
  return `“${t}” sözcüğüyle aynı anlamda`;
}

const TEKNIK = new Set(['kimya', 'fizik', 'matematik', 'dil bilgisi', 'dil bilimi', 'müzik', 'ticaret', 'hukuk', 'ekonomi', 'felsefe',
  'mantık', 'ruh bilimi', 'toplum bilimi', 'din bilimi', 'din bilgisi', 'bilişim', 'teknik', 'teknoloji', 'jeoloji', 'mineraloji',
  'geometri', 'meteoroloji', 'gök bilimi', 'biyoloji', 'fizyoloji', 'arkeoloji', 'antropoloji', 'mimarlık', 'madencilik', 'edebiyat',
  'eğitim', 'tarih', 'tıp', 'denizcilik', 'askerlik']);
const KISIR = /^\S+(?: \S+)? (?:işi|durumu)$/;

// (1) teknik ve kısır olmayan ilk anlam, (2) kısır olmayan ilk anlam, (3) ilk anlam; ► gönderme son çare; yoksa null.
export function anlamSec(m) {
  const adaylar = [];
  let gonderme = null;
  for (const a of anlamlar(m)) {
    const et = etiketler(a);
    if (birinde(et, [...SAKINCALI])) continue;
    const t = String(a.anlam || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (t.startsWith('►')) { gonderme = gonderme || gondermeMetni(t); continue; }
    adaylar.push({ metin: kisalt(t), teknik: birinde(et, [...TEKNIK]), kisir: KISIR.test(t) });
  }
  const secim = adaylar.find((x) => !x.teknik && !x.kisir) || adaylar.find((x) => !x.kisir) || adaylar[0];
  if (secim) return { anlam: secim.metin, gonderme: false };
  return gonderme ? { anlam: kisalt(gonderme), gonderme: true } : null;
}

/* ---------- tek madde ---------- */

// Madde başının biçim denetimi ve özeti. gecerli: false ise neden yazılır.
export function maddeOzet(m) {
  const madde = String(m.madde || '').normalize('NFC').trim();
  const ozet = { madde, kelime: null, gecerli: false, neden: null, ozel: String(m.ozel_mi) === '1' };
  if (!madde) return Object.assign(ozet, { neden: 'boş' });
  if (/\s/.test(madde)) return Object.assign(ozet, { neden: 'çok sözcüklü' });
  if (/[^\p{L}]/u.test(madde)) return Object.assign(ozet, { neden: 'tire, kesme, noktalama, rakam' });
  const kelime = tr.normalize(madde);
  ozet.kelime = kelime;
  if (ozet.ozel) return Object.assign(ozet, { neden: 'özel ad' });
  if (madde !== tr.kucult(madde)) return Object.assign(ozet, { neden: 'büyük harfli (kısaltma, simge)' });
  if (!Array.from(kelime).every((c) => tr.ALFABE.includes(c))) return Object.assign(ozet, { neden: 'alfabe dışı harf' });
  const anl = anlamlar(m);
  const ilk = anl.length ? etiketler(anl[0]) : new Set();
  Object.assign(ozet, {
    gecerli: true,
    uzunluk: Array.from(kelime).length,
    kaba: anl.some((a) => birinde(etiketler(a), KABA)),
    argoIlk: birinde(ilk, ARGO_ANA),
    eskiIlk: birinde(ilk, ESKI),
    tur: turBul(m),
    fiil: anl.some((a) => a.fiil === '1') && /m[ae]k$/.test(tr.kucult(madde)),
    taki: m.taki ? String(m.taki) : null,
    kac: Number(m.kac) || 0,
  });
  const secim = anlamSec(m);
  ozet.anlam = secim ? secim.anlam : null;
  ozet.gonderme = secim ? secim.gonderme : false;
  return ozet;
}

/* ---------- elle tutulan listeler ---------- */

// Metin: satır başına bir kelime; '#' sonrası açıklama; "önek*" türevleri de kapsar; [cevap] / [tahmin] bölümleri.
// Bölümsüz satırlar 'hepsi' sayılır. Döner: { cevap: Eslesme, tahmin: Eslesme, hepsi: Eslesme }
export function listeAyristir(metin) {
  const bolum = { cevap: { tam: new Set(), onek: [] }, tahmin: { tam: new Set(), onek: [] }, hepsi: { tam: new Set(), onek: [] } };
  let aktif = 'hepsi';
  for (const satir0 of String(metin || '').split('\n')) {
    const satir = satir0.replace(/#.*/, '').trim();
    if (!satir) continue;
    const b = satir.match(/^\[(cevap|tahmin)\]$/);
    if (b) { aktif = b[1]; continue; }
    if (satir.endsWith('*')) bolum[aktif].onek.push(tr.normalize(satir.slice(0, -1)));
    else bolum[aktif].tam.add(tr.normalize(satir));
  }
  const eslesme = (...adlar) => ({
    has: (k) => adlar.some((a) => bolum[a].tam.has(k) || bolum[a].onek.some((o) => k.startsWith(o))),
    kelimeler: adlar.flatMap((a) => [...bolum[a].tam]),
  });
  return { cevap: eslesme('cevap', 'hepsi'), tahmin: eslesme('tahmin', 'hepsi'), hepsi: eslesme('hepsi') };
}

/* ---------- eş sesli gruplar ---------- */

// ozetler: maddeOzet listesi (yalnız gecerli olanlar). Aynı yazılışlı maddeler tek grup. izinli: kaba kuralından muaf.
export function grupla(ozetler, izinli = { has: () => false }) {
  const g = new Map();
  for (const o of ozetler) {
    if (!o.gecerli) continue;
    if (!g.has(o.kelime)) g.set(o.kelime, { kelime: o.kelime, uzunluk: o.uzunluk, maddeler: [] });
    g.get(o.kelime).maddeler.push(o);
  }
  for (const grup of g.values()) {
    grup.maddeler.sort((a, b) => a.kac - b.kac);
    grup.zehirli = !izinli.has(grup.kelime) && grup.maddeler.some((m) => m.kaba);
  }
  return g;
}

/* ---------- kararlar ---------- */

// Cevap: { kabul, neden, madde (seçilen eş sesli), sira }. secenek: { siklik, sinir, yasakli, cikar, ekle }
export function cevapKarari(grup, { siklik = new Map(), sinir = 20000, yasakli = { has: () => false }, cikar = { has: () => false },
  ekle = { has: () => false } } = {}) {
  const k = grup.kelime, sira = siklik.get(k) ?? null;
  const ret = (neden) => ({ kabul: false, neden, sira });
  if (grup.uzunluk !== 5) return ret('uzunluk');
  if (grup.zehirli) return ret('kaba/hakaret etiketli');
  const temiz = grup.maddeler.filter((m) => !m.argoIlk && !m.eskiIlk && m.anlam);
  if (!temiz.length) {
    const m = grup.maddeler[0];
    return ret(m.argoIlk ? 'argo/alay (ana anlam)' : m.eskiIlk ? 'eskimiş/ağız (ana anlam)' : 'tanım yok');
  }
  const madde = temiz.find((m) => 'asfz'.includes(m.tur) && !m.gonderme) || temiz.find((m) => m.tur !== '?' && !m.gonderme) || temiz[0];
  const elle = ekle.has(k);
  if (madde.tur === '?' && !elle) return ret('söz türü yok (çekim kalıntısı)');
  if (!elle && (sira == null || sira > sinir)) return ret('seyrek (sıklık > ' + sinir + ')');
  if (cikar.has(k)) return ret('elle çıkarıldı');
  if (yasakli.has(k)) return ret('konu süzgeci');
  return { kabul: true, neden: elle ? 'elle eklendi' : null, madde, sira };
}

// Tahmin (madde başı): gevşek süzgeç — yalnız kaba/hakaret ve yasaklı (hakaret, cinsellik) engellenir.
export function tahminKarari(grup, { yasakli = { has: () => false }, cikar = { has: () => false } } = {}) {
  if (grup.uzunluk !== 5) return { kabul: false, neden: 'uzunluk' };
  if (grup.zehirli) return { kabul: false, neden: 'kaba/hakaret etiketli' };
  if (cikar.has(grup.kelime)) return { kabul: false, neden: 'elle çıkarıldı' };
  if (yasakli.has(grup.kelime)) return { kabul: false, neden: 'yasaklı (hakaret, cinsellik)' };
  return { kabul: true };
}

/* ---------- anlamda kelimeyi gizleme ---------- */

// Kelime (ya da `taki`'den gelen gövdesi: kitab-, burn-) ile başlayan sözcükler "…" olur; büyük/küçük harf duyarsız (tr-TR).
export function anlamGizle(anlam, kelime, govdeler = []) {
  const kokler = [kelime, ...govdeler].filter(Boolean).map((g) => tr.normalize(g));
  return String(anlam).replace(/[\p{L}]+/gu, (s) => (kokler.some((g) => tr.normalize(s).startsWith(g)) ? '…' : s));
}

/* ---------- günlük sıra ---------- */

function karma(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(tohum) {
  let a = typeof tohum === 'number' ? tohum >>> 0 : karma(String(tohum));
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function karistir(liste, tohum) {
  const a = liste.slice(), r = rng(tohum);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Dondurulmuş sıra: eski sıradaki kelimeler yerinde kalır; artık cevap olmayanın yerine yeni gelenlerden biri (tohumlu
// karışık sırayla) geçer; artan yeniler sona eklenir. Böylece geçmiş günlerin numarası ve cevabı (n mod N) kaymaz.
export function siraGuncelle(eski, yeni, tohum) {
  const kume = new Set(yeni), eskiKume = new Set(eski);
  const gelenler = karistir(yeni.filter((k) => !eskiKume.has(k)).sort(), tohum + '|yeni');
  const sira = eski.map((k) => (kume.has(k) ? k : gelenler.shift() ?? null)).filter(Boolean);
  return sira.concat(gelenler);
}
