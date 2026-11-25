// scripts/resimler.mjs — resim içerik hattı (node, geliştirme):
//   1. ipuçlarını hesaplar, tekilliği kontrol eder · 2. tek çözümlü değilse ya da tahmin gerektiriyorsa önce resmi en az
//   bozan 1–2 karelik düzeltmeler önerir, sonra hedef banda göre en az başlangıç karesini seçer · 3. zorluk bandını hesaplar ·
//   4. raporlar (bant dağılımı, başlangıç karesi gerekenler, reddedilenler) · 5. --temas: bütün resimleri siyah-beyaz ve
//   renkli hâlleriyle tek bir temas kağıdına (docs/temas.html) basar.
// Kullanım: node scripts/resimler.mjs [--kategori mutfak] [--temas] [--kuru] [--oneri]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require(join(kok, 'nonogram/model.js'));
const S = require(join(kok, 'nonogram/solver.js'));
const D = require(join(kok, 'nonogram/difficulty.js'));
const K = require(join(kok, 'nonogram/kilim.js'));
const C = require(join(kok, 'config.js'));

const arg = process.argv.slice(2), bayrak = (b) => arg.includes(b), deger = (b) => { const i = arg.indexOf(b); return i >= 0 ? arg[i + 1] : null; };

// Tarayıcı veri dosyalarını sanal bir window'da çalıştır
export function veriYukle() {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(kok, 'data/defterler.js'), 'utf8'), ctx);
  for (const f of readdirSync(join(kok, 'data/resimler')).filter(f => f.endsWith('.js')).sort()) vm.runInContext(readFileSync(join(kok, 'data/resimler', f), 'utf8'), ctx, { filename: f });
  let hesap = {};
  try { vm.runInContext(readFileSync(join(kok, 'data/hesap.js'), 'utf8'), ctx); hesap = ctx.KK_HESAP || {}; } catch (e) { /* yok */ }
  return { defterler: ctx.KK_DEFTERLER, resimler: ctx.KK_RESIMLER || {}, hesap };
}

const PALET = { siyah: '#2b2b2b', gri: '#8d8d8d', kahve: '#6b4423', kirmizi: '#a8322d', turuncu: '#e07a1f', hardal: '#c9a227', acikyesil: '#7dbb57', koyuyesil: '#2e7d32', acikmavi: '#5dade2', lacivert: '#23395d', mor: '#6a4c93', pembe: '#e8a0bf', krem: '#f3e8d0' };
const BANT = ['kolay', 'orta', 'zor', 'uzman'];
export const hedefBant = (r) => { const n = Math.max(r.en, r.boy); return n <= 5 ? 'kolay' : n <= 10 ? 'orta' : n <= 15 ? 'zor' : 'uzman'; };
export const imza = (r) => K.karma('resim', r.en, r.boy, r.satirlar.join('/')).toString(36);

// Biçim doğrulaması → hata listesi
export function dogrula(r, defterIdleri, idler) {
  const h = [];
  if (!r.id || !/^[a-z0-9-]+$/.test(r.id)) h.push('id küçük harf, rakam ve tire olmalı');
  if (idler.has(r.id)) h.push('id tekrar ediyor'); idler.add(r.id);
  if (!r.ad || !/^[A-ZÇĞİÖŞÜ]/.test(r.ad)) h.push('ad büyük harfle başlayan Türkçe ad olmalı');
  if (!defterIdleri.has(r.kategori)) h.push(`bilinmeyen kategori ${r.kategori}`);
  if (!Array.isArray(r.satirlar) || r.satirlar.length !== r.boy) h.push(`satır sayısı ${r.satirlar && r.satirlar.length} ≠ ${r.boy}`);
  else r.satirlar.forEach((s, i) => { if (s.length !== r.en) h.push(`${i + 1}. satır ${s.length} kare ≠ ${r.en}`); for (const ch of s) if (ch !== '.' && !(r.palet && r.palet[ch])) h.push(`${i + 1}. satırda paletsiz harf "${ch}"`); });
  for (const [k, v] of Object.entries(r.palet || {})) if (!PALET[v]) h.push(`palet ${k}: bilinmeyen renk ${v}`);
  if (r.arkaPlan && r.arkaPlan.renk && !PALET[r.arkaPlan.renk]) h.push('arka plan rengi bilinmiyor');
  return [...new Set(h)];
}

export function isle(r) {
  const b = M.bulmacaYap({ id: r.id, en: r.en, boy: r.boy, satirlar: r.satirlar });
  const hedef = hedefBant(r);
  const t = S.tekillik(b, { dugumButcesi: 50000 });
  const sonuc = { id: r.id, en: r.en, boy: r.boy, hedef, tekillik: t.sonuc, oneri: [], baslangic: [], ret: null };
  // boş satır/sütun uyarısı
  const bosSatir = b.ipuclari.satir.filter(x => x[0] === 0).length, bosSutun = b.ipuclari.sutun.filter(x => x[0] === 0).length;
  if (bosSatir + bosSutun > Math.max(r.en, r.boy) * .4) sonuc.uyari = `${bosSatir} boş satır, ${bosSutun} boş sütun`;
  let dr = t.sonuc === 'tek' ? D.derece(b, { sinir: hedef }) : null;
  if (t.sonuc !== 'tek' || dr.bant === 'tahmin') {
    if (t.sonuc === 'cok' && (bayrak('--oneri') || bayrak('--temas'))) sonuc.oneri = D.duzeltmeOner(b, { enCok: 3 });
    const o = D.baslangicOner(b, { hedefBant: hedef, dugumButcesi: 50000, enCok: 60 });
    if (!o) { sonuc.ret = 'başlangıç kareleriyle de çözülemedi'; return sonuc; }
    sonuc.baslangic = o.baslangic.map(k => [k.r, k.c, k.v]);
    dr = o.derece;
    if (sonuc.baslangic.length > Math.ceil(r.en * r.boy * .04)) sonuc.ret = `${sonuc.baslangic.length} başlangıç karesi gerekiyor (sınır %4)`;
  }
  const tam = D.derece(Object.assign({}, b, { baslangic: sonuc.baslangic.map(([a, c, v]) => ({ r: a, c, v })) }));
  Object.assign(sonuc, { bant: tam.bant, puan: tam.puan, adim: tam.adim, teknikler: tam.teknikler, imza: imza(r) });
  if (BANT.indexOf(tam.bant) > BANT.indexOf(hedef) || tam.bant === 'tahmin') sonuc.ret = sonuc.ret || `bant ${tam.bant} hedefi (${hedef}) aşıyor`;
  return sonuc;
}

function hesapYaz(sonuclar) {
  const satirlar = sonuclar.filter(s => !s.ret).sort((a, b) => a.id.localeCompare(b.id)).map(s => {
    const o = { bant: s.bant, puan: s.puan, adim: s.adim, teknikler: s.teknikler, baslangic: s.baslangic, imza: s.imza };
    return `  ${JSON.stringify(s.id)}: ${JSON.stringify(o)},`;
  });
  const metin = `// data/hesap.js — scripts/resimler.mjs üretir; elle düzenleme. Resim başına bant, puan, adım, teknikler, başlangıç kareleri [r, c, değer], imza.\n(typeof window !== 'undefined' ? window : globalThis).KK_HESAP = {\n${satirlar.join('\n')}\n};\n`;
  writeFileSync(join(kok, 'data/hesap.js'), metin);
}

function rapor(veri, sonuclar, hatalar) {
  const s = [], say = {}, boyBant = {};
  for (const x of sonuclar) {
    if (x.ret) continue;
    const r = veri.harita.get(x.id);
    say[r.kategori] = say[r.kategori] || {}; say[r.kategori][x.bant] = (say[r.kategori][x.bant] || 0) + 1;
    const k = `${x.en}×${x.boy}`; boyBant[k] = boyBant[k] || {}; boyBant[k][x.bant] = (boyBant[k][x.bant] || 0) + 1;
  }
  s.push(`# Resim raporu (${new Date().toISOString().slice(0, 10)})`, '');
  const gecen = sonuclar.filter(x => !x.ret);
  s.push(`Toplam ${sonuclar.length} resim · geçen ${gecen.length} · reddedilen ${sonuclar.length - gecen.length} · biçim hatası ${hatalar.length}`, '');
  s.push('## Boy × bant', '', '| Boy | kolay | orta | zor | uzman | toplam |', '|---|---|---|---|---|---|');
  for (const k of Object.keys(boyBant).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))) { const v = boyBant[k]; s.push(`| ${k} | ${v.kolay || 0} | ${v.orta || 0} | ${v.zor || 0} | ${v.uzman || 0} | ${Object.values(v).reduce((a, b) => a + b, 0)} |`); }
  s.push('', '## Kategori × bant', '', '| Kategori | kolay | orta | zor | uzman |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(say)) s.push(`| ${k} | ${v.kolay || 0} | ${v.orta || 0} | ${v.zor || 0} | ${v.uzman || 0} |`);
  const bas = sonuclar.filter(x => x.baslangic.length && !x.ret);
  s.push('', `## Başlangıç karesi gerekenler (${bas.length})`, '');
  for (const x of bas) s.push(`- ${x.id} (${x.en}×${x.boy}, ${x.tekillik}): ${x.baslangic.length} kare${x.oneri.length ? ' · öneri: ' + x.oneri.map(o => o.hucreler.map(h => `(${h.r + 1},${h.c + 1})`).join('+')).join(' | ') : ''}`);
  const ret = sonuclar.filter(x => x.ret);
  s.push('', `## Reddedilenler (${ret.length})`, '');
  for (const x of ret) s.push(`- ${x.id}: ${x.ret}${x.oneri.length ? ' · öneri: ' + x.oneri.map(o => o.hucreler.map(h => `(${h.r + 1},${h.c + 1})`).join('+')).join(' | ') : ''}`);
  if (hatalar.length) { s.push('', '## Biçim hataları', ''); for (const h of hatalar) s.push(`- ${h}`); }
  const uyari = sonuclar.filter(x => x.uyari);
  if (uyari.length) { s.push('', '## Uyarılar', ''); for (const x of uyari) s.push(`- ${x.id}: ${x.uyari}`); }
  const hedefler = { '5×5': 20, '10×10': 35, '15×15': 45, '20×20': 30, '25×25': 20 };
  s.push('', '## Hedefe uzaklık', '');
  for (const [k, n] of Object.entries(hedefler)) { const v = boyBant[k] ? Object.values(boyBant[k]).reduce((a, b) => a + b, 0) : 0; s.push(`- ${k}: ${v} / ${n}`); }
  return s.join('\n') + '\n';
}

// Temas kağıdı: her resim siyah-beyaz (oyundaki varsayılan kare boyunda) ve renkli
const KARE = { 5: 40, 10: 28, 15: 22, 20: 18, 25: 14 };
function svgResim(r, renkli, k, baslangic) {
  const w = r.en * k, h = r.boy * k, p = [];
  p.push(`<svg width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}" xmlns="http://www.w3.org/2000/svg">`);
  p.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="#fbf9f2"/>`);
  for (let y = 0; y < r.boy; y++) for (let x = 0; x < r.en; x++) {
    const ch = r.satirlar[y][x];
    if (ch !== '.') p.push(`<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${renkli ? PALET[r.palet[ch]] : '#3c3c3c'}"/>`);
    else if (renkli && r.arkaPlan) { const sat = r.arkaPlan.satirlar; if (!sat || sat[y][x] !== '.') p.push(`<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${PALET[r.arkaPlan.renk || 'krem']}" opacity=".45"/>`); }
  }
  if (!renkli) {
    for (let x = 0; x <= r.en; x++) p.push(`<line x1="${x * k}" y1="0" x2="${x * k}" y2="${h}" stroke="rgba(86,140,214,${x % 5 ? .25 : .6})" stroke-width="${x % 5 ? .6 : 1}"/>`);
    for (let y = 0; y <= r.boy; y++) p.push(`<line x1="0" y1="${y * k}" x2="${w}" y2="${y * k}" stroke="rgba(86,140,214,${y % 5 ? .25 : .6})" stroke-width="${y % 5 ? .6 : 1}"/>`);
    for (const [a, c, v] of baslangic || []) p.push(v === 1 ? `<circle cx="${c * k + k / 2}" cy="${a * k + k / 2}" r="${k * .18}" fill="#e07a1f"/>` : `<path d="M${c * k + k * .3} ${a * k + k * .3}L${c * k + k * .7} ${a * k + k * .7}M${c * k + k * .7} ${a * k + k * .3}L${c * k + k * .3} ${a * k + k * .7}" stroke="#e07a1f" stroke-width="1.5"/>`);
  }
  p.push('</svg>');
  return p.join('');
}
function temas(veri, sonuclar) {
  const h = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const kart = (r, x) => {
    const k = KARE[Math.max(r.en, r.boy)] || 16, kucuk = Math.max(3, Math.floor(80 / Math.max(r.en, r.boy)));
    return `<figure class="${x.ret ? 'ret' : x.baslangic.length ? 'bas' : ''}"><div class="ikili">${svgResim(r, false, k, x.baslangic)}${svgResim(r, true, k)}${svgResim(r, true, kucuk)}</div>
<figcaption><b>${h(r.ad)}</b> · ${r.en}×${r.boy} · ${x.bant || '?'}${x.baslangic.length ? ` · ${x.baslangic.length} başlangıç` : ''}${x.ret ? ` · <span class="kirmizi">RET: ${h(x.ret)}</span>` : ''}<br><small>${h(r.id)} · ${h(r.not || '')}</small></figcaption></figure>`;
  };
  const bolumler = [];
  const sorunlu = sonuclar.filter(x => x.ret || x.baslangic.length);
  if (sorunlu.length) bolumler.push(`<h2>Sorunlular (${sorunlu.length})</h2><div class="liste">${sorunlu.map(x => kart(veri.harita.get(x.id), x)).join('')}</div>`);
  for (const d of veri.defterler) {
    const liste = sonuclar.filter(x => veri.harita.get(x.id).kategori === d.id).sort((a, b) => (a.puan ?? 9999) - (b.puan ?? 9999));
    bolumler.push(`<h2>${h(d.ad)} (${liste.length})</h2><div class="liste">${liste.map(x => kart(veri.harita.get(x.id), x)).join('')}</div>`);
  }
  // kilimler
  const kilimler = [];
  for (const [n, t] of [[11, 101], [11, 102], [15, 214], [15, 215], [15, 216], [15, 217], [19, 318], [19, 319], [19, 320], [21, 421], [21, 422], [21, 423]]) {
    const kr = K.resim(t, { boy: n, hedefBant: 'orta' });
    const r = { en: n, boy: n, satirlar: [], palet: {}, arkaPlan: { renk: 'krem' } };
    const harf = new Map();
    for (let y = 0; y < n; y++) { let s = ''; for (let x = 0; x < n; x++) { const c = kr.renk[y * n + x]; if (!c) { s += '.'; continue; } if (!harf.has(c)) { const ch = 'abcdefgh'[harf.size]; harf.set(c, ch); r.palet[ch] = Object.keys(PALET).find(k => PALET[k] === c); } s += harf.get(c); } r.satirlar.push(s); }
    kilimler.push(`<figure><div class="ikili">${svgResim(r, false, KARE[n] || 16, kr.baslangic.map(b => [b.r, b.c, b.v]))}${svgResim(r, true, KARE[n] || 16)}</div><figcaption><b>${kr.ad}</b> · ${n}×${n} · ${kr.bant} · ${kr.duzeltme.tur}${kr.baslangic.length ? ' · ' + kr.baslangic.length + ' başlangıç' : ''}</figcaption></figure>`);
  }
  bolumler.push(`<h2>Kilimler (örnek tohumlar)</h2><div class="liste">${kilimler.join('')}</div>`);
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kare Karalamaca · temas kağıdı</title>
<style>body{font:14px/1.4 -apple-system,system-ui,sans-serif;margin:16px;color:#333;background:#f4f1ea}h1{font-weight:500}h2{margin:28px 0 8px;font-weight:500;border-bottom:1px solid #ccc}
.liste{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;padding:8px;background:#fff;border:1px solid #ddd}figure.ret{border-color:#a8322d;background:#fff4f2}figure.bas{border-color:#e07a1f}
.ikili{display:flex;gap:8px;align-items:flex-end}figcaption{margin-top:6px;max-width:520px}small{color:#888}.kirmizi{color:#a8322d}</style></head><body>
<h1>Kare Karalamaca · temas kağıdı</h1><p>Her resim: siyah-beyaz (oyundaki varsayılan kare boyunda; turuncu işaret başlangıç karesi), renkli ve küçük. ${sonuclar.length} resim, ${sonuclar.filter(x => !x.ret).length} geçti. Oluşturma: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}.</p>
${bolumler.join('\n')}</body></html>`;
  writeFileSync(join(kok, 'docs/temas.html'), html);
}

function calistir() {
  const v = veriYukle(), defterIdleri = new Set(v.defterler.map(d => d.id)), idler = new Set(), hatalar = [];
  const liste = [];
  for (const d of v.defterler) for (const r of v.resimler[d.id] || []) liste.push(r);
  v.harita = new Map(liste.map(r => [r.id, r]));
  const kat = deger('--kategori'), secili = kat ? liste.filter(r => r.kategori === kat) : liste;
  const sonuclar = [];
  const t0 = Date.now();
  for (const r of secili) {
    const h = dogrula(r, defterIdleri, idler);
    if (h.length) { hatalar.push(`${r.id}: ${h.join('; ')}`); continue; }
    const s = isle(r);
    sonuclar.push(s);
    const durum = s.ret ? `RET (${s.ret})` : `${s.bant}${s.baslangic.length ? ` +${s.baslangic.length} başlangıç` : ''}`;
    console.log(`${r.id.padEnd(22)} ${(r.en + '×' + r.boy).padEnd(6)} ${s.tekillik.padEnd(5)} ${durum}${s.uyari ? ' · ' + s.uyari : ''}`);
  }
  if (!bayrak('--kuru')) {
    if (kat) { // yalnız bir kategori işlendiyse diğerlerinin hesabını koru
      for (const [id, x] of Object.entries(v.hesap)) if (!sonuclar.some(s => s.id === id) && v.harita.has(id) && v.harita.get(id).kategori !== kat) sonuclar.push(Object.assign({ id, oneri: [], baslangic: x.baslangic }, x, { en: v.harita.get(id).en, boy: v.harita.get(id).boy }));
    }
    hesapYaz(sonuclar);
    writeFileSync(join(kok, 'docs/rapor.md'), rapor(v, sonuclar, hatalar));
  }
  if (bayrak('--temas')) temas(v, sonuclar);
  console.log(`\n${sonuclar.length} resim, ${sonuclar.filter(s => !s.ret).length} geçti, ${sonuclar.filter(s => s.ret).length} ret, ${hatalar.length} biçim hatası · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const hh of hatalar) console.log('HATA ' + hh);
  if (hatalar.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) calistir();
void C;
