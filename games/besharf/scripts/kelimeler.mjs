#!/usr/bin/env node
// scripts/kelimeler.mjs — KELİME HATTI. Yalnız geliştirmede çalışır: ham kaynaklardan data/*.js, rapor ve inceleme üretir.
//
//   node scripts/kelimeler.mjs [--yenile]       --yenile: ham dosyaları yeniden indir
//
// Girdi : ham/tdk/gts.json (TDK Güncel Türkçe Sözlük 12. baskı, satır başına bir JSON; ogun/guncel-turkce-sozluk)
//         ham/siklik/tr_50k.txt (hermitdave/FrequencyWords, OpenSubtitles 2018)
//         scripts/yasakli-cevap.txt · yasakli-tahmin.txt · elle-ekle.txt · elle-cikar.txt · izinli.txt
// Çıktı : data/cevaplar.js (dondurulmuş günlük sıra, basit kodlu) · data/tahminler.js (sıklık sırası) · data/anlamlar.js
//         scripts/sira.txt (dondurulmuş sıra) · scripts/rapor.md · scripts/inceleme.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tr, maddeOzet, grupla, cevapKarari, tahminKarari, listeAyristir, anlamGizle, karistir, siraGuncelle, TUR_ADI, kisalt as kisaltAnlam } from './suzgec.mjs';
import { uret, takiCoz, aciklama } from './ekler.mjs';

export const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const yol = (...p) => path.join(kok, ...p);
const TDK_URL = 'https://raw.githubusercontent.com/ogun/guncel-turkce-sozluk/master/sozluk/v12/v12.gts.json.tar.gz';
const SIKLIK_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/tr/tr_50k.txt';
export const SIKLIK_SINIRI = 20000;          // cevap: sıklık listesinin ilk 20 bini ("herkesin bildiği")
const MASTAR_PAYI = 0.10;
const SIRA_TOHUMU = 'bes-harf-1';
const BOYUT_SINIRI = 400 * 1024;
const bayt = (s) => Buffer.byteLength(s, 'utf8');
const uz = (s) => Array.from(s).length;

/* ---------- 1. ham dosyalar ---------- */

async function indir(url, hedef) {
  console.log('indiriliyor:', url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, Buffer.from(await r.arrayBuffer()));
}

export async function hamHazirla(yenile = false) {
  const json = yol('ham', 'tdk', 'gts.json'), tgz = yol('ham', 'tdk', 'v12.gts.json.tar.gz'), sk = yol('ham', 'siklik', 'tr_50k.txt');
  const komsu = path.join(kok, '..', 'adamasmaca', 'ham');                   // kardeş projede varsa 120 MB indirme yok
  if (!yenile && !fs.existsSync(json) && fs.existsSync(path.join(komsu, 'tdk', 'gts.json'))) {
    fs.mkdirSync(yol('ham'), { recursive: true });
    fs.cpSync(komsu, yol('ham'), { recursive: true });
  }
  if (yenile || (!fs.existsSync(json) && !fs.existsSync(tgz))) await indir(TDK_URL, tgz);
  if (yenile || !fs.existsSync(json)) {
    const uyeler = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' }).split('\n').filter(Boolean);
    if (uyeler.length !== 1 || !/^[\w.-]+\.json$/.test(uyeler[0])) throw new Error('Beklenmeyen arşiv içeriği: ' + uyeler.join(', '));
    execFileSync('tar', ['-xzf', tgz, '-C', path.dirname(tgz), uyeler[0]]);
    if (uyeler[0] !== 'gts.json') fs.renameSync(path.join(path.dirname(tgz), uyeler[0]), json);
  }
  if (yenile || !fs.existsSync(sk)) await indir(SIKLIK_URL, sk);
  return { json, sk };
}

function maddeleriOku(dosya) {
  const metin = fs.readFileSync(dosya, 'utf8');
  if (metin.trimStart().startsWith('[')) return JSON.parse(metin);
  return metin.split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s.replace(/,\s*$/, '')));
}

// "kelime sayı" → Map<büyük harf kelime, sıra>. Aynı biçime inenlerin sayıları toplanır; alfabe dışı satır atılır.
export function siklikOku(dosya) {
  const sayim = new Map();
  for (const satir of fs.readFileSync(dosya, 'utf8').split('\n')) {
    const i = satir.lastIndexOf(' ');
    if (i < 1) continue;
    const sayi = Number(satir.slice(i + 1));
    const n = tr.normalize(satir.slice(0, i));
    if (!Number.isFinite(sayi) || !n || !Array.from(n).every((c) => tr.ALFABE.includes(c))) continue;
    sayim.set(n, (sayim.get(n) || 0) + sayi);
  }
  const sirali = [...sayim.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return new Map(sirali.map(([k], i) => [k, i + 1]));
}

const listeDosya = (ad) => listeAyristir(fs.existsSync(yol('scripts', ad)) ? fs.readFileSync(yol('scripts', ad), 'utf8') : '');

/* ---------- 2. hat ---------- */

export async function hat({ yenile = false } = {}) {
  const ham = await hamHazirla(yenile);
  const maddeler = maddeleriOku(ham.json);
  const siklik = siklikOku(ham.sk);
  const L = {
    yasakliCevap: listeDosya('yasakli-cevap.txt').hepsi, yasakliTahmin: listeDosya('yasakli-tahmin.txt').hepsi,
    ekle: listeDosya('elle-ekle.txt'), cikar: listeDosya('elle-cikar.txt'), izinli: listeDosya('izinli.txt').hepsi,
  };

  const ozetler = maddeler.map(maddeOzet);
  const ozelAdlar = new Set(ozetler.filter((o) => o.kelime && (o.ozel || o.neden === 'büyük harfli (kısaltma, simge)')).map((o) => o.kelime));
  const gruplar = grupla(ozetler, L.izinli);
  const bes = [...gruplar.values()].filter((g) => g.uzunluk === 5);

  // --- cevaplar
  const cevapNeden = {}, cevapOrnek = {};
  const say = (n, k) => { cevapNeden[n] = (cevapNeden[n] || 0) + 1; (cevapOrnek[n] ||= []).length < 12 && cevapOrnek[n].push(k); };
  let cevaplar = [];
  const adaylar = [];                                                    // inceleme: teknik süzgeçleri geçen, sırası ≤ sınır
  const genisBant = [];                                                  // inceleme: 20–30 bin bandı
  for (const g of bes) {
    const k = cevapKarari(g, { siklik, sinir: SIKLIK_SINIRI, yasakli: L.yasakliCevap, cikar: L.cikar.cevap, ekle: L.ekle.cevap });
    if (k.kabul) { cevaplar.push({ kelime: g.kelime, sira: k.sira, madde: k.madde }); }
    else say(k.neden, g.kelime);
    if (k.kabul || k.neden === 'konu süzgeci' || k.neden === 'elle çıkarıldı') adaylar.push({ g, k });
    if (!k.kabul && /^seyrek/.test(k.neden) && k.sira && k.sira <= 30000) {
      const k2 = cevapKarari(g, { siklik, sinir: 30000, yasakli: L.yasakliCevap, cikar: L.cikar.cevap, ekle: L.ekle.cevap });
      if (k2.kabul) genisBant.push({ g, k: k2 });
    }
  }
  // elle-ekle [cevap]: madde başı olmayan kelime cevap olamaz (anlamı yok); raporda uyarı
  const elleCevapYok = L.ekle.cevap.kelimeler.filter((k) => !gruplar.has(k) || uz(k) !== 5);
  // mastar payı
  const mastar = cevaplar.filter((c) => /M[AE]K$/.test(c.kelime));
  let mastarAtilan = [];
  const enCokMastar = Math.floor(cevaplar.length * MASTAR_PAYI);
  if (mastar.length > enCokMastar) {
    mastarAtilan = mastar.sort((a, b) => (b.sira ?? 1e9) - (a.sira ?? 1e9)).slice(0, mastar.length - enCokMastar).map((c) => c.kelime);
    cevaplar = cevaplar.filter((c) => !mastarAtilan.includes(c.kelime));
  }

  // --- ek üretimi için kökler
  const kokler = [], sakincaliKokler = [], eskiKokler = [], cozulemeyenTaki = [];
  for (const g of gruplar.values()) {
    const hedef = g.zehirli ? sakincaliKokler : null;
    for (const m of g.maddeler) {
      const liste = hedef || (m.eskiIlk || m.argoIlk ? eskiKokler : kokler);
      if (m.fiil) {
        const govde = tr.normalize(tr.kucult(m.madde).slice(0, -3));
        if (uz(govde) >= 2 && uz(govde) <= 5) liste.push({ kelime: govde, tip: 'fiil', taki: m.taki });
      } else if ((uz(g.kelime) >= 2 && uz(g.kelime) <= 5) || (m.tur === 'm' && g.kelime === 'O')) {
        // Fiil dışındaki bütün türler ad kökü: etiketsiz temel adlar (kol), edatlar (ait), 5 harfli kökler (vakit → vakti)
        liste.push({ kelime: g.kelime, tip: m.tur === 'm' ? 'zamir' : 'ad', taki: m.taki });
        if (liste === kokler) for (const t of takiCoz(g.kelime, m.taki)) if (t.cozulemedi) cozulemeyenTaki.push(`${g.kelime} (${m.taki})`);
      }
    }
  }
  const uretilen = uret(kokler);
  const sakincali = uret(sakincaliKokler, { soru: false, duzensiz: false });
  const eskiUretilen = uret(eskiKokler, { soru: false, duzensiz: false });

  // --- tahminler
  const tahmin = new Map();                                              // kelime → { kaynak, analiz? }
  const tahminRet = {};
  for (const g of bes) {
    const k = tahminKarari(g, { yasakli: L.yasakliTahmin, cikar: L.cikar.tahmin });
    if (k.kabul) tahmin.set(g.kelime, { kaynak: 'madde' });
    else tahminRet[k.neden] = (tahminRet[k.neden] || 0) + 1;
  }
  const sik5 = [...siklik.entries()].filter(([k]) => uz(k) === 5);
  const reddedilen = [];
  let cekimli = 0;
  const cekimTip = {};
  for (const [k, sira] of sik5) {
    if (tahmin.has(k) || gruplar.has(k) && gruplar.get(k).uzunluk === 5 && tahminKarari(gruplar.get(k), { yasakli: L.yasakliTahmin, cikar: L.cikar.tahmin }).kabul) continue;
    const a = uretilen.get(k);
    let neden = null;
    if (L.cikar.tahmin.has(k)) neden = 'elle çıkarıldı';
    else if (gruplar.has(k)) neden = 'madde başı reddedildi';
    else if (a && (L.yasakliTahmin.has(k) || L.yasakliTahmin.has(a.kok))) neden = 'yasaklı kök';
    else if (a) { tahmin.set(k, { kaynak: 'cekim', analiz: a }); cekimli++; cekimTip[a.tip] = (cekimTip[a.tip] || 0) + 1; continue; }
    else if (ozelAdlar.has(k)) neden = 'özel ad';
    else if (sakincali.has(k)) neden = 'sakıncalı kök (' + sakincali.get(k).kok + ')';
    else if (eskiUretilen.has(k)) neden = 'eskimiş/argo kök (' + eskiUretilen.get(k).kok + ')';
    else neden = 'kök + ek ile açıklanamadı';
    reddedilen.push({ kelime: k, sira, neden });
  }
  const elleTahmin = [];
  for (const k of L.ekle.tahmin.kelimeler) {
    if (uz(k) !== 5 || !Array.from(k).every((c) => tr.ALFABE.includes(c))) continue;
    if (!tahmin.has(k)) { tahmin.set(k, { kaynak: 'elle' }); elleTahmin.push(k); }
  }
  for (const k of L.cikar.tahmin.kelimeler) tahmin.delete(k);
  for (const c of cevaplar) if (!tahmin.has(c.kelime)) tahmin.set(c.kelime, { kaynak: 'madde' });   // cevaplar ⊂ tahminler

  const tahminListe = [...tahmin.keys()].sort((a, b) => (siklik.get(a) ?? 1e9) - (siklik.get(b) ?? 1e9) || (a < b ? -1 : a > b ? 1 : 0));

  // --- anlamlar ve dondurulmuş sıra
  const siraDosya = yol('scripts', 'sira.txt');
  const eskiSira = fs.existsSync(siraDosya) ? fs.readFileSync(siraDosya, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')) : null;
  const cevapAdlari = cevaplar.map((c) => c.kelime).sort();
  const sira = eskiSira ? siraGuncelle(eskiSira, cevapAdlari, SIRA_TOHUMU) : karistir(cevapAdlari, SIRA_TOHUMU);
  const cevapBilgi = new Map(cevaplar.map((c) => [c.kelime, c]));
  // "Ödemek işi", "Evli olma durumu" gibi kısır tanımlar: X'in kendi tanımıyla açılır ("Borcunu vermek işi")
  const kisirAc = (anlam) => {
    const e = String(anlam).match(/^(\S+(?: \S+)?) (işi|durumu)$/);
    if (!e) return anlam;
    const x = tr.normalize(e[1].split(' ')[0]);
    const g = gruplar.get(x);
    const kaynak = g && g.maddeler.find((m) => m.anlam && !/ (işi|durumu)$/.test(m.anlam) && !m.gonderme);
    if (!kaynak) return anlam;
    const ic = kaynak.anlam.replace(/…$/, '').replace(/[.;:,]+$/, '');
    const ilk = Array.from(ic)[0];
    return kisaltAnlam(tr.buyut(ilk) + Array.from(ic).slice(1).join('') + ' ' + (e[1].includes(' ') ? e[1].split(' ').slice(1).join(' ') + ' ' : '') + e[2]);
  };
  const anlamlar = sira.map((k) => {
    const c = cevapBilgi.get(k), m = Object.assign({}, c.madde, { anlam: kisirAc(c.madde.anlam) });
    const govdeler = takiCoz(k, m.taki).map((t) => t.alt).filter(Boolean);
    if (m.fiil) govdeler.push(k.slice(0, -3));
    return anlamGizle(m.anlam, k, govdeler.filter((x) => uz(x) >= 3));
  });

  return { maddeler, ozetler, siklik, L, gruplar, bes, cevaplar, cevapNeden, cevapOrnek, adaylar, genisBant, elleCevapYok, mastar,
    mastarAtilan, kokler, uretilen, sakincali, eskiUretilen, cozulemeyenTaki, tahmin, tahminRet, tahminListe, reddedilen, cekimli,
    cekimTip, elleTahmin, sira, eskiSira, anlamlar, ozelAdlar, sik5 };
}

/* ---------- 3. yazma ---------- */

function veriDosyasi(ad, aciklamaSatirlari, deger) {
  const govde = JSON.stringify(deger);
  return `// data/${ad}.js — scripts/kelimeler.mjs üretti; elle düzenleme. ${new Date().toISOString().slice(0, 10)}
${aciklamaSatirlari.map((s) => '// ' + s).join('\n')}
(function () {
  'use strict';
  var v = ${govde};
  if (typeof window !== 'undefined') ((window.BH = window.BH || {}).veri = window.BH.veri || {}).${ad} = v;
  if (typeof module !== 'undefined' && module.exports) module.exports = v;
})();
`;
}

const KAYNAK_NOTU = [
  'Kaynak: TDK Güncel Türkçe Sözlük 12. baskı (ogun/guncel-turkce-sozluk deposu, MIT; sözlük içeriği TDK\'ya aittir).',
  'Sıklık sırası: hermitdave/FrequencyWords tr_50k (OpenSubtitles 2018; kod MIT, içerik CC BY-SA 4.0). Yalnız sıra türetildi.',
];

function kisa(s, n = 70) { const h = Array.from(String(s || '')); return h.length <= n ? h.join('') : h.slice(0, n - 1).join('') + '…'; }
function karma(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function yaz(H) {
  fs.mkdirSync(yol('data'), { recursive: true });
  const kodlu = tr.kaydir(H.sira.join('\n'));
  const dosyalar = {
    cevaplar: veriDosyasi('cevaplar', [...KAYNAK_NOTU,
      `${H.sira.length} cevap, DONDURULMUŞ günlük sırada (gün n → n mod N). Kit.tr.kaydir ile basit kodlu: gizlilik değil, sürpriz.`],
    { adet: H.sira.length, kodlu }),
    tahminler: veriDosyasi('tahminler', [...KAYNAK_NOTU,
      `${H.tahminListe.length} tahmin: 5 harfli madde başları + sıklık listesinden kök + ek ile açıklanan çekimli biçimler.`,
      'Sıra: sıklık listesindeki sıraya göre (en sık önce); sırası olmayanlar sonda, alfabetik. onerilmez: madde başı olmayanlar.'],
    { adet: H.tahminListe.length, siralanan: H.tahminListe.filter((k) => H.siklik.has(k)).length, liste: H.tahminListe.join('\n'),
      // madde başı olmayanlar (çekimli ve elle eklenen): tahmin olarak geçerli, bilgisayar önermez
      onerilmez: H.tahminListe.filter((k) => H.tahmin.get(k).kaynak !== 'madde').join('\n') }),
    anlamlar: veriDosyasi('anlamlar', [...KAYNAK_NOTU,
      'Her cevabın TDK\'daki ilk uygun anlamı (en çok 120 karakter), cevaplar.js sırasına hizalı; kelimenin kendisi "…" ile gizli.'],
    { liste: H.anlamlar }),
  };
  const boyut = {};
  for (const [ad, metin] of Object.entries(dosyalar)) { fs.writeFileSync(yol('data', ad + '.js'), metin); boyut[ad] = bayt(metin); }
  fs.writeFileSync(yol('scripts', 'sira.txt'), `# scripts/sira.txt — DONDURULMUŞ günlük cevap sırası (satır n = No. n+1). Elle değiştirme;
# kelimeler.mjs çıkarılan kelimenin yerine yenisini koyar, eklenenleri sona yazar. Tohum: ${SIRA_TOHUMU}
${H.sira.join('\n')}
`);
  fs.writeFileSync(yol('scripts', 'rapor.md'), rapor(H, boyut));
  fs.writeFileSync(yol('scripts', 'inceleme.md'), inceleme(H));
  return boyut;
}

function rapor(H, boyut) {
  const t = [];
  const yuzde = (a, b) => (b ? (100 * a / b).toFixed(1) : '0') + '%';
  const madde5 = H.tahminListe.filter((k) => H.tahmin.get(k).kaynak === 'madde').length;
  t.push(`# Kelime hattı raporu`, '', `Üretim: ${new Date().toISOString().slice(0, 10)} · \`node scripts/kelimeler.mjs\``, '');
  t.push('## Sayılar', '', '| | Adet |', '|---|---|');
  t.push(`| TDK maddesi | ${H.maddeler.length} |`);
  t.push(`| Biçimi geçerli madde (özel ad, kısaltma, boşluk, tire, alfabe dışı hariç) | ${H.ozetler.filter((o) => o.gecerli).length} |`);
  t.push(`| 5 harfli madde başı (eş sesliler birleşik) | ${H.bes.length} |`);
  t.push(`| **Cevap** | **${H.cevaplar.length}** |`);
  t.push(`| Cevaplarda mastar (-mak/-mek) | ${H.mastar.length} (${yuzde(H.mastar.length, H.cevaplar.length)}; sınır %10, atılan ${H.mastarAtilan.length}) |`);
  t.push(`| **Tahmin** | **${H.tahminListe.length}** |`);
  t.push(`| · madde başı | ${madde5} |`);
  t.push(`| · çekimli biçim (kök + ek) | ${H.cekimli} (${Object.entries(H.cekimTip).map(([a, b]) => a + ' ' + b).join(', ')}) |`);
  t.push(`| · elle eklenen | ${H.elleTahmin.length} |`);
  t.push(`| Sıklık listesindeki 5 harfli biçim | ${H.sik5.length} |`);
  t.push(`| Ek üretimine giren kök | ${H.kokler.length} (üretilen 5 harfli biçim ${H.uretilen.size}) |`);
  t.push('', '| Dosya | Bayt |', '|---|---|');
  for (const [a, b] of Object.entries(boyut)) t.push(`| data/${a}.js | ${b} |`);
  t.push(`| toplam | ${Object.values(boyut).reduce((a, b) => a + b, 0)} (tahmin sınırı ${BOYUT_SINIRI}) |`, '');

  t.push('## Cevap süzgeci: elenenler', '', '| Neden | Adet | Örnekler |', '|---|---|---|');
  for (const [n, k] of Object.entries(H.cevapNeden).sort((a, b) => b[1] - a[1])) t.push(`| ${n} | ${k} | ${(H.cevapOrnek[n] || []).join(', ')} |`);
  t.push('');
  t.push('## Tahmin süzgeci (madde başı): elenenler', '', '| Neden | Adet |', '|---|---|');
  for (const [n, k] of Object.entries(H.tahminRet)) t.push(`| ${n} | ${k} |`);
  t.push('');

  const cek = H.tahminListe.filter((k) => H.tahmin.get(k).kaynak === 'cekim').sort((a, b) => karma(a) - karma(b)).slice(0, 50);
  t.push('## Örnek 50 çekimli biçim (karma sıralı)', '');
  for (const k of cek) t.push(`- ${aciklama(k, H.tahmin.get(k).analiz)} · sıra ${H.siklik.get(k)}`);
  t.push('');
  const red = H.reddedilen.filter((r) => r.sira <= SIKLIK_SINIRI).slice(0, 50);
  t.push(`## Sıklık listesinde sık geçtiği hâlde reddedilen 50 sözcük (sıra ≤ ${SIKLIK_SINIRI})`, '');
  t.push(`Bu dilimde toplam ${H.reddedilen.filter((r) => r.sira <= SIKLIK_SINIRI).length} ret. Yanlış ret varsa \`elle-ekle.txt\` [tahmin] bölümüne yazılır.`, '');
  t.push('| Sözcük | Sıra | Neden |', '|---|---|---|');
  for (const r of red) t.push(`| ${r.kelime} | ${r.sira} | ${r.neden} |`);
  t.push('');
  const nedenSay = {};
  for (const r of H.reddedilen.filter((r) => r.sira <= SIKLIK_SINIRI)) { const n = r.neden.replace(/ \(.*/, ''); nedenSay[n] = (nedenSay[n] || 0) + 1; }
  t.push('Ret nedenleri (sıra ≤ 20 bin): ' + Object.entries(nedenSay).map(([a, b]) => `${a} ${b}`).join(' · '), '');
  if (H.elleCevapYok.length) t.push(`Uyarı: elle-ekle [cevap]'taki şu kelimeler 5 harfli madde başı değil, cevap olamaz: ${H.elleCevapYok.join(', ')}`, '');
  if (H.cozulemeyenTaki.length) t.push(`Çözülemeyen \`taki\` (${H.cozulemeyenTaki.length}; kök yalın kalır): ${H.cozulemeyenTaki.slice(0, 40).join(', ')}`, '');
  t.push('## Kaynaklar ve lisanslar', '', ...KAYNAK_NOTU.map((s) => '- ' + s), '');
  return t.join('\n');
}

function inceleme(H) {
  const t = [];
  t.push('# Cevap listesi incelemesi', '');
  t.push(`Adaylar: teknik süzgeçleri geçen (5 harf, özel ad/kısaltma değil, kaba/argo/eskimiş değil, söz türü ve tanımı var) ve sıklık sırası ≤ ${SIKLIK_SINIRI} olan madde başları, sıklık sırasıyla, 200'lük bloklar. `
    + '`✗ konu` satırları yasakli-cevap.txt ile, `✗ elle` satırları elle-cikar.txt ile çıkarıldı. Çıkarmak için `scripts/elle-cikar.txt` [cevap] bölümüne, '
    + 'eklemek için `scripts/elle-ekle.txt` [cevap] bölümüne yaz; sonra `node scripts/kelimeler.mjs`.', '');
  t.push(`Toplam aday ${H.adaylar.length} · cevap ${H.cevaplar.length}.`, '');
  const sirali = H.adaylar.slice().sort((a, b) => (a.k.sira ?? 1e9) - (b.k.sira ?? 1e9));
  const satir = ({ g, k }) => {
    const m = k.madde || g.maddeler.find((x) => x.anlam) || g.maddeler[0];
    const isaret = k.kabul ? '' : k.neden === 'konu süzgeci' ? ' · ✗ konu' : ' · ✗ elle';
    return `- ${g.kelime} · ${k.sira ?? '—'} · ${TUR_ADI[m.tur] || ''} · ${kisa(m.anlam)}${/M[AE]K$/.test(g.kelime) ? ' · [mastar]' : ''}${isaret}`;
  };
  for (let i = 0; i < sirali.length; i += 200) {
    const b = sirali.slice(i, i + 200);
    t.push(`## Blok ${i / 200 + 1} · ${i + 1}–${i + b.length}. aday (sıra ${b[0].k.sira}–${b[b.length - 1].k.sira})`, '');
    for (const x of b) t.push(satir(x));
    t.push('');
  }
  t.push(`## 20–30 bin bandı (listede DEĞİL; beğenilen elle-ekle.txt [cevap] ile girer) · ${H.genisBant.length} kelime`, '');
  for (const x of H.genisBant.sort((a, b) => a.k.sira - b.k.sira)) t.push(satir(x).replace(/ · ✗.*$/, ''));
  t.push('');
  return t.join('\n');
}

/* ---------- 4. çalıştır ---------- */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const H = await hat({ yenile: process.argv.includes('--yenile') });
  const boyut = yaz(H);
  console.log(`cevap ${H.cevaplar.length} · tahmin ${H.tahminListe.length} (madde başı ${H.tahminListe.length - H.cekimli - H.elleTahmin.length}, çekimli ${H.cekimli}, elle ${H.elleTahmin.length})`);
  console.log('boyut', boyut, '· sıra', H.eskiSira ? 'güncellendi (dondurulmuş)' : 'ilk kez üretildi');
}
