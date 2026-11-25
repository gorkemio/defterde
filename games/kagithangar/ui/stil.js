// #/stil — kalıcı stil rehberi: iki malzeme yan yana. Sonraki her ekran buna bakılarak değerlendirilir.
//   Sol: DEFTER (dünya) — tükenmez kalem, kareli kağıt, rough.js.
//   Sağ: GERÇEK KAĞIT (uçak) — kırık beyaz, gren, ışık tonu, ince kat çizgileri, yerde yumuşak gölge.
import { ust, not, el, dugme, cerceveleriCiz, svgKatman } from './sayfa.js';
import { kagitCiz } from './kagitCiz.js';
import { vadiCizgisi, dagCizgisi, kivrikOk, tutHalkasi, hayalet, cetele } from './isaretler.js';
import { hepsiniYukle } from './tasarimYukle.js';
import { ucakCiz, ucakModeli } from './ucakCiz.js';
import { kanatGeometrisi } from '../engine/poz.js';

const KL = () => window.Kit.kalem;

function ornek(kap, baslik) {
  const f = el('figure', { sinif: 'ornek' }, kap);
  const icerik = el('div', {}, f);
  const c = el('figcaption', {}, f);
  KL().harfle(c, baslik, { tohum: ['ornek', baslik], anlik: true });
  return icerik;
}

function bolum(kap, yazi) {
  const h = el('h2', { sinif: 'bolum' }, kap);
  KL().harfle(h, yazi, { tohum: ['bolum', yazi] });
}

/* ---------------- DEFTER ---------------- */

function defterOrnekleri(kap) {
  const KLk = KL();
  bolum(kap, 'Defter: dünya');

  const yazi = ornek(kap, 'el yazısı: Patrick Hand, Türkçe harflerle');
  const p = el('p', { sinif: 'not mavi' }, yazi);
  KLk.harfle(p, 'Pijamalı hasta yağız şoföre çabucak güvendi. İĞÜŞÖÇ ığüşöç');

  const d = ornek(kap, 'düğmeler: birincil iki kez çerçeveli (sayfanın tek ana işi), ikincil tek çerçeve, üçüncül kurşun alt çizgi; kırmızı = silen; kapalı = kurşun. Üzerine gelince kalem bir kez daha geçer, klavye odağında kurşun kalem kutu.');
  const satir = el('div', { sinif: 'dugmeler' }, d);
  dugme(satir, { id: 'stil-ucur', yazi: 'Uçur →', onem: 'birincil' });
  dugme(satir, { id: 'stil-as', yazi: 'Hangara as →' });
  dugme(satir, { id: 'stil-kapat', yazi: 'Kapat', onem: 'ucuncul' });
  dugme(satir, { id: 'stil-sil', yazi: 'Emekli et', tehlikeli: true });
  dugme(satir, { id: 'stil-utu', yazi: 'Ütüle', sonuk: true });

  const o = ornek(kap, 'yazı ölçeği: 1 başlık · 2 bölüm · 3 öne çıkan · 4 gövde · 5 küçük yazı (--yazi-1…5)');
  [['--yazi-1', 'Kağıt Hangar'], ['--yazi-2', 'Günün uçuşu'], ['--yazi-3', '10,3 m'], ['--yazi-4', 'Kanatlar dümdüz, tertemiz bir iş.'], ['--yazi-5', 'çetele: karakter puanı']]
    .forEach(([v, y]) => { const p = el('p', { sinif: 'olcek-ornegi' }, o); p.style.fontSize = `var(${v})`; KLk.harfle(p, y, { anlik: true }); });

  // katlama işaretleri
  const isr = ornek(kap, 'katlama işaretleri: vadi kesikli, dağ nokta-çizgi, kıvrık ok, tut halkası, hayalet hedef');
  const svg = svgKatman(isr, 320, 120);
  const K = KLk.kalemYap(svg);
  vadiCizgisi(K, svg, [[16, 26], [140, 26]], ['stil', 1]);
  KLk.metinSvg(svg, 'vadi', { x: 150, y: 31, boyut: 17, hiza: 'start', renk: 'kursun', anlik: true });
  dagCizgisi(K, svg, [[16, 62], [140, 62]], ['stil', 2]);
  KLk.metinSvg(svg, 'dağ', { x: 150, y: 67, boyut: 17, hiza: 'start', renk: 'kursun', anlik: true });
  tutHalkasi(K, svg, [210, 92], ['stil']);
  kivrikOk(K, svg, [214, 84], [292, 30], ['stil'], { bukum: -.3 });
  hayalet(K, svg, [300, 22], ['stil']);
  KLk.metinSvg(svg, 'tut', { x: 210, y: 118, boyut: 15, renk: 'kursun', anlik: true });

  // mürekkepler ve çetele
  const m = ornek(kap, 'mürekkep: mavi = sen, kırmızı = önemli an (rekor, rütbe) ve silme, kurşun = notlar · çetele: karakter puanı');
  const svg2 = svgKatman(m, 320, 100);
  const K2 = KLk.kalemYap(svg2);
  [['mavi', 'sen'], ['kirmizi', 'rekor'], ['kursun', 'not']].forEach(([r, ad], i) => {
    const x = 26 + i * 62;
    K2.daire(svg2, [x, 28, 30], { stroke: KLk.renkDeger(r), fill: KLk.renkDeger(r), fillStyle: 'hachure', hachureGap: 3.5 },
      ['murekkep', r]);
    KLk.metinSvg(svg2, ad, { x, y: 66, boyut: 16, renk: r, anlik: true });
  });
  [['hız', 7, 18], ['süzülme', 4, 52]].forEach(([ad, n, y]) => {
    KLk.metinSvg(svg2, ad, { x: 205, y: y + 15, boyut: 15, hiza: 'start', renk: 'kursun', anlik: true });
    cetele(K2, svg2, 262, y, n, ['stil', ad]);
  });
  const yildiz = KLk.svgEl('svg', { viewBox: '0 0 40 40', x: 284, y: 72, width: 24, height: 24 }, svg2);
  KLk.susCiz(yildiz, 'yildiz', ['stil']);
}

/* ---------------- GERÇEK KAĞIT ---------------- */

function kagitOrnekleri(kap) {
  const KLk = KL();
  bolum(kap, 'Gerçek kağıt: uçak');

  // 1) düz yaprak + üstünde dünyaya ait işaretler, 2) köşeleri katlanmış yaprak
  const o1 = ornek(kap, 'düz yaprak ve üstüne kalemle çizilmiş sonraki kat · köşeleri katlanmış yaprak');
  const svg = svgKatman(o1, 340, 220);
  const S = 130, ox = 20, oy = 14;
  const P = (x, y, dx = 0) => [ox + dx + x * S, oy + y * S];
  kagitCiz(svg, [{
    noktalar: [P(0, 0), P(1, 0), P(1, 1.414), P(0, 1.414)], yuz: 'on',
    kirisikler: [[P(.5, 0), P(.5, 1.414)]],
  }]);
  const K = KLk.kalemYap(svg);
  vadiCizgisi(K, svg, [P(.5, 0), P(0, .5)], ['ornek1', 'sol']);
  vadiCizgisi(K, svg, [P(.5, 0), P(1, .5)], ['ornek1', 'sag']);
  tutHalkasi(K, svg, P(0, 0), ['ornek1'], { cap: 18 });
  kivrikOk(K, svg, P(.04, .04), P(.42, .46), ['ornek1'], { bukum: .35 });
  hayalet(K, svg, P(.5, .5), ['ornek1']);

  const dx = 170;
  kagitCiz(svg, [
    { noktalar: [P(.5, 0, dx), P(1, .5, dx), P(1, 1.414, dx), P(0, 1.414, dx), P(0, .5, dx)], yuz: 'on',
      kirisikler: [[P(.5, .5, dx), P(.5, 1.414, dx)]] },
    { noktalar: [P(.5, 0, dx), P(.5, .5, dx), P(0, .5, dx)], yuz: 'arka', isik: .97, mentese: [P(.5, 0, dx), P(0, .5, dx)] },
    { noktalar: [P(.5, 0, dx), P(1, .5, dx), P(.5, .5, dx)], yuz: 'arka', isik: .95, mentese: [P(.5, 0, dx), P(1, .5, dx)] },
  ], { golgeParcalar: [[P(.5, 0, dx), P(1, .5, dx), P(1, 1.414, dx), P(0, 1.414, dx), P(0, .5, dx)]] });

  // 3) 3/4 uçuş görünümü: motorun pozundan; kanattaki isim ve çizgi sahibinin mürekkebi
  const o3 = ornek(kap, '3/4 görünüm: uçak orada duran bir nesne; kanattaki isim ve çizgi sahibinin mürekkebi');
  const svg3 = svgKatman(o3, 340, 200);
  const o4 = ornek(kap, 'altı tasarım, hepsi katlama dizisinden türetildi');
  const svg4 = svgKatman(o4, 340, 190);
  return { svg3, svg4 };
}

export async function kur(kap, params, ctx) {
  ust(kap, 'Stil rehberi', { geri: { hash: '#/masa', yazi: 'masa' } });
  not(kap, 'Dünya bir defter: kareli kağıt, tükenmez kalem. Uçak gerçek kağıt: üstünde kalem çizgisi yok, yalnız sahibinin mürekkebi.');
  const izgara = el('div', { sinif: 'stil-izgara' }, kap);
  const sol = el('section', { 'aria-label': 'Defter malzemesi' }, izgara);
  const sag = el('section', { 'aria-label': 'Gerçek kağıt malzemesi' }, izgara);
  defterOrnekleri(sol);
  const { svg3, svg4 } = kagitOrnekleri(sag);
  const k = el('p', { sinif: 'kural' }, kap);
  KL().harfle(k, 'Kural: kalem çizgisi dünyaya, kağıt uçağa ait. Ekran görüntüsünde ikisi anında ayırt edilmeli.');
  requestAnimationFrame(() => cerceveleriCiz(kap));

  const veriler = await hepsiniYukle();
  if (!ctx.gecerli()) return;
  const ok = veriler[0].katlama;
  // örnek kayıt: kanatta isim ve küçük bir şimşek (boya, kanadın 2B koordinatında)
  const g = kanatGeometrisi(ucakModeli(ok), 'sag');
  const x = (t) => g.disX + (g.menteseX - g.disX) * t;
  const ornekUcak = {
    ad: 'Mavi Şimşek', kalite: 100,
    boya: { cizgiler: [{ renk: 'kirmizi', kanat: 'sag', noktalar: [[x(0.75), 1.05], [x(0.65), 1.1], [x(0.8), 1.13], [x(0.68), 1.2]] }] },
  };
  ucakCiz(svg3, ok, { merkez: [170, 80], olcek: 190, zemin: -0.35, ucak: ornekUcak });
  veriler.forEach(({ tasarim, katlama }, i) => {
    const cx = 60 + (i % 3) * 112, cy = 40 + Math.floor(i / 3) * 92;
    ucakCiz(svg4, katlama, { merkez: [cx, cy], olcek: 72, zemin: -0.3, bulaniklik: 2 });
    KL().metinSvg(svg4, tasarim.ad, { x: cx, y: cy + 52, boyut: 14, renk: 'kursun', anlik: true });
  });
  return { boyut() { cerceveleriCiz(kap, true); } };
}
