// #/hangar — defter sayfasına çizilmiş oda: tavandan iplerle sarkan gerçek kağıt uçaklar, her biri kendi fazında
// sallanır. İp ve etiket tükenmez kalem, uçak gerçek kağıt. Uçağa dokununca fiş. Emekliler müze duvarında.
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman } from './sayfa.js';
import { hepsiniYukle } from './tasarimYukle.js';
import { ucakCiz } from './ucakCiz.js';
import { ucakFisiAc } from './ucakFisi.js';
import { KAMERALAR } from '../engine/poz.js';
import { sahneRekorlari } from '../engine/pilot.js';
import { depo, ANAHTAR } from '../depo.js';
import { duelloYaz } from './duelloDurum.js';

const SLOT = 300, SIRA = 330, KIRIS = 26;

const karma = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const D = depo();
  ust(kap, 'Hangar', { geri: { hash: '#/masa', yazi: 'masa' } });
  const ustSatir = el('nav', { sinif: 'dugmeler' }, kap);
  dugme(ustSatir, { id: 'hangar-katla', yazi: SZ.ileri.katla, href: '#/katalog' });
  const alan = el('div', { sinif: 'hangar-alani' }, kap);
  const muze = el('section', { sinif: 'muze', hidden: true, 'aria-label': 'Müze duvarı' }, kap);
  const yedekBolum = el('section', { sinif: 'yedek', 'aria-label': 'Yedekleme' }, kap);

  const veriler = await hepsiniYukle();
  if (!ctx.gecerli()) return {};
  const tasarimlar = Object.fromEntries(veriler.map(v => [v.tasarim.id, v]));

  function ciz() {
    alan.textContent = '';
    muze.textContent = '';
    const hepsi = D.ucaklar().filter(u => tasarimlar[u.tasarim]);
    const asili = hepsi.filter(u => !u.emekli), emekli = hepsi.filter(u => u.emekli);
    const genislik = alan.clientWidth || kap.clientWidth;
    const sq = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 19;
    const sutun = Math.max(1, Math.min(5, Math.floor(genislik / (sq * 11))));
    ustSatir.hidden = !asili.length;                       // boş hangarda tek iş aşağıdaki "İlk uçağını katla →"
    if (!asili.length) bosHangar();
    else odaCiz(asili, sutun);
    if (emekli.length) muzeCiz(emekli, Math.max(1, Math.min(4, sutun)));
    muze.hidden = !emekli.length;
  }

  function bosHangar() {
    const svg = svgKatman(alan, 600, 300, 'hangar-svg');
    svg.setAttribute('aria-label', 'Boş hangar: tek bir ip sarkıyor');
    const K = KL.kalemYap(svg);
    K.cizgi(svg, [10, KIRIS, 590, KIRIS], { strokeWidth: 2.2 }, ['hangar', 'kiris', 0]);
    K.egri(svg, [[300, KIRIS], [302, 110], [298, 170]], { strokeWidth: 1.4 }, ['hangar', 'bos-ip']);
    K.elips(svg, [298, 182, 22, 26], { strokeWidth: 1.4 }, ['hangar', 'bos-halka']);
    KL.metinSvg(svg, 'ilk uçağını katla, buraya asalım', { x: 300, y: 250, boyut: 24, renk: 'kursun', aci: -2 });
    const nav = el('nav', { sinif: 'dugmeler' }, alan);
    dugme(nav, { id: 'bos-katla', yazi: SZ.ileri.ilkKatla, href: '#/atolye/ok', onem: 'birincil' });
    dugme(nav, { id: 'bos-katalog', yazi: 'Başka bir tasarım seç', href: '#/katalog', onem: 'ucuncul' });
    requestAnimationFrame(() => cerceveleriCiz(nav));
  }

  function odaCiz(asili, sutun) {
    const sira = Math.ceil(asili.length / sutun);
    const svg = svgKatman(alan, sutun * SLOT, sira * SIRA + 10, 'hangar-svg', 'group');
    svg.setAttribute('aria-label', `Hangar: ${asili.length} uçak iplerde asılı`);
    const K = KL.kalemYap(svg);
    for (let r = 0; r < sira; r++) {
      const y = r * SIRA + KIRIS;
      K.cizgi(svg, [6, y, sutun * SLOT - 6, y], { strokeWidth: 2.2 }, ['hangar', 'kiris', r]);
      K.cizgi(svg, [10, y - 8, sutun * SLOT - 10, y - 9], { strokeWidth: 1 }, ['hangar', 'kiris2', r]);
    }
    asili.forEach((u, i) => {
      const cx = (i % sutun) * SLOT + SLOT / 2, y0 = Math.floor(i / sutun) * SIRA + KIRIS;
      const ipBoyu = 120 + (karma(u.id) % 40);
      const h = karma(u.id + 'salin');
      const g = KL.svgEl('g', {
        class: 'askili', role: 'button', tabindex: 0, 'aria-label': `${u.ad || 'İsimsiz'}, ${tasarimlar[u.tasarim].tasarim.ad}. Fişi aç.`,
        style: `transform-origin: ${cx}px ${y0}px; --sure: ${(3.2 + (h % 90) / 100).toFixed(2)}s; --gecikme: -${(h % 300) / 100}s`,
      }, svg);
      K.cizgi(g, [cx, y0, cx + 1, y0 + ipBoyu], { strokeWidth: 1.3 }, ['ip', u.id], { anlik: true });
      // etiket: ipe bağlı küçük kart
      const ex = cx + 10, ey = y0 + 26;
      K.cizgi(g, [cx, ey, ex, ey + 6], { strokeWidth: 1 }, ['etiket-ip', u.id], { anlik: true });
      const ad = (u.ad || 'İsimsiz').slice(0, 16);
      const gen = Math.max(54, ad.length * 8.5 + 14);
      KL.kutu(K, g, ex, ey, gen, 24, { tohum: ['etiket', u.id], anlik: true, tasma: 2, cizgi: { strokeWidth: 1.1 } });
      KL.metinSvg(g, ad, { x: ex + gen / 2, y: ey + 17, boyut: 15, renk: 'mavi', anlik: true, tohum: ['etiket', u.id] });
      const ucus = u.istatistik.ucus || 0;
      const enUzak = Math.max(0, ...sahneRekorlari(u).map(r => r.enUzak));
      KL.metinSvg(g, ucus ? `${ucus} uçuş · en uzak ${String(Math.round(enUzak * 10) / 10).replace('.', ',')} m` : 'henüz uçmadı',
        { x: ex + 2, y: ey + 40, boyut: 12, hiza: 'start', renk: 'kursun', anlik: true, tohum: ['etiket-alt', u.id] });
      const v = tasarimlar[u.tasarim];
      ucakCiz(g, v.katlama, { ucak: u, kamera: KAMERALAR.HANGAR, merkez: [cx, y0 + ipBoyu + 14], olcek: 118, zemin: -0.5, golge: { dx: 6, dy: 10, opaklik: .12 }, bulaniklik: 4 });
      tiklamaAlani(g);
      const ac = () => fisAc(u, g);
      g.addEventListener('click', ac);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
    });
  }

  function muzeCiz(emekli, sutun) {
    const h = el('h2', { sinif: 'bolum' }, muze);
    KL.harfle(h, 'Müze duvarı');
    const sira = Math.ceil(emekli.length / sutun);
    const svg = svgKatman(muze, sutun * SLOT, sira * 250, 'muze-svg', 'group');
    const K = KL.kalemYap(svg);
    emekli.forEach((u, i) => {
      const x = (i % sutun) * SLOT + 20, y = Math.floor(i / sutun) * 250 + 10;
      const g = KL.svgEl('g', { class: 'muze-cerceve', role: 'button', tabindex: 0, 'aria-label': `${u.ad || 'İsimsiz'}, emekli. Fişi aç.` }, svg);
      KL.kutu(K, g, x, y, SLOT - 40, 170, { tohum: ['muze', u.id], anlik: true, tasma: 5, cizgi: { strokeWidth: 2 } });
      KL.kutu(K, g, x + 8, y + 8, SLOT - 56, 154, { tohum: ['muze2', u.id], anlik: true, tasma: 2, cizgi: { strokeWidth: 1 } });
      ucakCiz(g, tasarimlar[u.tasarim].katlama, { ucak: u, kamera: KAMERALAR.HANGAR, merkez: [x + (SLOT - 40) / 2, y + 70], olcek: 110, zemin: -0.4 });
      tiklamaAlani(g);
      KL.metinSvg(g, u.ad || 'İsimsiz', { x: x + (SLOT - 40) / 2, y: y + 196, boyut: 17, renk: 'mavi', anlik: true });
      const ist = u.istatistik;
      KL.metinSvg(g, `${ist.ucus} uçuş · en uzak ${String(ist.enUzak).replace('.', ',')} m · ${ist.loop} takla`, { x: x + (SLOT - 40) / 2, y: y + 220, boyut: 13, renk: 'kursun', anlik: true });
      const ac = () => fisAc(u, g);
      g.addEventListener('click', ac);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } });
    });
  }

  // SVG yalnız boyalı piksellerde tıklama yakalar; yandan görünen uçak ince olduğundan çizimin kutusu
  // (ip, etiket, uçak) görünmez bir alanla kaplanır, en alta konur.
  function tiklamaAlani(g) {
    const b = g.getBBox(), pay = 10;
    const r = KL.svgEl('rect', { x: b.x - pay, y: b.y - pay, width: b.width + 2 * pay, height: b.height + 2 * pay, fill: 'none', 'pointer-events': 'all', class: 'tiklama-alani' }, null);
    g.insertBefore(r, g.firstChild);
  }

  function fisAc(u, odak) {
    const v = tasarimlar[u.tasarim];
    ucakFisiAc({
      ucak: D.ucak(u.id), tasarim: v.tasarim, katlama: v.katlama, depo: D, donus: odak,
      kapandi: (degisti) => {
        if (degisti) ciz();
        else if (odak && odak.isConnected) odak.focus({ preventScroll: true });
      },
    });
  }

  /* ---------- yedekle / geri yükle ---------- */
  function yedekCiz() {
    yedekBolum.textContent = '';
    const nav = el('nav', { sinif: 'dugmeler' }, yedekBolum);
    dugme(nav, { id: 'yedekle', yazi: SZ.yan.yedekle, sinif: 'kucuk', tik: yedekle });
    dugme(nav, { id: 'geri-yukle', yazi: SZ.yan.geriYukle, sinif: 'kucuk', tik: () => dosya.click() });
    const dosya = el('input', { type: 'file', accept: '.json,application/json', sinif: 'gizli', 'aria-label': 'Yedek dosyası seç' }, yedekBolum);
    dosya.addEventListener('change', () => dosyaSecildi(dosya));
    const bilgi = el('p', { sinif: 'not yedek-bilgi' }, yedekBolum);
    KL.harfle(bilgi, D.yazilabilir ? 'Uçaklar bu tarayıcıda saklanır. Yedek dosyasıyla başka yere taşıyabilirsin.'
      : 'Uyarı: kayıtlı hangar bu sürümde okunamadı; üstüne yazmamak için kaydetme kapalı. İstersen sıfırlayıp baştan başlayabilirsin.', { anlik: true });
    const sifirNav = el('nav', { sinif: 'dugmeler sifirla' }, yedekBolum);
    dugme(sifirNav, { id: 'sifirla', yazi: SZ.tehlikeli.sifirla, sinif: 'kucuk', tehlikeli: true, tik: sifirlaSor });
    requestAnimationFrame(() => cerceveleriCiz(yedekBolum, true));
  }

  /* ---------- her şeyi sıfırla ---------- */
  function sifirlaSor() {
    if (yedekBolum.querySelector('.sifir-sorusu')) return;
    const n = D.ucaklar().length;
    const soru = el('div', { sinif: 'sifir-sorusu', role: 'alertdialog', 'aria-label': 'Her şeyi sıfırla' }, yedekBolum);
    KL.harfle(el('p', { sinif: 'not kirmizi' }, soru),
      `${n ? `${n} uçak, ` : ''}bütün uçuş günlükleri, rekorlar, pilot kartı, günün uçuşu ve süren düello silinecek; ses ayarı da baştan. Bu geri alınamaz.`, { anlik: true });
    const nav = el('nav', { sinif: 'dugmeler' }, soru);
    if (n) dugme(nav, { id: 'sifir-yedek', yazi: 'Önce yedekle', sinif: 'kucuk', tik: yedekle });
    dugme(nav, { id: 'sifir-evet', yazi: SZ.tehlikeli.sifirlaEvet, sinif: 'kucuk', tehlikeli: true, tik: herSeyiSifirla });
    dugme(nav, { id: 'sifir-vazgec', yazi: SZ.yan.vazgec, sinif: 'kucuk', tik: () => soru.remove() });
    soru.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); soru.remove(); } });
    requestAnimationFrame(() => { cerceveleriCiz(soru, true); soru.querySelector('#sifir-vazgec').focus({ preventScroll: true }); });
  }

  // Hangar boşaltılır; uygulamanın bu tarayıcıdaki öbür kayıtları da silinir, sonra masa baştan açılır.
  function herSeyiSifirla() {
    D.sifirla();
    duelloYaz(null);
    for (const depo of ['localStorage', 'sessionStorage']) {
      try {
        // Depoya erişmek bile SecurityError fırlatabilir; okuma da try içinde.
        const s = window[depo];
        const anahtarlar = [];
        for (let i = 0; i < s.length; i++) anahtarlar.push(s.key(i));
        for (const k of anahtarlar) if (k && k !== ANAHTAR && (k.startsWith('kagithangar') || k.startsWith('kh-'))) s.removeItem(k);
      } catch (e) { /* tarayıcı depoyu kapattıysa bellekte zaten sıfır */ }
    }
    location.hash = '#/masa';
    location.reload();
  }
  function yedekle() {
    const blob = new Blob([D.yedekle()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kagit-hangar-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function dosyaSecildi(girdi) {
    const f = girdi.files && girdi.files[0];
    girdi.value = '';
    if (!f) return;
    const bilgi = yedekBolum.querySelector('.yedek-bilgi');
    if (f.size > 5 * 1024 * 1024) { KL.harfle(bilgi, 'Bu dosya bir hangar yedeği olamayacak kadar büyük.', { anlik: true }); return; }
    const metin = await f.text();
    let sayi;
    try { sayi = JSON.parse(metin).ucaklar.length; } catch (e) { sayi = -1; }
    if (!(sayi >= 0)) { KL.harfle(bilgi, 'Bu dosya bir Kağıt Hangar yedeği değil.', { anlik: true }); return; }
    const soru = el('div', { sinif: 'yedek-sorusu' }, yedekBolum);
    KL.harfle(el('p', { sinif: 'not mavi' }, soru), `Yedekte ${sayi} uçak var. Ne yapalım?`, { anlik: true });
    const nav = el('nav', { sinif: 'dugmeler' }, soru);
    const uygula = (birlestir) => {
      try {
        const n = D.geriYukle(metin, { birlestir });
        soru.remove();
        KL.harfle(bilgi, `Tamam: hangarda şimdi ${n} uçak var.`, { anlik: true });
        ciz();
      } catch (e) { KL.harfle(bilgi, 'Yedek okunamadı: ' + e.message, { anlik: true }); soru.remove(); }
    };
    dugme(nav, { id: 'yedek-birlestir', yazi: 'Hangarıma ekle', sinif: 'kucuk', tik: () => uygula(true) });
    dugme(nav, { id: 'yedek-degistir', yazi: `${SZ.tehlikeli.hepsiniDegistir} (şimdiki hangar silinir)`, sinif: 'kucuk', tehlikeli: true, tik: () => uygula(false) });
    dugme(nav, { id: 'yedek-vazgec', yazi: SZ.yan.vazgec, sinif: 'kucuk', tik: () => soru.remove() });
    requestAnimationFrame(() => cerceveleriCiz(soru, true));
  }

  ciz();
  yedekCiz();
  requestAnimationFrame(() => cerceveleriCiz(kap.querySelector('.ust')));
  requestAnimationFrame(() => cerceveleriCiz(ustSatir));
  return { boyut() { ciz(); cerceveleriCiz(kap, true); } };
}
