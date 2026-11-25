// scripts/ekler.mjs — EK TABLOSU (tek yer) ve çekimli biçim üretici. SAF: dosya ve ağ yok; kelimeler.mjs kullanır,
// test/ekler.test.mjs sınar.
//
// Yöntem: uygun her TDK kökünden ek zinciriyle tam 5 harfli yüzey biçimler ÜRETİLİR; tahmin listesine yalnız sıklık
// listesinde de geçenler girer (kelimeler.mjs). Her biçim kendi çözümlemesini taşır: { kok, tip, ekler: ['-(s)İ', '-nA'] }.
// (Plan "soyma" diyordu; ileri yönde üretmek ünlü uyumunu ve ek koşullarını daha az hatayla uygular. PLAN.md §17.)
//
// Şablon dili (yüzeye çevrilirken):
//   @  2'li uyum: A / E          #  4'lü uyum: I / İ / U / Ü        (önceki son ünlüye göre)
//   %  D / T (ötümsüzden sonra T) &  C / Ç (ötümsüzden sonra Ç)
//   [y] [n] [s]  yalnız ünlüden sonra gelen kaynaştırma ünsüzü        [#]  yalnız ünsüzden sonra gelen ünlü
//   diğer harfler olduğu gibi (büyük harf).
// Kök ünlü uyumuna aykırıysa (saat, kalp, hal) TDK'nın `taki` alanındaki ünlü köke doğrudan eklenen ekin uyumunu belirler.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const tr = require('../kit/tr.js');

const UNLU = new Set(Array.from('AEIİOÖUÜ'));
const KALIN = new Set(Array.from('AIOU'));
const YUVARLAK = new Set(Array.from('OÖUÜ'));
const OTUMSUZ = new Set(Array.from('FSTKÇŞHP'));
const YUMUSAMA = { P: 'B', Ç: 'C', T: 'D', K: 'Ğ' };

const harf = (s) => Array.from(s);
const uzunluk = (s) => harf(s).length;
const son = (s) => { const h = harf(s); return h[h.length - 1]; };
const unluMu = (c) => UNLU.has(c);
export function sonUnlu(s) { const h = harf(s); for (let i = h.length - 1; i >= 0; i--) if (UNLU.has(h[i])) return h[i]; return null; }
export const ikili = (v) => (v && KALIN.has(v) ? 'A' : 'E');
export function dortlu(v) {
  if (!v) return 'İ';
  const k = KALIN.has(v), y = YUVARLAK.has(v);
  return k ? (y ? 'U' : 'I') : (y ? 'Ü' : 'İ');
}
const heceSayisi = (s) => harf(s).filter(unluMu).length;

/* ======================================================================================================
   EK TABLOSU — bütün ekler burada. [şablon, ad (rapor için), bayrak]
   ====================================================================================================== */

export const EKLER = {
  // ad çekimi (sıra: türetme → çoğul → iyelik → durum → -ki → ek-fiil → kişi)
  turetme: [['L#', '-lİ'], ['S#Z', '-sİz'], ['L#K', '-lİk'], ['&#', '-cİ'], ['&@', '-cA']],
  cogul: [['L@R', '-lAr']],
  iyelik: [['[#]M', '-(İ)m'], ['[#]N', '-(İ)n'], ['[s]#', '-(s)İ', 'ucuncu'], ['[#]M#Z', '-(İ)mİz'], ['[#]N#Z', '-(İ)nİz'], ['L@R#', '-lArİ', 'ucuncu']],
  durum: [['[y]#', '-(y)İ'], ['[y]@', '-(y)A'], ['%@', '-DA', 'bulunma'], ['%@N', '-DAn'], ['[n]#N', '-(n)İn'], ['[y]L@', '-(y)lA']],
  durumUcuncu: [['N#', '-nİ'], ['N@', '-nA'], ['N%@', '-nDA', 'bulunma'], ['N%@N', '-nDAn'], ['N#N', '-nİn'], ['YL@', '-ylA']],
  ki: [['Kİ', '-ki']],
  ekFiil: [['[y]#M', '-(y)İm'], ['S#N', '-sİn'], ['[y]#Z', '-(y)İz'], ['S#N#Z', '-sİnİz'], ['%#R', '-Dİr'],
    ['[y]%#', '-(y)Dİ', 'gecmis'], ['[y]M#Ş', '-(y)mİş', 'rivayet'], ['[y]S@', '-(y)sA', 'gecmis']],
  kisiGecmis: [['M', '-m'], ['N', '-n'], ['K', '-k'], ['N#Z', '-nİz'], ['L@R', '-lAr']],
  kisiRivayet: [['#M', '-İm'], ['S#N', '-sİn'], ['#Z', '-İz'], ['L@R', '-lAr']],

  // fiil çekimi (gövde → [olumsuz -mA] → zaman/kip → kişi)
  olumsuz: ['M@', '-mA'],
  zaman: [['%#', '-Dİ', 'gecmis'], ['M#Ş', '-mİş', 'rivayet'], ['S@', '-sA', 'gecmis'], ['S#N', '-sİn (emir)'], ['[y]#N', '-(y)İn (emir)'],
    ['[y]#N#Z', '-(y)İnİz (emir)'], ['[y]#P', '-(y)İp'], ['[y]@N', '-(y)An', 'sifat'], ['M@', '-mA (ad)', 'sifat'],
    ['[y]@', '-(y)A (ulaç)'], ['[y]@L#', '-(y)AlI']],
  olumsuzGenis: [['Z', '-z'], ['M', '-m'], ['Y#Z', '-yİz'], ['ZS#N', '-zsİn'], ['ZL@R', '-zlAr']],   // -mA'dan sonra
  genisEkFiil: [['%#', '-Dİ', 'gecmis'], ['S@', '-sA', 'gecmis']],                                     // derdi, derse
};

// Zamirler: ek alırken gövde değişenler ve yasak ekler; düzensiz biçimler ayrıca
export const ZAMIR = {
  O: { govde: 'ON' }, BU: { govde: 'BUN', yasak: ['-(y)lA'] }, ŞU: { govde: 'ŞUN', yasak: ['-(y)lA'] },
  BEN: { yasak: ['-(y)A', '-(n)İn'] }, SEN: { yasak: ['-(y)A'] }, BİZ: { yasak: ['-(n)İn'] },
};
export const DUZENSIZ = [
  ['BENİM', 'BEN', '-im (ilgi, düzensiz)'], ['BİZİM', 'BİZ', '-im (ilgi, düzensiz)'], ['BANA', 'BEN', 'yönelme (düzensiz)'],
  ['SANA', 'SEN', 'yönelme (düzensiz)'], ['BENCE', 'BEN', '-cE'], ['SENCE', 'SEN', '-cE'], ['BİZCE', 'BİZ', '-cE'],
  ['SİZCE', 'SİZ', '-cE'], ['ONLAR', 'O', '-nlAr'],
];
export const SORU = ['MI', 'Mİ', 'MU', 'MÜ'];          // soru eki (ayrı yazılır; TDK'daki "mi" nota adıdır)
export const KI_KU = { DÜN: 'KÜ', GÜN: 'KÜ', YIL: 'Kİ' };   // dünkü, günkü, yılki

/* ---------- şablon → yüzey ---------- */

// govde'ye şablonu ekler; uyum: köke doğrudan eklenirken kullanılacak ünlü (taki'den), yoksa gövdenin son ünlüsü.
export function ekle(govde, sablon, uyum) {
  let s = govde, ref = uyum || sonUnlu(govde);
  const koy = (c) => { s += c; if (unluMu(c)) ref = c; };
  for (let i = 0; i < sablon.length; i++) {
    const c = sablon[i];
    if (c === '[') {
      const ic = sablon.slice(i + 1, sablon.indexOf(']', i));
      i = sablon.indexOf(']', i);
      const sonUnluMu = unluMu(son(s));
      if (ic === '#') { if (!sonUnluMu) koy(dortlu(ref)); }
      else if (sonUnluMu) koy(tr.buyut(ic));
    } else if (c === '#') koy(dortlu(ref));
    else if (c === '@') koy(ikili(ref));
    else if (c === '%') koy(OTUMSUZ.has(son(s)) ? 'T' : 'D');
    else if (c === '&') koy(OTUMSUZ.has(son(s)) ? 'Ç' : 'C');
    else koy(c);
  }
  return s;
}

/* ---------- taki → ünlüyle başlayan ek önündeki gövde ---------- */

// Ad kökü: { alt: gövde | null, uyum: ünlü | null, cozulemedi: bool } listesi (eş seslilerde birden çok)
export function takiCoz(kok, taki) {
  const sonuc = [];
  if (!taki) return sonuc;
  for (const p0 of String(taki).split(',')) {
    const p = tr.buyut(p0.replace(/^[\s-]+|\s+$/g, ''));
    if (!p) continue;
    const h = harf(p);
    let i = h.length;
    while (i > 0 && unluMu(h[i - 1])) i--;
    const uyum = i < h.length ? h[h.length - 1] : null;
    const r = h.slice(0, i).join('');
    const k = harf(kok), sk = k[k.length - 1];
    let alt = null, cozulemedi = false;
    if (!r) alt = null;
    else if (kok.endsWith(r)) alt = null;                                                        // 1: kök değişmez (yoku, oğulu)
    else if (r.length === 2 && r[0] === r[1] && sk === r[0]) alt = kok + r[0];                   // 2: ikizleşme (hakkı, hissi)
    else if (harf(r).length === 1 && (YUMUSAMA[sk] === r || (sk === 'K' && r === 'G'))) alt = k.slice(0, -1).join('') + r;  // 3: yumuşama
    else if (harf(r).length === 2 && k.length >= 3 && !unluMu(r[0]) && !unluMu(r[1]) &&
      k[k.length - 3] === harf(r)[0] && unluMu(k[k.length - 2]) && (sk === harf(r)[1] || YUMUSAMA[sk] === harf(r)[1])) {
      alt = k.slice(0, -2).join('') + harf(r)[1];                                               // 4: ünlü düşmesi (+ yumuşama: kayb-)
    }
    else if (r === 'Y' && unluMu(sk)) alt = kok + 'Y';                                          // 5: kaynaştırma (neyi, suyu)
    else if (harf(r).length === 2 && r[0] === r[1] && YUMUSAMA[sk] === r[0]) alt = k.slice(0, -1).join('') + r[0] + r[0];  // 6: reddi
    else cozulemedi = true;                                                                     // 7: raporda listelenir
    sonuc.push({ alt, uyum, cozulemedi, taki: p });
  }
  return sonuc;
}

// Fiil gövdesi: { alt, genis } — alt: ünlüyle başlayan ek önündeki gövde (git → gid), genis: geniş zaman eki (yüzey)
export function fiilTakiCoz(govde, taki) {
  const sonuclar = [];
  for (const p0 of String(taki || '').split(',')) {
    const p = tr.buyut(p0.replace(/^[\s-]+|\s+$/g, ''));
    if (!p) continue;
    const h = harf(p);
    if (unluMu(h[0])) sonuclar.push({ alt: null, genis: p });
    else if (p === 'R') sonuclar.push({ alt: null, genis: 'R' });
    else if (h.length > 1 && YUMUSAMA[son(govde)] === h[0]) sonuclar.push({ alt: harf(govde).slice(0, -1).join('') + h[0], genis: h.slice(1).join('') });
    else if (unluMu(son(govde)) && p.endsWith('R')) sonuclar.push({ alt: null, genis: 'R' });
  }
  return sonuclar;
}

// Varsayılan geniş zaman: ünlüyle biten gövde -r, tek heceli -Ar, çok heceli -İr
export function genisVarsayilan(govde) {
  if (unluMu(son(govde))) return 'R';
  return heceSayisi(govde) <= 1 ? '@R' : '#R';
}

/* ---------- üretim ---------- */

// Bir eki ekler; kök gövdesine doğrudan ekleniyorsa ve ek (alt gövdeye göre) ünlüyle başlıyorsa alt gövde kullanılır.
function ekleKok(d, sablon) {
  if (!d.kokte) return ekle(d.s, sablon);
  for (const v of d.varyant) {
    if (!v.alt) continue;
    const a = ekle(v.alt, sablon, v.uyum);
    if (unluMu(harf(a)[uzunluk(v.alt)])) return a;
  }
  const uyum = (d.varyant.find(v => v.uyum) || {}).uyum;
  return ekle(d.s, sablon, uyum);
}

// cikti: Map<biçim, çözümleme>; en az ekli çözümleme kalır (eşitlikte ilk bulunan). Yalnız tam 5 harfli biçimler.
function kaydet(cikti, s, analiz) {
  if (uzunluk(s) !== 5) return;
  const eski = cikti.get(s);
  if (!eski || analiz.ekler.length < eski.ekler.length) cikti.set(s, analiz);
}

// Ad, zamir ve soru eki zinciri. asama: EK_SIRASI indeksi.
const EK_SIRASI = ['turetme', 'cogul', 'iyelik', 'durum', 'ki', 'ekFiil', 'kisi'];
function adGez(cikti, kok, d, asama) {
  for (let i = asama; i < EK_SIRASI.length; i++) {
    const ad = EK_SIRASI[i];
    let liste;
    if (ad === 'turetme') { if (!d.kokte || kok.tip !== 'ad') continue; liste = EKLER.turetme; }
    else if (ad === 'cogul') { if (kok.tip === 'soru') continue; liste = EKLER.cogul; }
    else if (ad === 'iyelik') { if (kok.tip === 'soru' || kok.tip === 'zamir') continue; liste = EKLER.iyelik; }
    else if (ad === 'durum') { if (kok.tip === 'soru') continue; liste = d.ucuncu ? EKLER.durumUcuncu : EKLER.durum; }
    else if (ad === 'ki') { if (!d.bulunma) continue; liste = EKLER.ki; }
    else if (ad === 'ekFiil') liste = EKLER.ekFiil;
    else if (ad === 'kisi') { if (!d.kopula) continue; liste = d.kopula === 'rivayet' ? EKLER.kisiRivayet : EKLER.kisiGecmis; }
    for (const [sablon, adi, bayrak] of liste) {
      if (kok.yasak && kok.yasak.includes(adi)) continue;
      const s = ekleKok(d, sablon);
      if (uzunluk(s) > 5) continue;
      const ekler = [...d.ekler, adi];
      kaydet(cikti, s, { kok: kok.kelime, tip: kok.tip, ekler });
      const e = { s, kokte: false, varyant: [], ekler, ucuncu: bayrak === 'ucuncu', bulunma: bayrak === 'bulunma',
        kopula: ad === 'ekFiil' && (bayrak === 'gecmis' || bayrak === 'rivayet') ? bayrak : null };
      if (ad === 'kisi' || (ad === 'ekFiil' && !e.kopula)) continue;       // kişi ekinden ve şimdiki ek-fiilden sonra ek yok
      if (uzunluk(s) < 5) adGez(cikti, kok, e, i + 1);
    }
  }
}

// kok: { kelime, tip: 'ad' | 'zamir' | 'soru', taki? }
export function adUret(cikti, kok) {
  const z = kok.tip === 'zamir' ? ZAMIR[kok.kelime] : null;
  const govde = (z && z.govde) || kok.kelime;
  const varyant = z && z.govde ? [] : takiCoz(kok.kelime, kok.taki);
  const k = z ? Object.assign({}, kok, { yasak: z.yasak }) : kok;
  const d = { s: govde, kokte: !(z && z.govde), varyant, ekler: [], ucuncu: false, bulunma: false, kopula: null };
  if (kok.tip === 'soru') { adGez(cikti, k, d, EK_SIRASI.indexOf('ekFiil')); return; }
  adGez(cikti, k, d, 0);
  if (kok.tip === 'ad' && KI_KU[kok.kelime]) kaydet(cikti, kok.kelime + KI_KU[kok.kelime], { kok: kok.kelime, tip: 'ad', ekler: ['-' + tr.kucult(KI_KU[kok.kelime])] });
}

// Şimdiki zaman: a/e ile biten gövdede ünlü daralır (bekle → bekliyor, de → diyor); ünsüzden sonra 4'lü ünlü + yor.
export function simdiki(govde, alt) {
  const s = govde, sh = son(s);
  if (sh === 'A' || sh === 'E') {
    const taban = harf(s).slice(0, -1).join('');
    const v = sonUnlu(taban) ? dortlu(sonUnlu(taban)) : (sh === 'A' ? 'I' : 'İ');
    return taban + v + 'YOR';
  }
  if (unluMu(sh)) return s + 'YOR';
  const g = alt || s;
  return g + dortlu(sonUnlu(g)) + 'YOR';
}

// kok: { kelime: gövde (GEL, BEKLE), tip: 'fiil', taki? }
export function fiilUret(cikti, kok) {
  const govde = kok.kelime;
  const takiler = fiilTakiCoz(govde, kok.taki);
  const alt = (takiler.find(t => t.alt) || {}).alt || null;
  const varyant = alt ? [{ alt, uyum: null }] : [];
  const daralir = govde === 'DE' || govde === 'YE';                  // de-, ye-: diyen, yiyen, yiyip (deyip de kalır)
  const kayit = (s, ekler) => {
    kaydet(cikti, s, { kok: govde, tip: 'fiil', ekler });
    if (daralir && harf(s)[2] === 'Y' && unluMu(harf(s)[3] || '')) kaydet(cikti, harf(s)[0] + 'İ' + harf(s).slice(2).join(''), { kok: govde, tip: 'fiil', ekler: [...ekler, '(e → i)'] });
  };
  const devam = (s, ekler, kopula) => {                              // kişi ekleri
    const liste = kopula === 'rivayet' ? EKLER.kisiRivayet : EKLER.kisiGecmis;
    for (const [sablon, adi] of liste) { const t = ekle(s, sablon); if (uzunluk(t) <= 5) kayit(t, [...ekler, adi]); }
  };
  if (uzunluk(govde) === 5) kayit(govde, ['yalın gövde (emir)']);

  for (const olumsuz of [false, true]) {
    const d = olumsuz ? { s: ekle(govde, EKLER.olumsuz[0]), kokte: false, varyant: [] } : { s: govde, kokte: true, varyant };
    const on = olumsuz ? [EKLER.olumsuz[1]] : [];
    if (uzunluk(d.s) > 5) continue;
    if (olumsuz) kayit(d.s, on);
    // zaman ve kipler
    for (const [sablon, adi, bayrak] of EKLER.zaman) {
      if (olumsuz && adi === '-mA (ad)') continue;
      const s = ekleKok(d, sablon);
      if (uzunluk(s) > 5) continue;
      kayit(s, [...on, adi]);
      if (bayrak === 'gecmis' || bayrak === 'rivayet') devam(s, [...on, adi], bayrak);
      if (bayrak === 'sifat' && uzunluk(s) < 5) adGez(cikti, { kelime: govde, tip: 'fiil' }, { s, kokte: false, varyant: [], ekler: [...on, adi] }, 1);
    }
    // şimdiki zaman
    const sim = simdiki(d.s, olumsuz ? null : alt);
    if (uzunluk(sim) <= 5) { kayit(sim, [...on, '-(İ)yor']); devam(sim, [...on, '-(İ)yor'], 'rivayet'); }
    // geniş zaman
    if (!olumsuz) {
      const secenekler = takiler.length ? takiler : [{ alt: null, genis: genisVarsayilan(govde) }];
      for (const t of secenekler) {
        const g = t.alt || govde;
        const s = /[@#]/.test(t.genis) ? ekle(g, t.genis) : g + t.genis;
        if (uzunluk(s) > 5) continue;
        kayit(s, ['-(İ/A)r']);
        devam(s, ['-(İ/A)r'], 'rivayet');
        for (const [sablon, adi, bayrak] of EKLER.genisEkFiil) {
          const u = ekle(s, sablon);
          if (uzunluk(u) <= 5) { kayit(u, ['-(İ/A)r', adi]); devam(u, ['-(İ/A)r', adi], bayrak); }
        }
      }
    } else {
      for (const [sablon, adi] of EKLER.olumsuzGenis) { const s = ekle(d.s, sablon); if (uzunluk(s) <= 5) kayit(s, [...on, adi]); }
    }
  }
}

// kokler: [{ kelime, tip, taki }] → Map<biçim, çözümleme>. Düzensiz zamir biçimleri ve soru eki dahil.
export function uret(kokler, { soru = true, duzensiz = true } = {}) {
  const cikti = new Map();
  if (duzensiz) for (const [b, kok, ek] of DUZENSIZ) kaydet(cikti, b, { kok, tip: 'zamir', ekler: [ek] });
  if (soru) for (const s of SORU) adUret(cikti, { kelime: s, tip: 'soru' });
  for (const k of kokler) if (k.tip === 'fiil') fiilUret(cikti, k);
  for (const k of kokler) if (k.tip !== 'fiil') adUret(cikti, k);
  return cikti;
}

// Rapor ve testler için: "OĞL+UM = OĞUL + -(İ)m" biçiminde açıklama
export const aciklama = (bicim, a) => `${bicim} = ${a.kok}${a.tip === 'fiil' ? '-' : ''} + ${a.ekler.join(' + ')}`;
