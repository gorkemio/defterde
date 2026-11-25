// scripts/uret.mjs — havuz üretici (node). Motor dosyalarını tarayıcıyla ortak kullanır.
//   node scripts/uret.mjs            → data/havuz/*.js, docs/havuz-raporu.md, README özeti, engine/difficulty.js KALIBRE bloğu
//   node scripts/uret.mjs --kuru     → yazmadan rapor
// Adımlar: doğru eşitlikler → ters hamle → hızlı çözücüyle sınıflandır → kategori içinde tekilleştir → zorluk (ham)
//          → H0/H1 kalibrasyonu (ham %2/%98) → kategori içi bant eşikleri (çeyrekler) → bant ve şablon dengeli seçim → paketle → rapor
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const Mo = require('../engine/model.js');
const So = require('../engine/solver.js');
const Ai = require('../engine/ai.js');
const D = require('../engine/difficulty.js');
const G = require('../engine/generator.js');

const KURU = process.argv.includes('--kuru');
const TOHUM = 20261020;
const HEDEF = { tek: 8000, iki: 5000, ekle: 2000, cikar: 2000, hepsini: 1500, romen: 500 };
const TOPLA = 3;                         // seçim için hedefin kaç katı aday toplanır
const IKI_BOZMA = 24;                    // eşitlik başına en çok iki çöp bozması (tohumlu örnek)
const t0 = Date.now();
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

/* ---------- 1–3: topla ---------- */
const havuz = {};                        // kategori → Map(kanonik → kayıt)
for (const k of G.KATEGORILER) havuz[k] = new Map();
const islenen = {}, toplamEsitlik = {};
const r = Mo.rng(TOHUM);

function topla(gruplar) {
  // gruplar: [{ kaynak, kategoriler, sablonlar }]
  for (const gr of gruplar) {
    const listeler = gr.sablonlar.map(id => {
      const l = G.dogruEsitlikler(id, { r: Mo.rng(['esitlik', TOHUM, id]) });
      toplamEsitlik[id] = l.length;
      // karıştır
      const rr = Mo.rng(['karistir', TOHUM, gr.kaynak, id]);
      for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
      return { id, l, i: 0 };
    });
    const dolu = () => gr.kategoriler.every(k => havuz[k].size >= HEDEF[k] * TOPLA);
    let tur = 0;
    while (!dolu()) {
      let ilerledi = false;
      for (const L of listeler) {
        if (L.i >= L.l.length) continue;
        ilerledi = true;
        const d = L.l[L.i++];
        islenen[L.id] = (islenen[L.id] || 0) + 1;
        const bozmalar = G.boz(d, G.TERS[gr.kaynak], gr.kaynak === 'iki' ? { enCok: IKI_BOZMA, r } : {});
        for (const b of bozmalar) {
          const sinif = G.siniflandir(b, gr.kaynak);
          for (const k in sinif) {
            if (!gr.kategoriler.includes(k) || havuz[k].size >= HEDEF[k] * TOPLA) continue;
            // romende aynı görünen eşitlik (yalnız boş hücre farkı) tek kayıt
            const anahtar = k === 'romen' ? 'rom:' + Mo.oku(b).metin : Mo.kanonikDize(b);
            if (!havuz[k].has(anahtar)) havuz[k].set(anahtar, { durum: b, sablon: L.id, kaynak: Mo.oku(d).metin, cozum: sinif[k] });
          }
        }
      }
      if (!ilerledi) break;
      if (++tur % 200 === 0) log(`  ${gr.kaynak}: tur ${tur}`, gr.kategoriler.map(k => `${k} ${havuz[k].size}`).join(', '));
    }
    log(`${gr.kaynak}: ${gr.kategoriler.map(k => `${k} ${havuz[k].size}`).join(', ')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}

topla([
  { kaynak: 'tek', kategoriler: ['tek', 'hepsini'], sablonlar: Mo.SABLONLAR },
  { kaynak: 'iki', kategoriler: ['iki'], sablonlar: Mo.SABLONLAR },
  { kaynak: 'ekle', kategoriler: ['ekle'], sablonlar: Mo.SABLONLAR },
  { kaynak: 'cikar', kategoriler: ['cikar'], sablonlar: Mo.SABLONLAR },
  { kaynak: 'romen', kategoriler: ['romen'], sablonlar: Mo.SABLONLAR_ROMEN },
]);

/* ---------- 4: zorluk (ham) ---------- */
const kayitlar = {};
for (const k of G.KATEGORILER) {
  kayitlar[k] = [];
  for (const [anahtar, x] of havuz[k]) {
    const z = D.hesapla(x.durum, k);
    kayitlar[k].push({ anahtar, ...x, ham: z.ham, temel: z.temel, etiket: z.etiket, aday: z.adaySayisi, et: z.etiketler });
  }
  log(`zorluk ${k}: ${kayitlar[k].length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/* ---------- 5: kalibrasyon ---------- */
const yuzdelik = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const tumHam = G.KATEGORILER.flatMap(k => kayitlar[k].map(x => x.ham));
const H0 = +yuzdelik(tumHam, .02).toFixed(4), H1 = +yuzdelik(tumHam, .98).toFixed(4);
const K = { H0, H1, BANT_ESIK: {} };
for (const k of G.KATEGORILER) {
  for (const x of kayitlar[k]) x.puan = D.puanOf(x.ham, K);
  const p = kayitlar[k].map(x => x.puan);
  // çeyrekler; eşitlerde bantlar kayabilir, seçim kotasıyla dengelenir
  K.BANT_ESIK[k] = p.length ? [.25, .5, .75].map(q => Math.round(yuzdelik(p, q) / 2) * 2) : [900, 1100, 1300];
  for (let i = 1; i < 3; i++) if (K.BANT_ESIK[k][i] <= K.BANT_ESIK[k][i - 1]) K.BANT_ESIK[k][i] = K.BANT_ESIK[k][i - 1] + 2;
  for (const x of kayitlar[k]) x.bant = D.bantOf(k, x.puan, K);
}

/* ---------- 6: seçim (bant ve şablon dengeli) ---------- */
const secilen = {};
const eksik = [];
for (const k of G.KATEGORILER) {
  const hedef = HEDEF[k];
  const kota = Math.ceil(hedef / 4);
  secilen[k] = {};
  const artan = [];
  for (const b of D.BANTLAR) {
    const liste = kayitlar[k].filter(x => x.bant === b);
    // şablonlara göre dönüşümlü
    const sablonGrup = new Map();
    const rr = Mo.rng(['sec', TOHUM, k, b]);
    liste.sort(() => 0);
    for (const x of liste) { if (!sablonGrup.has(x.sablon)) sablonGrup.set(x.sablon, []); sablonGrup.get(x.sablon).push(x); }
    for (const g of sablonGrup.values()) for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
    const gruplar = [...sablonGrup.values()];
    const sec = [];
    let i = 0;
    while (sec.length < kota && gruplar.some(g => g.length)) {
      const g = gruplar[i++ % gruplar.length];
      if (g.length) sec.push(g.pop());
    }
    gruplar.forEach(g => artan.push(...g));
    secilen[k][b] = sec;
  }
  // kotası dolmayan bant varsa toplam hedef için diğer bantlardan tamamla (en yakın bant önce)
  let toplam = D.BANTLAR.reduce((s, b) => s + secilen[k][b].length, 0);
  if (toplam < hedef) {
    const rr = Mo.rng(['tamamla', TOHUM, k]);
    for (let i = artan.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [artan[i], artan[j]] = [artan[j], artan[i]]; }
    while (toplam < hedef && artan.length) { const x = artan.pop(); secilen[k][x.bant].push(x); toplam++; }
  }
  // fazlaysa en kalabalık banttan kırp
  while (toplam > hedef) {
    const b = D.BANTLAR.reduce((m, q) => (secilen[k][q].length > secilen[k][m].length ? q : m));
    secilen[k][b].pop(); toplam--;
  }
  if (toplam < hedef) eksik.push(`${k}: ${toplam} / ${hedef}`);
}

/* ---------- 7: paketle ---------- */
const bugun = Mo.yerelTarih();
const paketler = [];
const ozet = createHash('sha256');
if (!KURU) {
  const dizin = join(kok, 'data/havuz');
  mkdirSync(dizin, { recursive: true });
  for (const f of readdirSync(dizin)) if (f.endsWith('.js')) unlinkSync(join(dizin, f));
}
for (const k of G.KATEGORILER) {
  for (const b of D.BANTLAR) {
    const liste = secilen[k][b].slice().sort((x, y) => x.puan - y.puan || (x.anahtar < y.anahtar ? -1 : 1));
    if (!liste.length) continue;
    const sablonlar = [...new Set(liste.map(x => x.sablon))].sort();
    const ad = `${k}-${b}`;
    const govde = liste.map(x => JSON.stringify([sablonlar.indexOf(x.sablon), Mo.maske(x.durum), x.puan, x.etiket])).join(',\n');
    const metin = `// ÜRETİLDİ: node scripts/uret.mjs (${bugun}). Elle düzenleme. Kayıt: [şablon, başlangıç maskesi, puan, etiket bitleri].\n` +
      `(function (v) { if (typeof window !== 'undefined') (window.KB_HAVUZ = window.KB_HAVUZ || {})[v.ad] = v; if (typeof module !== 'undefined' && module.exports) module.exports = v; })({\n` +
      `"ad": ${JSON.stringify(ad)}, "kategori": ${JSON.stringify(k)}, "bant": ${JSON.stringify(b)},\n"sablonlar": ${JSON.stringify(sablonlar)},\n"kayitlar": [\n${govde}\n]});\n`;
    paketler.push({ ad, sayi: liste.length, bayt: Buffer.byteLength(metin) });
    ozet.update(metin);
    if (!KURU) writeFileSync(join(kok, 'data/havuz', ad + '.js'), metin);
  }
}
const sayilar = {};
for (const k of G.KATEGORILER) { sayilar[k] = {}; for (const b of D.BANTLAR) sayilar[k][b] = secilen[k][b].length; }
const toplam = Object.values(sayilar).reduce((s, x) => s + Object.values(x).reduce((a, c) => a + c, 0), 0);
const meta = { uretim: bugun, surum: ozet.digest('hex').slice(0, 10), tohum: TOHUM, sayilar, toplam, paketler: paketler.map(p => p.ad) };
if (!KURU) {
  writeFileSync(join(kok, 'data/havuz/meta.js'), `// ÜRETİLDİ: node scripts/uret.mjs. Elle düzenleme.\n(function (v) { if (typeof window !== 'undefined') window.KB_HAVUZ_META = v; if (typeof module !== 'undefined' && module.exports) module.exports = v; })(${JSON.stringify(meta)});\n`);
  // kalibrasyon tablosunu difficulty.js'e yaz
  const p = join(kok, 'engine/difficulty.js');
  const s = readFileSync(p, 'utf8').replace(/(\/\/ KALIBRE-BAS[^\n]*\n)[\s\S]*?(\n\s*\/\/ KALIBRE-SON)/, `$1  const KALIBRE = ${JSON.stringify(K)};$2`);
  writeFileSync(p, s);
}

/* ---------- 8: rapor ---------- */
const sure = ((Date.now() - t0) / 1000).toFixed(1);
const satir = [];
satir.push(`# Havuz raporu`, '', `Üretim: ${bugun} · tohum ${TOHUM} · ${sure} s (node ${process.version}) · \`node scripts/uret.mjs\``, '');
satir.push(`Toplam **${toplam}** bulmaca. Kalibrasyon: H0 = ${H0}, H1 = ${H1} (ham değerin %2 / %98 yüzdelikleri; puan = 600 + 1600 · sınır((ham − H0)/(H1 − H0))).`, '');
if (eksik.length) satir.push(`**Hedefe ulaşılamayan:** ${eksik.join('; ')}`, '');
satir.push('## Kategori × bant', '', '| Kategori | Hedef | Kolay | Orta | Zor | Çok zor | Toplam | En küçük bant | Bant eşikleri |', '|---|---|---|---|---|---|---|---|---|');
for (const k of G.KATEGORILER) {
  const s = sayilar[k], t = Object.values(s).reduce((a, c) => a + c, 0);
  const enAz = t ? Math.min(...Object.values(s)) / t : 0;
  satir.push(`| ${G.KAT_AD[k]} | ${HEDEF[k]} | ${s.kolay} | ${s.orta} | ${s.zor} | ${s.cokzor} | ${t} | ${(enAz * 100).toFixed(1)} % ${enAz >= .1 ? '✔' : '✖'} | ${K.BANT_ESIK[k].join(' / ')} |`);
}
satir.push('', '## Puan histogramı (seçilen, 100 puanlık kutular)', '', '```');
const tumSec = G.KATEGORILER.flatMap(k => D.BANTLAR.flatMap(b => secilen[k][b]));
const kutu = {};
for (const x of tumSec) { const q = Math.min(2100, Math.floor(x.puan / 100) * 100); kutu[q] = (kutu[q] || 0) + 1; }
const enCok = Math.max(...Object.values(kutu));
for (let q = 600; q <= 2100; q += 100) satir.push(`${String(q).padStart(4)}–${String(q + 99).padEnd(4)} ${String(kutu[q] || 0).padStart(5)} ${'█'.repeat(Math.round(50 * (kutu[q] || 0) / enCok))}`);
satir.push('```', '');
satir.push('## Kategori başına puan dağılımı', '', '| Kategori | en az | %25 | ortanca | %75 | en çok | ort. aday | ort. temel |', '|---|---|---|---|---|---|---|---|');
for (const k of G.KATEGORILER) {
  const l = D.BANTLAR.flatMap(b => secilen[k][b]);
  if (!l.length) continue;
  const p = l.map(x => x.puan);
  satir.push(`| ${G.KAT_AD[k]} | ${Math.min(...p)} | ${yuzdelik(p, .25)} | ${yuzdelik(p, .5)} | ${yuzdelik(p, .75)} | ${Math.max(...p)} | ${(l.reduce((s, x) => s + x.aday, 0) / l.length).toFixed(1)} | ${(l.reduce((s, x) => s + x.temel, 0) / l.length).toFixed(2)} |`);
}
satir.push('', '## Şablon dağılımı', '', '| Şablon | Hücre | Doğru eşitlik | İşlenen | ' + G.KATEGORILER.map(k => G.KAT_AD[k]).join(' | ') + ' |', '|---|---|---|---|' + G.KATEGORILER.map(() => '---').join('|') + '|');
for (const id of [...Mo.SABLONLAR, ...Mo.SABLONLAR_ROMEN]) {
  const c = G.KATEGORILER.map(k => D.BANTLAR.reduce((s, b) => s + secilen[k][b].filter(x => x.sablon === id).length, 0));
  satir.push(`| \`${id}\` | ${Mo.sablon(id).hucreSayisi} | ${toplamEsitlik[id] ?? 0} | ${islenen[id] ?? 0} | ${c.join(' | ')} |`);
}
const kucuk = tumSec.filter(x => Mo.sablon(x.sablon).hucreSayisi <= 6).length;
satir.push('', `Telefon dikey (≤ 6 hücre, çöp ≥ 44 px): ${kucuk} bulmaca (%${(100 * kucuk / toplam).toFixed(1)}).`, '');
satir.push('## Paketler', '', '| Paket | Kayıt | Boyut |', '|---|---|---|');
for (const p of paketler) satir.push(`| \`data/havuz/${p.ad}.js\` | ${p.sayi} | ${(p.bayt / 1024).toFixed(1)} KB |`);
satir.push(`| toplam | ${toplam} | ${(paketler.reduce((s, p) => s + p.bayt, 0) / 1024).toFixed(0)} KB |`, '');
satir.push('## Örnek 10 bulmaca', '', '| Başlangıç | Kategori | Bant | Puan | Çözüm(ler) | Etiketler |', '|---|---|---|---|---|---|');
const rs = Mo.rng(['ornek', TOHUM]);
const ETAD = Object.keys(D.ETIKET);
for (let i = 0; i < 10; i++) {
  const k = ['tek', 'tek', 'tek', 'iki', 'iki', 'ekle', 'cikar', 'hepsini', 'romen', 'tek'][i];
  const b = D.BANTLAR[i % 4];
  const l = secilen[k][b].length ? secilen[k][b] : D.BANTLAR.flatMap(q => secilen[k][q]);
  if (!l.length) continue;
  const x = l[Math.floor(rs() * l.length)];
  const hak = Mo.hakOf(k);
  const coz = So.coz(x.durum, hak).map(g => g.metin);
  const et = ETAD.filter(e => x.etiket & D.ETIKET[e]).join(', ') || '—';
  satir.push(`| \`${Mo.gorunum(Mo.oku(x.durum).metin)}\` | ${G.KAT_AD[k]} | ${D.BANT_AD[x.bant]} | ${x.puan} | \`${coz.map(Mo.gorunum).join('`, `')}\` | ${et} |`);
}
const rapor = satir.join('\n') + '\n';
if (!KURU) {
  mkdirSync(join(kok, 'docs'), { recursive: true });
  writeFileSync(join(kok, 'docs/havuz-raporu.md'), rapor);
  // README özeti
  const rp = join(kok, 'README.md');
  let readme = '';
  try { readme = readFileSync(rp, 'utf8'); } catch (e) { readme = '# Kibrit Bulmacası\n'; }
  const ozet = ['<!-- HAVUZ-BAS -->', `**Havuz** (${bugun}): ${toplam} bulmaca. ` + G.KATEGORILER.map(k => `${G.KAT_AD[k]} ${Object.values(sayilar[k]).reduce((a, c) => a + c, 0)}`).join(' · ') + '. Ayrıntı: [docs/havuz-raporu.md](docs/havuz-raporu.md).', '<!-- HAVUZ-SON -->'].join('\n');
  readme = /<!-- HAVUZ-BAS -->[\s\S]*<!-- HAVUZ-SON -->/.test(readme) ? readme.replace(/<!-- HAVUZ-BAS -->[\s\S]*<!-- HAVUZ-SON -->/, ozet) : readme.trimEnd() + '\n\n' + ozet + '\n';
  writeFileSync(rp, readme);
}
process.stdout.write(rapor);
log(`bitti: ${sure} s`);
