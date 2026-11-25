#!/usr/bin/env node
// scripts/hazirla.mjs — YALNIZ geliştirme sırasında çalışır. Ham kaynakları indirir, süzer, data/*.js üretir.
//
//   node scripts/hazirla.mjs [--yenile] [--gunluk]
//     --yenile  ham dosyaları yeniden indir (varsayılan: ham/ altında varsa dokunma)
//     --gunluk  data/gunluk.js'i yeniden üret (varsayılan: varsa dokunma; günün kelimesi havuzu DONDURULMUŞTUR)
//
// Girdi : ham/tdk/gts.json (TDK Güncel Türkçe Sözlük 12. baskı, satır satır JSON) · ham/siklik/tr_50k.txt
// Çıktı : data/sozluk.js · data/kategoriler.js · data/atasozleri.js · data/gunluk.js · scripts/rapor.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tr, degerlendir, sozlukKur, siraBul, puanla, bantBul } from './filtre.mjs';
import { SEHIRLER, sehirIpucu, ULKELER, ulkeIpucu, KATEGORILER } from './kaynak/kategoriler.mjs';
import { ATASOZLERI } from './kaynak/atasozleri.mjs';
import { COCUK } from './kaynak/cocuk.mjs';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = new Set(process.argv.slice(2));
const TDK_URL = 'https://raw.githubusercontent.com/ogun/guncel-turkce-sozluk/master/sozluk/v12/v12.gts.json.tar.gz';
const SIKLIK_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/tr/tr_50k.txt';
const BUTCE = { toplam: 3_000_000, sozluk: 2_600_000 };
const GUNLUK_ADET = 1500;
const yol = (...p) => path.join(kok, ...p);
const bayt = (s) => Buffer.byteLength(s, 'utf8');
const tarih = new Date().toISOString().slice(0, 10);

/* ---------- 1. ham dosyalar ---------- */

async function indir(url, hedef) {
  console.log('indiriliyor:', url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  fs.writeFileSync(hedef, Buffer.from(await r.arrayBuffer()));
}

async function hamHazirla() {
  const json = yol('ham', 'tdk', 'gts.json'), tgz = yol('ham', 'tdk', 'v12.gts.json.tar.gz'), sk = yol('ham', 'siklik', 'tr_50k.txt');
  if (arg.has('--yenile') || (!fs.existsSync(json) && !fs.existsSync(tgz))) await indir(TDK_URL, tgz);
  if (arg.has('--yenile') || !fs.existsSync(json)) {
    const uyeler = execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' }).split('\n').filter(Boolean);
    if (uyeler.length !== 1 || !/^[\w.-]+\.json$/.test(uyeler[0])) throw new Error('Beklenmeyen arşiv içeriği: ' + uyeler.join(', '));
    execFileSync('tar', ['-xzf', tgz, '-C', path.dirname(tgz), uyeler[0]]);
    if (uyeler[0] !== 'gts.json') fs.renameSync(path.join(path.dirname(tgz), uyeler[0]), json);
  }
  if (arg.has('--yenile') || !fs.existsSync(sk)) await indir(SIKLIK_URL, sk);
  return { json, sk };
}

function maddeleriOku(dosya) {
  const metin = fs.readFileSync(dosya, 'utf8');
  if (metin.trimStart().startsWith('[')) return JSON.parse(metin);            // tek dizi
  return metin.split('\n').filter(Boolean).map((s) => JSON.parse(s));         // satır satır JSON (v12'nin biçimi)
}

// "kelime sayı" satırları → Map<normalize kelime, sıra>. Aynı normalize biçimin sayıları toplanır (İyi + iyi + îyi).
function siklikOku(dosya) {
  const sayim = new Map();
  let satirSayisi = 0, atilan = 0;
  for (const satir of fs.readFileSync(dosya, 'utf8').split('\n')) {
    const i = satir.lastIndexOf(' ');
    if (i < 1) continue;
    satirSayisi++;
    const sayi = Number(satir.slice(i + 1));
    const n = tr.normalize(satir.slice(0, i));
    if (!Number.isFinite(sayi) || !Array.from(n).every((c) => tr.ALFABE.includes(c))) { atilan++; continue; }
    sayim.set(n, (sayim.get(n) || 0) + sayi);
  }
  const sirali = [...sayim.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return { siklik: new Map(sirali.map(([k], i) => [k, i + 1])), satirSayisi, atilan, tekil: sayim.size };
}

// scripts/karaliste.txt ve scripts/izinli.txt: satır başına bir kelime, '#' sonrası açıklama.
// karaliste'de "tecavüz*" gibi önekler de yazılabilir (türevleri de çıkarır). Döner: { has(kelime), size }
function listeOku(ad) {
  const d = yol('scripts', ad);
  const satirlar = (fs.existsSync(d) ? fs.readFileSync(d, 'utf8').split('\n') : []).map((s) => s.replace(/#.*/, '').trim()).filter(Boolean);
  const tam = new Set(), onek = [];
  for (const s of satirlar) (s.endsWith('*') ? onek.push(tr.normalize(s.slice(0, -1))) : tam.add(tr.normalize(s)));
  return { has: (k) => tam.has(k) || onek.some((p) => k.startsWith(p)), size: tam.size + onek.length };
}

/* ---------- 2. kategoriler ---------- */

// Kategori kelimelerini TDK'ya karşı doğrular. TDK'da özel adlar da aranır (İstanbul gibi): ozelAdIzin.
function kategorileriKur(maddeler, karaliste, siklik, izinli, tanimlar) {
  const harita = new Map();                       // normalize kelime → { anlam, tur, eski, ozel, kac, gonderme }
  const tercih = (x) => (x.ozel ? 1e6 : 0) + (x.gonderme ? 1e3 : 0) + x.kac;   // küçük = tercih: ortak ad, gerçek tanım, ilk eş sesli
  const icerikElenen = new Map();                 // normalize kelime → neden
  for (const m of maddeler) {
    const s = degerlendir(m, { karaliste, ozelAdIzin: true, izinli });
    if (!s.kabul) { if (s.icerik) icerikElenen.set(s.kelime, s.neden); continue; }
    const k = { ...s.kayit, ozel: String(m.ozel_mi) === '1' };
    const eski = harita.get(k.kelime);
    if (!eski || tercih(k) < tercih(eski)) harita.set(k.kelime, k);
  }

  const sehirIp = new Map(SEHIRLER.map((r) => [tr.normalize(r[1]), sehirIpucu(r)]));
  const ulkeIp = new Map(ULKELER.map((r) => [tr.normalize(r[0]), ulkeIpucu(r)]));
  const listeler = {
    Şehirler: { kelimeler: SEHIRLER.map((r) => r[1]), ipucu: sehirIp },
    Ülkeler: { kelimeler: ULKELER.map((r) => r[0]), ipucu: ulkeIp },
  };
  for (const [ad, k] of Object.entries(KATEGORILER)) listeler[ad] = { kelimeler: k, ipucu: null };

  const cikti = {}, rapor = [];
  for (const [ad, { kelimeler, ipucu }] of Object.entries(listeler)) {
    const satirlar = [], gorulen = new Set();
    const r = { ad, yazilan: 0, alinan: 0, tdkYok: [], sakincali: [], gecersiz: [], tekrar: 0, bant: { k: 0, o: 0, z: 0 } };
    for (const w of kelimeler) {
      r.yazilan++;
      const key = tr.normalize(w);
      if (!tr.gecerliKelime(key)) { r.gecersiz.push(w); continue; }
      if (gorulen.has(key)) { r.tekrar++; continue; }
      gorulen.add(key);
      if (icerikElenen.has(key) && !harita.has(key)) { r.sakincali.push(`${w} (${icerikElenen.get(key)})`); continue; }
      const tdk = harita.get(key);
      const ozelIp = ipucu && ipucu.get(key);
      if (!tdk) r.tdkYok.push(w);
      if (!tdk && !ozelIp) continue;                                  // TDK'da yok ve kendi ipucumuz da yok → alınmaz
      const tur = tdk && ozelIp == null ? tdk.tur : 'a';
      const sira = siraBul(key, tur, siklik);
      const eski = !!(tdk && tdk.eski && !ozelIp);
      r.alinan++;
      satirlar.push([key, ozelIp || tanimlar.get(ad + '/' + key) || tanimlar.get(key) || tdk.anlam, null, puanla(key, sira), eski]);
    }
    // Kategori içinde bant = zorluk puanına göre üçte birlik dilimler (en kolay %34 kolay, sonraki %33 orta, gerisi zor);
    // eskimiş kelimeler her zaman zor. Sözlük bantları sıklığa bakar, ama kategori seçen oyuncu için "bilinen kelime" zaten
    // kategoridir; sıklıkla bantlamak Şehirler'de yalnız 2 kolay kelime bırakıyordu.
    const sirali = satirlar.slice().sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : 1));
    const kolayAdet = Math.ceil(sirali.length * 0.34), ortaAdet = Math.ceil(sirali.length * 0.33);
    sirali.forEach((x, i) => { x[2] = x[4] ? 'z' : i < kolayAdet ? 'k' : i < kolayAdet + ortaAdet ? 'o' : 'z'; r.bant[x[2]]++; });
    satirlar.forEach((x) => x.pop());
    satirlar.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    cikti[ad] = satirlar;
    rapor.push(r);
  }
  return { cikti, rapor };
}

/* ---------- 3. atasözleri ---------- */

function atasozleriKur() {
  const gorulen = new Set(), satirlar = [], sorunlu = [];
  for (const [soz, aciklama] of ATASOZLERI) {
    const n = tr.normalize(soz);
    if (!tr.gecerliSoz(soz)) { sorunlu.push(`${soz} (biçim/uzunluk)`); continue; }
    if (Array.from(aciklama).length > 120) { sorunlu.push(`${soz} (açıklama > 120)`); continue; }
    if (gorulen.has(n)) { sorunlu.push(`${soz} (tekrar)`); continue; }
    gorulen.add(n);
    satirlar.push([n, aciklama]);
  }
  return { satirlar, sorunlu };
}

/* ---------- 4. dosya yazımı ---------- */

const KAYNAK_NOTU = [
  '// Tanımlar: TDK Güncel Türkçe Sözlük (12. baskı), github.com/ogun/guncel-turkce-sozluk (MIT) üzerinden.',
  '// Sıklık sırası: hermitdave/FrequencyWords, OpenSubtitles 2018 Türkçe listesi (içerik CC BY-SA 4.0); yalnız sıra numarası kullanılır.',
];

function jsDosya(degisken, baslik, govde) {
  return [
    `// data/${degisken}.js — ÜRETİLDİ (node scripts/hazirla.mjs, ${tarih}). Elle düzenleme: kaynak scripts/ altındadır.`,
    ...baslik,
    '(function () {',
    "  'use strict';",
    `  const veri = ${govde};`,
    "  if (typeof window !== 'undefined') { const AA = (window.AA = window.AA || {}); (AA.veri = AA.veri || {}).%D = veri; }".replace('%D', degisken),
    "  if (typeof module !== 'undefined' && module.exports) module.exports = veri;",
    '})();',
    '',
  ].join('\n');
}
const satirSatir = (liste) => '[\n' + liste.map((r) => JSON.stringify(r)).join(',\n') + '\n  ]';
const sozlukSatiri = (k) => [k.kelime, k.anlam, k.tur, k.bant, k.puan, k.sira];

/* ---------- 5. çalıştır ---------- */

const t0 = Date.now();
const { json, sk } = await hamHazirla();
const maddeler = maddeleriOku(json);
const { siklik, satirSayisi, atilan, tekil } = siklikOku(sk);
const karaliste = listeOku('karaliste.txt'), izinli = listeOku('izinli.txt');
// scripts/tanim-duzelt.txt: "kelime = tanım" satırları
const tanimlar = new Map();
for (const s of fs.readFileSync(yol('scripts', 'tanim-duzelt.txt'), 'utf8').split('\n')) {
  const t = s.trim(), i = t.indexOf('=');
  if (!t || t.startsWith('#') || i < 1) continue;
  const anlam = t.slice(i + 1).trim();
  if (Array.from(anlam).length > 120) throw new Error('tanim-duzelt: 120 karakteri aşıyor: ' + t);
  // "Kategori/kelime = tanım" yalnız o kategoride; "kelime = tanım" her yerde geçerlidir
  const sol = t.slice(0, i).trim(), ayrac = sol.indexOf('/');
  tanimlar.set(ayrac > 0 ? sol.slice(0, ayrac).trim() + '/' + tr.normalize(sol.slice(ayrac + 1)) : tr.normalize(sol), anlam);
}
console.log(`TDK: ${maddeler.length} madde · sıklık: ${satirSayisi} satır → ${tekil} tekil biçim · karaliste: ${karaliste.size} · izinli: ${izinli.size}`);

const cocuk = new Set(COCUK.map((w) => tr.normalize(w)));
const sonuc = sozlukKur(maddeler, { karaliste, siklik, izinli, cocuk, tanimlar });
let kayitlar = sonuc.kayitlar;
const toplamKelime = kayitlar.length;

// kök eşleşmesiyle sırası iyileşen fiiller (rapor için)
const kokleIyilesen = kayitlar.filter((k) => k.tur === 'f' && k.sira != null && (siklik.get(k.kelime) ?? Infinity) > k.sira).length;

// kategoriler ve atasözleri
const kat = kategorileriKur(maddeler, karaliste, siklik, izinli, tanimlar);
const ata = atasozleriKur();

// Kategori listelerinde gözden geçirilmiş (ya da elle düzeltilmiş) tanım, kelime tek bir kategoride geçiyorsa genel sözlükte de kullanılır.
// İki kategoride farklı anlamlarla geçen kelimeler (kupa, kivi, kaptan…) sözlükte TDK'nın ilk anlamında kalır.
{
  const katAnlam = new Map();
  for (const [ad, satirlar] of Object.entries(kat.cikti)) {
    if (ad === 'Şehirler' || ad === 'Ülkeler') continue;
    for (const [w, a] of satirlar) { if (!katAnlam.has(w)) katAnlam.set(w, new Set()); katAnlam.get(w).add(a); }
  }
  for (const k of kayitlar) { const s = katAnlam.get(k.kelime); if (s && s.size === 1 && !tanimlar.has(k.kelime)) k.anlam = [...s][0]; }
}
const katDosya = jsDosya('kategoriler', [
  '// Kayıt: [kelime, ipucu/anlam, bant, zorluk puanı]. Şehirler ve Ülkeler için ipucu elle yazılmıştır; diğerlerinde TDK tanımı.',
  ...KAYNAK_NOTU,
], '{\n' + Object.entries(kat.cikti).map(([ad, s]) => `  ${JSON.stringify(ad)}: ${satirSatir(s)}`).join(',\n') + '\n  }');
const ataDosya = jsDosya('atasozleri', [
  '// Kayıt: [söz (normalize, noktalamasız), kısa açıklama]. Atasözleri ve deyimler halk malıdır; açıklamalar bu projeye aittir.',
], satirSatir(ata.satirlar));

// bütçe: sozluk.js ≤ 2,6 MB ve dört dosya ≤ 3 MB. Aşılırsa sıklık listesinde olmayanlar (en zordan başlayarak), sonra en seyrekler düşer.
const sozlukBaslik = [
  '// Kayıt: [kelime, anlam, tür, bant, zorluk puanı, sıklık sırası | null]',
  '//   tür: a isim · s sıfat · f fiil · z zarf · e edat · b bağlaç · ü ünlem · m zamir     bant: k kolay · o orta · z zor',
  ...KAYNAK_NOTU,
];
const sozlukDosya = (liste) => jsDosya('sozluk', sozlukBaslik, satirSatir(liste.map(sozlukSatiri)));
const digerBayt = bayt(katDosya) + bayt(ataDosya) + 400_000;                  // gunluk.js için pay
let dusen = 0;
{
  const hedef = Math.min(BUTCE.sozluk, BUTCE.toplam - digerBayt);
  let boyut = bayt(sozlukDosya(kayitlar));
  if (boyut > hedef) {
    const oncelik = (k) => (k.sira == null ? 1e9 + k.puan : k.sira);          // büyük = önce düşer: sıklıksızlar (en zordan), sonra en seyrekler
    const at = new Set();
    for (const k of kayitlar.slice().sort((a, b) => oncelik(b) - oncelik(a))) {
      if (boyut <= hedef) break;
      at.add(k.kelime);
      boyut -= bayt(JSON.stringify(sozlukSatiri(k))) + 2;                      // satır + ",\n"
    }
    kayitlar = kayitlar.filter((k) => !at.has(k.kelime));
    dusen = at.size;
  }
}
const sozlukMetin = sozlukDosya(kayitlar);

// günün kelimesi havuzu: bir kez üretilir ve dondurulur
const gunlukYol = yol('data', 'gunluk.js');
let gunlukMetin = null, gunlukYeni = false;
if (arg.has('--gunluk') || !fs.existsSync(gunlukYol)) {
  const karma = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // Herkese aynı kelime verileceği için havuz sıkıdır: çocuk listesi ya da ilk 8 bindeki orta kelimeler; gerçek bir tanımı olmalı
  // ("Koymak işi", "… sözcüğüyle aynı anlamda" gibi tanımlar olmaz).
  const adaylar = kayitlar.filter((k) => (k.bant === 'k' || (k.bant === 'o' && k.sira != null && k.sira <= 8000)) && (k.tur === 'a' || k.tur === 's')
    && !k.gonderme && !/(işi|durumu|aynı anlamda|olma)\s*$/.test(k.anlam) && Array.from(k.anlam).length >= 8 && k.kelime.length >= 4 && k.kelime.length <= 9);
  const havuz = adaylar.sort((a, b) => karma(a.kelime) - karma(b.kelime) || (a.kelime < b.kelime ? -1 : 1)).slice(0, GUNLUK_ADET).map((k) => k.kelime);
  gunlukMetin = jsDosya('gunluk', [
    '// Günün kelimesi havuzu: DONDURULMUŞTUR (sözlük yenilense de değişmez). Yenilemek için: node scripts/hazirla.mjs --gunluk',
    '// Kayıt: kelime. Kolay (çocuk listesi) ya da ilk 8 bin sıklıktaki orta bant; isim ya da sıfat; 4–9 harf; gerçek tanımlı.',
  ], '[\n' + JSON.stringify(havuz).slice(1, -1).replace(/","/g, '",\n"') + '\n  ]');
  gunlukYeni = true;
}

fs.mkdirSync(yol('data'), { recursive: true });
fs.writeFileSync(yol('data', 'sozluk.js'), sozlukMetin);
fs.writeFileSync(yol('data', 'kategoriler.js'), katDosya);
fs.writeFileSync(yol('data', 'atasozleri.js'), ataDosya);
if (gunlukMetin) fs.writeFileSync(gunlukYol, gunlukMetin);

/* ---------- 6. rapor ---------- */

const gunlukBayt = fs.statSync(gunlukYol).size;
const toplamBayt = bayt(sozlukMetin) + bayt(katDosya) + bayt(ataDosya) + gunlukBayt;
const bantSay = { k: 0, o: 0, z: 0 }, turSay = {}, bantTur = {};
let siraliSay = 0, gizliSay = 0, gondermeSay = 0;
for (const k of kayitlar) {
  bantSay[k.bant]++; turSay[k.tur] = (turSay[k.tur] || 0) + 1; if (k.sira != null) siraliSay++;
  if (k.gizli) gizliSay++; if (k.gonderme) gondermeSay++;
  bantTur[k.bant + k.kelime.length] = (bantTur[k.bant + k.kelime.length] || 0) + 1;
}
const etiketSay = {};
for (const m of maddeler) for (const a of m.anlamlarListe || []) for (const o of a.ozelliklerListe || []) if (o.tur === '4') etiketSay[o.tam_adi] = (etiketSay[o.tam_adi] || 0) + 1;

// deterministik örnekler (tohumlu karışım): her banttan 30 kelime
const karmaR = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ornek = (bant, n) => kayitlar.filter((k) => k.bant === bant).sort((a, b) => karmaR('ornek' + a.kelime) - karmaR('ornek' + b.kelime)).slice(0, n);
const satir = (...h) => '| ' + h.join(' | ') + ' |';
const s = (n) => n.toLocaleString('tr-TR');
const elenenToplam = Object.values(sonuc.elenen).reduce((a, b) => a + b, 0);
const R = [];
R.push('# Veri raporu', '', `Son çalıştırma: ${tarih} · \`node scripts/hazirla.mjs\``, '');
R.push('## Kaynak ve elenme', '');
R.push(`- TDK maddesi: **${s(maddeler.length)}** (12. baskı)`);
R.push(`- Elenen madde: **${s(elenenToplam)}** · kabul edilen madde: **${s(sonuc.kabulMadde)}** (toplam ${s(elenenToplam + sonuc.kabulMadde)})`);
R.push(`- Eş sesli birleşme: kabul edilen maddeler **${s(sonuc.benzersiz)}** benzersiz kelimeye indi (${s(sonuc.birlesen)} madde başka maddeyle birleşti); ardından kardeşi kaba/hakaret etiketli olanlar ve sıklıksız göndermeler çıktı.`);
R.push(`- Oyuna giren sözlük: **${s(kayitlar.length)}** kelime` + (dusen ? ` (bütçe için ${s(dusen)} sıklıksız/seyrek kelime düşürüldü)` : ' (bütçe aşılmadı, hiçbiri düşürülmedi)'));
R.push('', '| Eleme nedeni (ilk tutan) | Madde | Örnekler |', '|---|---:|---|');
for (const [n, v] of Object.entries(sonuc.elenen).sort((a, b) => b[1] - a[1])) R.push(satir(n, s(v), (sonuc.ornekler[n] || []).slice(0, 6).join(', ')));
const cocukBulunan = kayitlar.filter((k) => cocuk.has(k.kelime)), cocukKolay = cocukBulunan.filter((k) => k.bant === 'k');
const cocukYok = [...cocuk].filter((w) => !kayitlar.some((k) => k.kelime === w));
R.push('', '## Bantlar', '', `Kolay band = elle yazılan çocuk listesi (${s(cocuk.size)} kelime) ∩ TDK; 4–7 harfli isim/sıfat/fiil olanlar: **${s(cocukKolay.length)}**. Listede olup kolay olamayanlar (3 harf, 8+ harf, zarf vb.) orta/zor'a düşer; listede olup sözlüğe girmeyenler (TDK'da tek sözcük değil, uzunluk, filtre): ${s(cocukYok.length)} → ${cocukYok.join(', ')}`, '');
R.push(satir('Bant', 'Kelime'), satir('---', '---:'));
R.push(satir('kolay', s(bantSay.k)), satir('orta', s(bantSay.o)), satir('zor', s(bantSay.z)), satir('**toplam**', s(kayitlar.length)));
R.push('', `Söz türü: ${Object.entries(turSay).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t} ${s(v)}`).join(' · ')}`);
R.push('', `Sıklık listesi: ${s(satirSayisi)} satır → ${s(tekil)} tekil biçim (${s(atilan)} satır alfabe dışı olduğu için atıldı). ` +
  `Sözlükte sıklığı bulunan: **${s(siraliSay)}**, bulunmayan: **${s(kayitlar.length - siraliSay)}**. ` +
  `Kök eşleşmesiyle sırası iyileşen fiil: ${s(kokleIyilesen)}.`);
R.push(`İkincil anlamında argo/kaba/alay etiketi olup **kelimesi kalan** (o anlam gizlenir): ${s(gizliSay)}. Yalnız ► göndermesiyle tanımlanıp kalan: ${s(gondermeSay)}.`);
R.push('', '## Boyutlar', '', satir('Dosya', 'Bayt'), satir('---', '---:'));
R.push(satir('data/sozluk.js', s(bayt(sozlukMetin))), satir('data/kategoriler.js', s(bayt(katDosya))), satir('data/atasozleri.js', s(bayt(ataDosya))),
  satir('data/gunluk.js' + (gunlukYeni ? ' (yeni)' : ' (dondurulmuş)'), s(gunlukBayt)), satir('**toplam**', `**${s(toplamBayt)}** (sınır ${s(BUTCE.toplam)})`));
R.push('', '## Kategoriler', '', satir('Kategori', 'Yazılan', 'Alınan', 'TDK\'da yok', 'Sakıncalı', 'kolay', 'orta', 'zor'), satir('---', '---:', '---:', '---:', '---:', '---:', '---:', '---:'));
for (const r of kat.rapor) R.push(satir(r.ad, r.yazilan, r.alinan, r.tdkYok.length, r.sakincali.length, r.bant.k, r.bant.o, r.bant.z));
R.push('', '### TDK listesinde bulunamayanlar (yazım hatası ya da özel ad?)', '');
for (const r of kat.rapor) {
  if (r.tdkYok.length) R.push(`- **${r.ad}** (${r.tdkYok.length}): ${r.tdkYok.join(', ')}` + (['Şehirler', 'Ülkeler'].includes(r.ad) ? ' — özel ad, beklenen; kendi ipucuyla alındı' : ' — **oyuna alınmadı**'));
  if (r.sakincali.length) R.push(`- **${r.ad}** sakıncalı etiket nedeniyle çıkarıldı: ${r.sakincali.join(', ')}`);
  if (r.gecersiz.length) R.push(`- **${r.ad}** geçersiz (uzunluk/alfabe): ${r.gecersiz.join(', ')}`);
  if (r.tekrar) R.push(`- **${r.ad}**: ${r.tekrar} tekrar atıldı`);
}
R.push('', `## Atasözleri ve deyimler: ${ata.satirlar.length}` + (ata.sorunlu.length ? ` (atılan: ${ata.sorunlu.join('; ')})` : ''), '');
R.push('## TDK kullanım etiketleri (tur 4)', '', satir('Etiket', 'Anlam sayısı', 'Kural'), satir('---', '---:', '---'));
const kural = { 'kaba konuşmada': 'kelime çıkar (her anlamda)', 'hakaret yollu': 'kelime çıkar (her anlamda)', argo: 'ana anlamda çıkar; ikincilde anlam gizlenir',
  'alay yollu': 'ana anlamda çıkar; ikincilde anlam gizlenir', eskimiş: 'ana anlamda → yalnız zor', ağızlardan: 'ana anlamda → yalnız zor', 'halk ağzında': 'ana anlamda → yalnız zor' };
for (const [e, v] of Object.entries(etiketSay).sort((a, b) => b[1] - a[1])) R.push(satir(e, s(v), kural[e] || 'etkisiz'));
for (const b of ['k', 'o', 'z']) {
  R.push('', `## Örnek: ${{ k: 'kolay', o: 'orta', z: 'zor' }[b]} (30 deterministik örnek)`, '');
  for (const k of ornek(b, 30)) R.push(`- **${k.kelime}** (${k.tur}, sıra ${k.sira ?? '–'}): ${k.anlam}`);
}
fs.writeFileSync(yol('scripts', 'rapor.md'), R.join('\n') + '\n');

console.log(`\nbitti (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
console.log(`sözlük: ${s(kayitlar.length)} kelime · kolay ${bantSay.k} · orta ${bantSay.o} · zor ${bantSay.z}`);
console.log(`dosyalar: sozluk ${s(bayt(sozlukMetin))} · kategoriler ${s(bayt(katDosya))} · atasözleri ${s(bayt(ataDosya))} · günlük ${s(gunlukBayt)} · toplam ${s(toplamBayt)}`);
console.log('rapor: scripts/rapor.md');
