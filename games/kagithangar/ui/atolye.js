// #/atolye/:tasarim — katlama masası. İki mod, her adımda değiştirilebilir:
//   İZLE: adımın işaretleri kalemle çizilir, "Katla" adımı sahte 3B animasyonla oynatır (kalite sabit %85).
//   ELLE: kalem halkasından tutup hayalet işarete sürüklenir; bırakma noktası hassasiyeti (0–100) verir,
//         tolerans dışında kağıt geri açılır. Kalite = adım hassasiyetlerinin ortalaması. Ön kırışık (katla-aç)
//         da sürüklenir ama sayılmaz: kabulde kağıt kapanır, sonra yavaşça açılır, kat izi kalır.
//         Çevir adımında kağıda dokunmak yeter.
// "Geri al" motoru tersine çalıştırır. "Hızlı katla" kalan adımları İZLE olarak hızlı oynatır.
// Bitince uçak eşsiz bir isimle hangara kaydedilir; ana iş "Uçur →".
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman, dugmeDurum, secimGrubu } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { hazirla, hedef, kutu, tasarimKutusu } from '../engine/fold.js';
import { katlanis } from '../engine/poz.js';
import * as E from '../engine/elle.js';
import { depo, yeniUcak } from '../depo.js';
import { isimOnerEssiz } from '../isimler.js';
import { ucusRotasi } from '../engine/akis.js';
import { durumCiz, kareCiz, ucakCiz } from './ucakCiz.js';
import { vadiCizgisi, dagCizgisi, kivrikOk, tutHalkasi, hayalet, cizgiyiKirp, cevirOku } from './isaretler.js';

const S = 300;                                             // kağıt birimi → svg birimi

// Bütün adımları (ara durumlar, tut noktaları, hedefler) ve altındaki çevir işaretini kapsayan çerçeve (kağıt birimi).
export function atolyeCercevesi(katlama) {
  const [x0, y0, x1, y1] = tasarimKutusu(katlama);
  return { x: x0 - 0.22, y: y0 - 0.2, w: x1 - x0 + 0.44, h: y1 - y0 + 0.5 };
}
const egri = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const sc = ([x, y]) => [x * S, y * S];

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  let veri;
  try {
    veri = await tasarimYukle(params.tasarim);
  } catch (e) {
    ust(kap, 'Atölye', { geri: { hash: '#/katalog', yazi: 'katalog' } });
    not(kap, `Bu tasarımı bulamadım (${params.tasarim}).`);
    requestAnimationFrame(() => cerceveleriCiz(kap));
    return {};
  }
  if (!ctx.gecerli()) return {};
  const { tasarim, katlama } = veri;
  const n = tasarim.adimlar.length;
  const VB = atolyeCercevesi(katlama);
  const ORTA = katlama.kagit.en / 2;                        // kağıdın orta çizgisi (çevirme ekseni)

  /* ---------- iskelet ---------- */
  ust(kap, tasarim.ad, { geri: { hash: '#/katalog', yazi: 'katalog' } });
  const duzen = el('div', { sinif: 'atolye' }, kap);
  const masa = el('div', { sinif: 'atolye-masa' }, duzen);
  const panel = el('aside', { sinif: 'atolye-panel' }, duzen);

  const svg = svgKatman(masa, VB.w * S, VB.h * S, 'atolye-svg');
  svg.setAttribute('viewBox', `${VB.x * S} ${VB.y * S} ${VB.w * S} ${VB.h * S}`);
  svg.setAttribute('aria-label', `${tasarim.ad} katlama masası`);
  const gKagit = KL.svgEl('g', { class: 'kagit-katmani' }, svg);
  const gIsaret = KL.svgEl('g', { class: 'isaret-katmani' }, svg);
  const K = KL.kalemYap(svg);

  // adım paneli (mod hazır seçili gelir: son kullanılan, ilk kez İZLE)
  const adimPanel = el('div', { sinif: 'adim-paneli' }, panel);
  const sayac = el('p', { sinif: 'sayac' }, adimPanel);
  const metin = el('p', { sinif: 'adim-metni' }, adimPanel);
  const modSatir = el('div', { sinif: 'mod-satiri' }, adimPanel);
  const modGrubu = secimGrubu(modSatir, [
    { id: 'mod-elle', yazi: 'Elle', deger: 'elle' },
    { id: 'mod-izle', yazi: 'İzle', deger: 'izle' },
  ], 'elle', (m) => { mod = m; goster(); }, { etiket: 'Katlama modu' });
  const modNotu = el('p', { sinif: 'not mod-notu' }, modSatir);
  const ipucu = el('p', { sinif: 'not ipucu' }, adimPanel);
  const geriBildirim = el('p', { sinif: 'not mavi geri-bildirim' }, adimPanel);
  const gezinti = el('nav', { sinif: 'dugmeler' }, adimPanel);
  const ileriD = dugme(gezinti, { id: 'adim-katla', yazi: 'Katla →', tik: () => ileri(), onem: 'birincil' });
  const hizliD = dugme(gezinti, { id: 'adim-hizli', yazi: 'Hızlı katla', tik: () => (hizli ? (hizli = false) : hepsiniKatla()), onem: 'ucuncul' });
  const geriD = dugme(gezinti, { id: 'adim-geri', yazi: 'Geri al', tik: () => geri(), onem: 'ucuncul' });

  // bitiş
  const son = el('div', { sinif: 'son-panel', hidden: true }, adimPanel);
  const kaliteP = el('p', { sinif: 'not mavi' }, son);
  const adP = el('p', { sinif: 'not' }, son);
  const sonDugmeler = el('nav', { sinif: 'dugmeler' }, son);
  dugme(sonDugmeler, { id: 'son-ucur', yazi: 'Uçur →', onem: 'birincil', tik: () => ucagiKaydet((id) => ucusRotasi(id, depo().ayarlar())) });
  dugme(sonDugmeler, { id: 'son-adlandir', yazi: SZ.yan.adlandir, tik: () => ucagiKaydet((id) => '#/adlandir/' + id) });
  const sonAlt = el('nav', { sinif: 'dugmeler son-alt' }, son);
  const gorunumD = dugme(sonAlt, { id: 'son-gorunum', yazi: 'Katlanmış hâli', onem: 'ucuncul', tik: () => { sonGorunum = sonGorunum === 'ucak' ? 'duz' : 'ucak'; ciz(); gorunumYazisi(); } });
  dugme(sonAlt, { id: 'son-hangar', yazi: SZ.ileri.hangaraAs, onem: 'ucuncul', tik: () => ucagiKaydet(() => '#/hangar') });
  dugme(sonAlt, { id: 'son-geri', yazi: 'Son katı geri al', onem: 'ucuncul', tik: () => geri() });

  /* ---------- durum ---------- */
  let mod = null;            // 'elle' | 'izle'; null = henüz seçilmedi
  let s = 0;                 // gösterilen adım (0..n); s = n bitmiş uçak
  let parca = 0;             // adımın içinde sıradaki hareket (ayna adımında 0, 1)
  let mesgul = false;
  let surukle = null;        // { h, hz, id, aci, P, tasindi }
  let sonGorunum = 'ucak';
  let hizli = false;         // "Hızlı katla" sürüyor: animasyonlar kısalır, metin anında yazılır
  let onerilenAd = '';       // bitince gösterilen ve kaydedilen eşsiz isim
  const kayit = {};          // { hareketNo: { hassasiyet, mod } }

  const adim = () => katlama.adimlar[s];
  const aktifHareket = () => (s < n ? adim().hareketler[parca] : null);
  const gosterilenDurum = () => {
    if (s >= n) return katlama.son;
    const h = aktifHareket();
    return katlama.anlar[h ? h.no : adim().once];
  };
  const elleSurukleme = () => mod === 'elle' && s < n && E.surukle(aktifHareket());
  const elleDokunma = () => mod === 'elle' && s < n && aktifHareket().tip === 'cevir';

  function kaliteHesapla() {
    const adimlar = {};
    for (const h of katlama.hareketler) {
      const k = kayit[h.no];
      if (!k || !E.sayilir(h)) continue;
      (adimlar[h.adim] = adimlar[h.adim] || []).push(k.hassasiyet);
    }
    return E.kalite(adimlar);
  }
  function modOzeti() {
    const modlar = new Set(Object.values(kayit).map(k => k.mod));
    return modlar.size > 1 ? 'karma' : [...modlar][0] || 'izle';
  }

  /* ---------- çizim ---------- */
  function gorunumYazisi() {
    KL.harfle(gorunumD.querySelector('.yazi'), sonGorunum === 'ucak' ? 'Katlanmış hâli' : 'Uçağa bak', { anlik: true });
    cerceveleriCiz(sonAlt, true);
  }

  function ciz() {
    gKagit.textContent = '';
    gIsaret.textContent = '';
    if (s === n && sonGorunum === 'ucak') {
      ucakCiz(gKagit, katlama, { merkez: [(VB.x + VB.w / 2) * S, (VB.y + VB.h * 0.42) * S], olcek: S * 0.82, zemin: -0.42, kalite: kaliteHesapla() ?? 100 });
      return;
    }
    durumCiz(gKagit, gosterilenDurum(), { olcek: S });
    if (s < n && mod) isaretleriCiz();
  }

  // İZLE: adımın bütün hareketleri; ELLE: yalnız sıradaki hareket (tutma yeriyle).
  function isaretleriCiz(o = {}) {
    const durum = gosterilenDurum();
    const bb = kutu(durum);
    const liste = mod === 'elle' ? [aktifHareket()] : adim().hareketler;
    for (const h of liste) {
      const an = ['atolye', tasarim.id, h.no];
      if (h.tip === 'cevir') {
        // origami "ters çevir" işareti: kağıdın altında yatık bir halka ok
        const y = Math.min(bb[3] + 0.11, VB.y + VB.h - 0.2);
        cevirOku(K, gIsaret, sc([ORTA - 0.14, y]), 0.13 * S, an);
        KL.metinSvg(gIsaret, mod === 'elle' ? 'dokun: çevir' : 'çevir', { x: (ORTA + 0.24) * S, y: (y + 0.03) * S, boyut: 22, renk: 'mavi', tohum: an });
        continue;
      }
      const seg = cizgiyiKirp(h.cizgi, bb, 0.06);
      if (seg) (h.tip === 'dag' ? dagCizgisi : vadiCizgisi)(K, gIsaret, seg.map(sc), an);
      const t = sc(h.tut), hd = sc(hedef(h));
      hayalet(K, gIsaret, hd, an, { cap: mod === 'elle' ? 22 : 16 });
      if (o.yalnizCizgi) continue;
      const L = Math.hypot(hd[0] - t[0], hd[1] - t[1]) || 1;
      const u = [(hd[0] - t[0]) / L, (hd[1] - t[1]) / L];
      tutHalkasi(K, gIsaret, t, an, { cap: mod === 'elle' && E.surukle(h) ? 30 : 22 });
      kivrikOk(K, gIsaret, [t[0] + u[0] * 16, t[1] + u[1] * 16], [hd[0] - u[0] * 12, hd[1] - u[1] * 12], an,
        { bukum: 0.26 * (h.parca ? -1 : 1), gecikme: 120 });
    }
  }

  function paneliGuncelle() {
    if (!mod) return;
    const bitti = s === n;
    KL.harfle(sayac, bitti ? 'Bitti!' : `Adım ${s + 1} / ${n}${adim().hareketler.length > 1 ? ` · ${parca + 1}. taraf` : ''}`, { anlik: true });
    KL.harfle(metin, bitti ? `${tasarim.ad} hazır. Kanatlarını aç, uçmaya hazır.` : adim().adim.metin,
      { tohum: ['adim', tasarim.id, s], anlik: hizli });
    son.hidden = !bitti;
    modSatir.hidden = bitti;
    ipucu.hidden = bitti;
    gezinti.hidden = bitti;
    if (!bitti) {
      KL.harfle(modNotu, mod === 'elle' ? 'Elle: köşeyi sen sürüklersin, kalite senin elinde.' : `İzle: adımlar gösterilir, kalite sabit %${E.IZLE_KALITESI}.`, { anlik: true });
      const et = E.etkilesim(aktifHareket(), mod);
      KL.harfle(ipucu, et.ipucu, { anlik: true });
      KL.harfle(ileriD.querySelector('.yazi'), et.dugme, { anlik: true });
      ileriD.hidden = et.tur === 'surukle' || hizli;
      KL.harfle(hizliD.querySelector('.yazi'), hizli ? 'Dur' : 'Hızlı katla', { anlik: true });
    } else {
      const k = kaliteHesapla() ?? E.IZLE_KALITESI;
      const nasil = { elle: 'elle katlandı', izle: 'izleyerek katlandı', karma: 'elle ve izleyerek' }[modOzeti()];
      KL.harfle(kaliteP, `Katlama kalitesi: %${k} (${nasil})`, { anlik: true });
      KL.harfle(geriBildirim, k >= 85 ? 'Kanatlar dümdüz, tertemiz bir iş.' : k >= 60 ? 'Bir kanat azıcık yamuk ama uçar.' : 'Kanatlar biraz eğri; uçarken yalpalayabilir.', { anlik: true });
      if (!onerilenAd) onerilenAd = isimOnerEssiz(depo().ucaklar().map(u => u.ad));
      KL.harfle(adP, `Adı: ${onerilenAd}. Adlandır'da değiştirebilirsin.`, { anlik: true });
      requestAnimationFrame(() => { cerceveleriCiz(son, true); gorunumYazisi(); });
    }
    svg.classList.toggle('elle', mod === 'elle' && s < n);
    svg.classList.toggle('dokun', elleDokunma());
    svg.style.cursor = '';
    requestAnimationFrame(() => {
      cerceveleriCiz(gezinti, true);
      dugmeDurum(geriD, (s > 0 || parca > 0) && !mesgul);
      dugmeDurum(ileriD, s < n && !mesgul);
    });
  }

  function goster() { ciz(); paneliGuncelle(); }

  function basla(m) {
    mod = m;
    modGrubu.querySelectorAll('.dugme').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'mod-' + m)));
    goster();
    requestAnimationFrame(() => cerceveleriCiz(adimPanel));
  }

  // "Hızlı katla": kalan adımlar İZLE olarak, kısaltılmış animasyonla art arda; "Dur" süren hareketten sonra keser.
  async function hepsiniKatla() {
    if (mesgul || !mod || s >= n) return;
    const eskiMod = mod;
    hizli = true; mod = 'izle';
    while (s < n && hizli && ctx.gecerli()) {
      await ileri();
      if (!KL.animasyonVar()) await KL.bekle(60);
    }
    if (!ctx.gecerli()) return;
    hizli = false;
    if (s < n) mod = eskiMod;
    modGrubu.querySelectorAll('.dugme').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'mod-' + mod)));
    goster();
  }

  // Bitmiş uçağı eşsiz isimle hangara kaydet (bir kez) ve hedefe git. Atölye geçmişte hangarla değiştirilir:
  // tarayıcının geri tuşu bayat atölyeye dönüp ikinci bir uçak katlatmaz, uçağın asılı olduğu hangara döner.
  let kayitliId = null;
  function ucagiKaydet(hedef) {
    if (s !== n) return;
    const D = depo();
    if (!kayitliId) {
      const hassasiyetler = katlama.hareketler.filter(h => kayit[h.no]).map(h => kayit[h.no].hassasiyet);
      const u = yeniUcak({ tasarim: tasarim.id, kalite: kaliteHesapla() ?? E.IZLE_KALITESI, mod: modOzeti(), hassasiyetler, ayar: tasarim.varsayilanAyar });
      u.ad = onerilenAd || isimOnerEssiz(D.ucaklar().map(x => x.ad));
      kayitliId = D.ucakEkle(u);
      D.ayarGuncelle({ sonMod: mod });
    }
    const h = hedef(kayitliId);
    history.replaceState(null, '', '#/hangar');
    if (h === '#/hangar') window.dispatchEvent(new HashChangeEvent('hashchange'));
    else ctx.git(h);
  }

  /* ---------- animasyon ---------- */
  function oynat(sure, kare) {
    if (hizli) sure *= 0.45;
    return new Promise((bitir) => {
      if (!KL.animasyonVar()) { kare(1); bitir(); return; }
      const t0 = performance.now();
      const tik = (simdi) => {
        if (!ctx.gecerli()) { bitir(); return; }
        const u = Math.min(1, (simdi - t0) / sure);
        kare(egri(u));
        if (u < 1) requestAnimationFrame(tik); else bitir();
      };
      requestAnimationFrame(tik);
    });
  }

  const bekle = (ms) => (KL.animasyonVar() ? new Promise(r => setTimeout(r, hizli ? ms * 0.45 : ms)) : Promise.resolve());

  const kareCizici = (hz) => (th) => { gKagit.textContent = ''; kareCiz(gKagit, katlanis(hz, th), { olcek: S }); };

  function cevirKaresi(once, sonra, u) {
    gKagit.textContent = '';
    const k = Math.cos(Math.PI * u);
    const g = KL.svgEl('g', { transform: `translate(${ORTA * S} 0) scale(${Math.max(0.02, Math.abs(k)).toFixed(3)} 1) translate(${-ORTA * S} 0)` }, gKagit);
    durumCiz(g, u < 0.5 ? once : sonra, { olcek: S });
  }

  async function hareketOynat(h, yon) {
    const once = katlama.anlar[h.no], sonra = katlama.anlar[h.no + 1];
    if (h.tip === 'cevir') { await oynat(560, e => cevirKaresi(once, sonra, yon > 0 ? e : 1 - e)); return; }
    const kare = kareCizici(hazirla(once, h));
    if (h.ac) {
      // kapanır, bir an durur, yavaşça açılır: kat izinin nereden geldiği görünsün
      await oynat(440, e => kare(180 * e));
      await bekle(160);
      await oynat(560, e => kare(180 * (1 - e)));
      return;
    }
    await oynat(580, e => kare(180 * (yon > 0 ? e : 1 - e)));
  }

  // Sıradaki hareket bitti: kaydı yaz, adımın sonuna geldiyse bir sonraki adıma geç.
  function hareketBitti(h, hassasiyet, m) {
    if (h.tip !== 'cevir') window.Kit.ses.cal('katla');
    if (E.sayilir(h)) kayit[h.no] = { hassasiyet, mod: m };
    if (parca < adim().hareketler.length - 1) parca++;
    else { s++; parca = 0; sonGorunum = 'ucak'; }
  }

  async function ileri() {
    if (mesgul || s >= n || !mod) return;
    if (elleSurukleme()) return;                       // ELLE'de katlama sürükleyerek yapılır
    mesgul = true; paneliGuncelle();
    gIsaret.textContent = '';
    const kalanlar = adim().hareketler.slice(parca);
    for (const h of kalanlar) {
      await hareketOynat(h, 1);
      if (!ctx.gecerli()) return;
      hareketBitti(h, E.IZLE_KALITESI, mod);
      if (mod === 'elle' && s < n && E.surukle(aktifHareket())) break;   // çevir tek dokunuştu, sıradakini el katlar
    }
    mesgul = false;
    KL.harfle(geriBildirim, '', { anlik: true });
    goster();
  }

  async function geri() {
    if (mesgul || !mod || (s === 0 && parca === 0)) return;
    mesgul = true; paneliGuncelle();
    gIsaret.textContent = '';
    let geriAlinacak;
    if (parca > 0) { geriAlinacak = adim().hareketler.slice(0, parca); parca = 0; }
    else { s--; parca = 0; geriAlinacak = adim().hareketler; }
    for (const h of [...geriAlinacak].reverse()) {
      await hareketOynat(h, -1);
      if (!ctx.gecerli()) return;
      delete kayit[h.no];
    }
    mesgul = false;
    KL.harfle(geriBildirim, '', { anlik: true });
    goster();
  }

  /* ---------- ELLE: sürükleme ---------- */
  const kagitNoktasi = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / S, p.y / S];
  };
  const ekranNoktasi = ([x, y]) => new DOMPoint(x * S, y * S).matrixTransform(svg.getScreenCTM());
  const tutmaYaricapi = (e) => (e.pointerType === 'touch' ? 44 : 30);
  const tutmaYerinde = (e) => {
    const h = aktifHareket();
    const t = ekranNoktasi(h.tut);
    return Math.hypot(t.x - e.clientX, t.y - e.clientY) <= tutmaYaricapi(e);
  };

  function basildi(e) {
    if (mesgul || surukle || (e.button !== undefined && e.button > 0)) return;
    if (elleDokunma()) {                                 // çevir: kağıdın herhangi bir yerine dokun
      e.preventDefault();
      surukle = { dokun: true, id: e.pointerId, bas: [e.clientX, e.clientY], tasindi: false };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
      return;
    }
    if (!elleSurukleme()) return;
    if (!tutmaYerinde(e)) return;
    e.preventDefault();
    const h = aktifHareket();
    surukle = { h, hz: hazirla(gosterilenDurum(), h), id: e.pointerId, aci: 0, P: h.tut, tasindi: false, bas: [e.clientX, e.clientY], kare: null };
    surukle.kare = kareCizici(surukle.hz);
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    svg.classList.add('tutuyor');
    gIsaret.textContent = '';
    isaretleriCiz({ yalnizCizgi: true });
  }

  function surukleniyor(e) {
    if (!surukle) {
      if (elleSurukleme() && !mesgul) svg.style.cursor = tutmaYerinde(e) ? 'grab' : '';
      return;
    }
    if (e.pointerId !== surukle.id) return;
    if (surukle.dokun) {
      if (Math.hypot(e.clientX - surukle.bas[0], e.clientY - surukle.bas[1]) >= 8) surukle.tasindi = true;
      return;
    }
    if (!surukle.tasindi && Math.hypot(e.clientX - surukle.bas[0], e.clientY - surukle.bas[1]) < 4) return;
    surukle.tasindi = true;
    surukle.P = kagitNoktasi(e);
    surukle.aci = E.suruklemeAcisi(surukle.h, surukle.P);
    surukle.kare(surukle.aci);
  }

  async function birakildi(e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    const d = surukle;
    surukle = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    if (d.dokun) { if (!d.tasindi) ileri(); return; }
    svg.classList.remove('tutuyor');
    if (!d.tasindi) { ciz(); return; }
    const sonuc = E.birak(d.h, d.P);
    mesgul = true;
    if (sonuc.kabul) {
      await oynat(220, u => d.kare(d.aci + (180 - d.aci) * u));
      if (!ctx.gecerli()) return;
      const acilir = E.kabulAnimasyonu(d.h) === 'kapat-ac';
      if (acilir) {
        await bekle(160);
        await oynat(560, u => d.kare(180 * (1 - u)));
        if (!ctx.gecerli()) return;
      }
      hareketBitti(d.h, sonuc.hassasiyet, 'elle');
      mesgul = false;
      const k = kaliteHesapla();
      KL.harfle(geriBildirim, acilir ? 'Kat izi kaldı; kağıt yeniden açık.'
        : `Bu kat: %${sonuc.hassasiyet}${k != null ? ` · ortalama %${k}` : ''}`, { anlik: true });
      goster();
    } else {
      await oynat(300, u => d.kare(d.aci * (1 - u)));
      if (!ctx.gecerli()) return;
      mesgul = false;
      const kisa = Math.abs(E.dikKonum(d.h, d.P)) > 0 && E.dikKonum(d.h, d.P) > -E.eksen(d.h).dT;
      KL.harfle(geriBildirim, kisa ? 'Olmadı, kağıt geri açıldı. Köşeyi hayalet işarete kadar götür.' : 'Fazla çektin; kağıt geri açıldı. Tam işaretin üstünde bırak.', { anlik: true });
      ciz();
    }
  }
  function iptal(e) {
    if (!surukle || e.pointerId !== surukle.id) return;
    const dokun = surukle.dokun;
    surukle = null;
    if (dokun) return;
    svg.classList.remove('tutuyor');
    ciz();
  }
  svg.addEventListener('pointerdown', basildi);
  svg.addEventListener('pointermove', surukleniyor);
  svg.addEventListener('pointerup', birakildi);
  svg.addEventListener('pointercancel', iptal);

  const tus = (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); ileri(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); geri(); }
  };
  document.addEventListener('keydown', tus);

  basla(depo().ayarlar().sonMod || 'izle');
  requestAnimationFrame(() => cerceveleriCiz(kap));

  return {
    sok() { document.removeEventListener('keydown', tus); },
    boyut() { cerceveleriCiz(kap, true); paneliGuncelle(); },
    // test/önizleme için durum
    get durum() { return { mod, s, parca, kayit: { ...kayit }, kalite: kaliteHesapla() }; },
  };
}
