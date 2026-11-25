// #/adlandir/:ucakId — isim, boya, ayar. Üstten, kanatlar açık görünüş üzerinde çalışılır.
// Boya çizgileri kanadın düzleminde (son durumun 2B koordinatı) ve düz kağıt koordinatıyla saklanır.
// Her değişiklik hemen kaydedilir; "Hangara as" yalnız sayfayı değiştirir.
import { UCLAR, UC_SIRASI, cizgiStili, isimStiliDuzelt } from '../engine/murekkep.js';
import { RENK } from './renkler.js';
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman, secimGrubu } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { ucakCiz, ucakModeli, boyaCizgisi, durumCiz, RENKLER } from './ucakCiz.js';
import { kirisikDeseni, boyaDeseni } from '../engine/baski.js';
import { KAMERALAR, boyaNoktasi } from '../engine/poz.js';
import { depo } from '../depo.js';
import { isimOner } from '../isimler.js';
import { ucusRotasi } from '../engine/akis.js';

const S = 300;

// Üstten görünüş çerçevesi (kağıt birimi): uçağın boyu (X) ve kanat açıklığı (Y) kadar, en az 1.7 × 1.08.
export function usttenCerceve(model) {
  const n = model.parcalar.flatMap(p => p.noktalar3);
  const x = Math.max(...n.map(q => Math.abs(q[0]))), y = Math.max(...n.map(q => Math.abs(q[1])));
  return { w: Math.max(1.7, 2 * x + 0.24), h: Math.max(1.08, 2 * y + 0.24) };
}
const MIN_ARALIK = 0.004, SILGI = 0.03, EN_COK_CIZGI = 300, EN_COK_NOKTA = 500;

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const D = depo();
  let ucak = D.ucak(params.ucakId);
  let veri = null;
  if (ucak) { try { veri = await tasarimYukle(ucak.tasarim); } catch (e) { veri = null; } }
  if (!ctx.gecerli()) return {};
  if (!ucak || !veri) {
    ust(kap, 'Uçak bulunamadı', { geri: { hash: '#/hangar', yazi: 'hangar' } });
    not(kap, 'Bu uçak hangarda yok. Belki başka bir tarayıcıda katlandı?');
    requestAnimationFrame(() => cerceveleriCiz(kap));
    return {};
  }
  const { tasarim, katlama } = veri;
  const VB = usttenCerceve(ucakModeli(katlama, { ayar: { kivrimSol: 1, kivrimSag: 1, kanatcik: 2 } }));
  const { en: EN, boy: BOY } = katlama.kagit;

  ust(kap, ucak.ad ? ucak.ad : 'Uçağını adlandır', { geri: { hash: '#/hangar', yazi: 'hangar' } });
  const duzen = el('div', { sinif: 'adlandir' }, kap);
  const sol = el('div', { sinif: 'adlandir-ucak' }, duzen);
  const panel = el('aside', { sinif: 'adlandir-panel' }, duzen);

  // görünüm: uçakta (üstten, kanatlar açık) ya da düz kağıt (ön/arka yüz)
  let gorunum = 'ucak';
  const gorunumSatir = el('div', { sinif: 'satir-alan' }, sol);
  secimGrubu(gorunumSatir, [
    { id: 'gor-ucak', yazi: 'uçakta', deger: 'ucak' },
    { id: 'gor-on', yazi: 'düz kağıt: ön', deger: 'on' },
    { id: 'gor-arka', yazi: 'düz kağıt: arka', deger: 'arka' },
  ], gorunum, (v) => { gorunum = v; svg.toggleAttribute('hidden', v !== 'ucak'); duzSvg.toggleAttribute('hidden', v === 'ucak'); ipucu(); ciz(); }, { etiket: 'Görünüm' });
  const svg = svgKatman(sol, VB.w * S, VB.h * S, 'boya-svg');
  svg.setAttribute('viewBox', `${-VB.w * S / 2} ${-VB.h * S / 2} ${VB.w * S} ${VB.h * S}`);
  svg.setAttribute('aria-label', `${tasarim.ad}: üstten görünüş, kanatlara çizilebilir`);
  const gUcak = KL.svgEl('g', null, svg);
  const duzSvg = svgKatman(sol, (EN + 0.1) * S, (BOY + 0.1) * S, 'boya-svg duz-svg');
  duzSvg.setAttribute('viewBox', `${-0.05 * S} ${-0.05 * S} ${(EN + 0.1) * S} ${(BOY + 0.1) * S}`);
  duzSvg.setAttribute('aria-label', 'Düz kağıt: katlanınca çizdiğin yer uçakta nereye düşerse orada görünür');
  duzSvg.setAttribute('hidden', '');
  const gDuz = KL.svgEl('g', null, duzSvg);
  const ipucuP = not(sol, '');
  const ipucu = () => KL.harfle(ipucuP, gorunum === 'ucak' ? 'Kanatlara kalemle yaz, çiz. İsim sağ kanada kendiliğinden yazılır.'
    : 'Kağıt açıkken çiz: silik çizgiler kırışıklar. Katlanınca çizgin kağıdın o parçası nereye düşerse orada çıkar; yandaki küçük uçağa bak.', { anlik: true });
  ipucu();

  /* ---------- panel ---------- */
  const bilgi = el('p', { sinif: 'not' }, panel);
  KL.harfle(bilgi, `${tasarim.ad} · katlama kalitesi %${ucak.kalite}`, { anlik: true });

  const isimSatir = el('div', { sinif: 'satir-alan' }, panel);
  const etiket = el('label', { sinif: 'etiket', for: 'ucak-adi' }, isimSatir);
  KL.harfle(etiket, 'Adı:', { anlik: true });
  const girdi = el('input', { id: 'ucak-adi', type: 'text', maxlength: 24, autocomplete: 'off', spellcheck: 'false', placeholder: 'İsimsiz' }, isimSatir);
  girdi.value = ucak.ad;
  const cizgiSvg = KL.svgEl('svg', { class: 'girdi-cizgi', 'aria-hidden': 'true' }, isimSatir);
  dugme(isimSatir, { id: 'isim-oner', yazi: SZ.yan.isimOner, sinif: 'kucuk', tik: () => { girdi.value = isimOner(); adDegisti(); } });

  const satir = (yazi) => { const d = el('div', { sinif: 'satir-alan' }, panel); KL.harfle(el('span', { sinif: 'etiket' }, d), yazi, { anlik: true }); return d; };

  // ismin stili: renk, boyut, biçim (kanatta, uçuşta ve baskıda aynı)
  ucak.isimStili = isimStiliDuzelt(ucak.isimStili);
  const stilSec = (yazi, anahtar, secenekler) => secimGrubu(satir(yazi), secenekler.map(([d, y, renk]) => ({ id: `isim-${anahtar}-${d}`, yazi: y, deger: d, renk })),
    ucak.isimStili[anahtar], (v) => { ucak.isimStili = { ...ucak.isimStili, [anahtar]: v }; degisti(); }, { etiket: `İsim ${yazi}`, sinif: anahtar === 'renk' ? 'renkli' : '' });
  stilSec('Yazı:', 'renk', [['mavi', 'mavi', RENK.mavi], ['kirmizi', 'kırmızı', RENK.kirmizi], ['yesil', 'yeşil', RENK.yesil]]);
  stilSec('Boyut:', 'boyut', [['kucuk', 'küçük'], ['orta', 'orta'], ['buyuk', 'büyük']]);
  stilSec('Biçim:', 'bicim', [['el', 'el yazısı'], ['buyuk', 'BÜYÜK HARF'], ['cizgili', 'altı çizili']]);

  let kalem = 'mavi';
  secimGrubu(satir('Kalem:'), [
    { id: 'kalem-mavi', yazi: 'mavi', deger: 'mavi', renk: RENK.mavi },
    { id: 'kalem-kirmizi', yazi: 'kırmızı', deger: 'kirmizi', renk: RENK.kirmizi },
    { id: 'kalem-yesil', yazi: 'yeşil', deger: 'yesil', renk: RENK.yesil },
    { id: 'kalem-silgi', yazi: 'silgi', deger: 'silgi' },
  ], kalem, (v) => { kalem = v; }, { etiket: 'Kalem', sinif: 'renkli' });
  let uc = 'orta';                                         // ince kalemden fırçaya
  secimGrubu(satir('Uç:'), UC_SIRASI.map(k => ({ id: 'uc-' + k, yazi: UCLAR[k].ad, deger: k })), uc, (v) => { uc = v; }, { etiket: 'Kalem ucu' });
  const yeniCizgi = (ek) => ({ renk: kalem, kalinlik: UCLAR[uc].kalinlik, ...(UCLAR[uc].firca ? { firca: true } : {}), ...ek });
  const temizleSatir = el('div', { sinif: 'satir-alan' }, panel);
  // bütün boyayı silmek geri alınamaz: ilk dokunuş sorar, ikincisi siler (3 sn içinde)
  let silOnay = 0;
  const silD = dugme(temizleSatir, { id: 'boya-temizle', yazi: SZ.tehlikeli.boyaSil, sinif: 'kucuk', onem: 'ucuncul', tehlikeli: true, tik: () => {
    if (!silOnay) {
      KL.harfle(silD.querySelector('.yazi'), `${SZ.tehlikeli.boyaSilEvet}?`, { anlik: true });
      cerceveleriCiz(temizleSatir, true);
      silOnay = setTimeout(() => { silOnay = 0; KL.harfle(silD.querySelector('.yazi'), SZ.tehlikeli.boyaSil, { anlik: true }); cerceveleriCiz(temizleSatir, true); }, 3000);
      return;
    }
    clearTimeout(silOnay); silOnay = 0;
    ucak.boya.cizgiler = []; degisti();
    KL.harfle(silD.querySelector('.yazi'), SZ.tehlikeli.boyaSil, { anlik: true });
    cerceveleriCiz(temizleSatir, true);
  } });

  const son = el('nav', { sinif: 'dugmeler' }, panel);
  dugme(son, { id: 'adlandir-ucur', yazi: 'Uçur →', href: ucusRotasi(ucak.id, D.ayarlar()), onem: 'birincil' });
  dugme(son, { id: 'hangara-as', yazi: SZ.ileri.hangaraAs, href: '#/hangar' });

  KL.harfle(el('h2', { sinif: 'bolum' }, panel), 'İnce ayar');

  const ayarSec = (yazi, anahtar, secenekler) => secimGrubu(satir(yazi), secenekler.map(([d, y]) => ({ id: `ayar-${anahtar}-${d}`, yazi: y, deger: d })),
    ucak.ayar[anahtar], (v) => { ucak.ayar[anahtar] = v; degisti(); }, { etiket: yazi });
  ayarSec('Kanatçıklar:', 'kanatcik', [[-2, '↓↓'], [-1, '↓'], [0, 'düz'], [1, '↑'], [2, '↑↑']]);
  ayarSec('Sol kanat ucu:', 'kivrimSol', [[-1, '↓'], [0, 'düz'], [1, '↑']]);
  ayarSec('Sağ kanat ucu:', 'kivrimSag', [[-1, '↓'], [0, 'düz'], [1, '↑']]);
  ayarSec('Burunda ataç:', 'atac', [[0, 'yok'], [1, '1'], [2, '2']]);

  const onizleme = svgKatman(panel, 360, 190, 'onizleme');
  onizleme.setAttribute('aria-label', 'Uçağın yandan görünüşü');
  const gOn = KL.svgEl('g', null, onizleme);

  /* ---------- çizim ve kayıt ---------- */
  let sonuc = null;
  function ciz() {
    gUcak.textContent = '';
    sonuc = ucakCiz(gUcak, katlama, { ucak, kamera: KAMERALAR.USTTEN, merkez: [0, 0], olcek: S, zemin: -0.3, golge: { dx: 10, dy: 14, opaklik: .15 }, bulaniklik: 5 });
    gOn.textContent = '';
    ucakCiz(gOn, katlama, { ucak, merkez: [180, 80], olcek: 170, zemin: -0.38 });
    if (gorunum !== 'ucak') duzCiz();
  }
  const desen = kirisikDeseni(katlama.son);
  const aynala = (x) => (gorunum === 'arka' ? EN - x : x);
  function duzCiz() {
    gDuz.textContent = '';
    durumCiz(gDuz, katlama.anlar[0], { olcek: S });
    for (const k of desen.kirisikler) {
      KL.svgEl('line', { x1: aynala(k.p1[0]) * S, y1: k.p1[1] * S, x2: aynala(k.p2[0]) * S, y2: k.p2[1] * S, stroke: 'rgba(122,122,122,.35)', 'stroke-width': 1, 'stroke-dasharray': '6 5' }, gDuz);
    }
    const yuzde = boyaDeseni(katlama.son, sonuc ? sonuc.model : null, ucak.boya.cizgiler.filter(c => !c.duz))[gorunum] || [];
    for (const cz of yuzde) {                                 // kanatta çizilmiş mürekkep: burada yalnız gösterilir
      KL.svgEl('path', { d: 'M' + cz.noktalar.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join('L'), fill: 'none', stroke: RENKLER[cz.renk], 'stroke-width': cizgiStili(cz).kalinlik * 3, 'stroke-linecap': 'round', opacity: cizgiStili(cz).saydamlik * .55 }, gDuz);
    }
    for (const cz of ucak.boya.cizgiler.filter(c => c.duz && c.yuz === gorunum)) duzYol(cz);
  }
  function duzYol(cz) {
    const n = cz.noktalar;
    const d = n.length === 1 ? `M${aynala(n[0][0]) * S},${n[0][1] * S}l0.01,0` : 'M' + n.map(([x, y]) => `${(aynala(x) * S).toFixed(1)},${(y * S).toFixed(1)}`).join('L');
    const st = cizgiStili(cz);
    return KL.svgEl('path', { d, fill: 'none', stroke: RENKLER[cz.renk], 'stroke-width': st.kalinlik * 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: st.saydamlik }, gDuz);
  }
  function kaydet() { ucak = D.ucakGuncelle(ucak.id, { ad: ucak.ad, boya: ucak.boya, ayar: ucak.ayar, isimStili: ucak.isimStili, eskiModel: false }) || ucak; }
  function degisti() { ciz(); kaydet(); }
  let adZaman = 0, adBekliyor = false;
  function adDegisti() {
    ucak.ad = girdi.value.trim().slice(0, 24);
    clearTimeout(adZaman);
    adBekliyor = true;
    adZaman = setTimeout(() => {
      adBekliyor = false;
      degisti();
      const h = kap.querySelector('.baslik');
      if (h) KL.harfle(h, ucak.ad || 'Uçağını adlandır', { anlik: true });
    }, 150);
  }
  // Sayfadan çıkarken (Uçur, geri, sekme kapanışı) bekleyen ad kaybolmasın: hemen yazılır.
  const adiYaz = () => { if (adBekliyor) { clearTimeout(adZaman); adBekliyor = false; kaydet(); } };
  window.addEventListener('pagehide', adiYaz);
  girdi.addEventListener('input', adDegisti);
  girdi.addEventListener('keydown', (e) => { if (e.key === 'Enter') girdi.blur(); });

  function girdiCizgisi() {
    const w = girdi.offsetWidth;
    cizgiSvg.setAttribute('viewBox', `0 0 ${w} 8`);
    cizgiSvg.setAttribute('width', w);
    cizgiSvg.setAttribute('height', 8);
    cizgiSvg.style.width = w + 'px';
    cizgiSvg.textContent = '';
    KL.kalemYap(cizgiSvg).cizgi(cizgiSvg, [2, 4, w - 2, 5], { stroke: KL.renkDeger('kursun'), strokeWidth: 1.2 }, ['girdi', 'ad'], { anlik: true });
  }

  /* ---------- boya: işaretçi ---------- */
  let cizim = null;              // { id, kanat, cizgi, yol }
  const svgNoktasi = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  // ekran → { kanat, yerel [x, y] (kağıt 2B), bilgi } ya da null
  function kanattaNokta(e) {
    const p = svgNoktasi(e);
    for (const kanat of ['sag', 'sol']) {
      const c = sonuc && sonuc.cerceveler[kanat];
      if (!c || !c.gorunur) continue;
      const yerel = c.yerele(p);
      const b = boyaNoktasi(katlama.son, sonuc.model, kanat, yerel);
      if (b) return { kanat, yerel, bilgi: b };
    }
    return null;
  }
  function sil(e) {
    const k = kanattaNokta(e);
    if (!k) return false;
    const once = ucak.boya.cizgiler.length;
    ucak.boya.cizgiler = ucak.boya.cizgiler.filter(cz => cz.kanat !== k.kanat ||
      !cz.noktalar.some(q => Math.hypot(q[0] - k.yerel[0], q[1] - k.yerel[1]) < SILGI));
    if (ucak.boya.cizgiler.length !== once) { ciz(); return true; }
    return false;
  }
  function noktaEkle(k) {
    const n = cizim.cizgi.noktalar;
    const son_ = n[n.length - 1];
    if (son_ && Math.hypot(son_[0] - k.yerel[0], son_[1] - k.yerel[1]) < MIN_ARALIK) return;
    if (n.length >= EN_COK_NOKTA) return;
    n.push([+k.yerel[0].toFixed(4), +k.yerel[1].toFixed(4), k.bilgi.poligonId, +k.bilgi.fx.toFixed(4), +k.bilgi.fy.toFixed(4)]);
    if (cizim.yol) cizim.yol.remove();
    const katman = sonuc.boyaKatmani[cizim.kanat];
    if (katman) cizim.yol = boyaCizgisi(katman, cizim.cizgi);
  }
  function cizgiBitir() {
    if (!cizim) return;
    if (cizim.cizgi.noktalar.length && ucak.boya.cizgiler.length < EN_COK_CIZGI) ucak.boya.cizgiler.push(cizim.cizgi);
    cizim = null;
  }
  function basladi(k) { cizim = { kanat: k.kanat, cizgi: yeniCizgi({ kanat: k.kanat, noktalar: [] }), yol: null }; noktaEkle(k); }

  let aktifIsaretci = null, silindi = false;
  svg.addEventListener('pointerdown', (e) => {
    if (aktifIsaretci !== null || (e.button !== undefined && e.button > 0)) return;
    aktifIsaretci = e.pointerId;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    e.preventDefault();
    if (kalem === 'silgi') { silindi = sil(e) || silindi; return; }
    const k = kanattaNokta(e);
    if (k) basladi(k);
  });
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aktifIsaretci) return;
    if (kalem === 'silgi') { silindi = sil(e) || silindi; return; }
    const k = kanattaNokta(e);
    if (!k) { cizgiBitir(); return; }                        // kanattan çıktı: çizgi biter
    if (cizim && cizim.kanat !== k.kanat) cizgiBitir();
    if (!cizim) basladi(k); else noktaEkle(k);
  });
  const bitir = (e) => {
    if (e.pointerId !== aktifIsaretci) return;
    aktifIsaretci = null;
    if (kalem === 'silgi') { if (silindi) kaydet(); silindi = false; return; }
    const vardi = !!cizim;
    cizgiBitir();
    if (vardi) degisti();
  };
  svg.addEventListener('pointerup', bitir);
  svg.addEventListener('pointercancel', bitir);

  /* ---------- düz kağıtta boyama ---------- */
  let duzCizim = null, duzIsaretci = null, duzSilindi = false;
  const duzNokta = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(duzSvg.getScreenCTM().inverse());
    const x = p.x / S, y = p.y / S;
    if (x < 0 || x > EN || y < 0 || y > BOY) return null;
    return [+aynala(x).toFixed(4), +y.toFixed(4)];
  };
  function duzSil(q) {
    const once = ucak.boya.cizgiler.length;
    ucak.boya.cizgiler = ucak.boya.cizgiler.filter(cz => !cz.duz || cz.yuz !== gorunum || !cz.noktalar.some(n => Math.hypot(n[0] - q[0], n[1] - q[1]) < SILGI));
    if (ucak.boya.cizgiler.length !== once) { duzSilindi = true; duzCiz(); }
  }
  duzSvg.addEventListener('pointerdown', (e) => {
    if (duzIsaretci !== null || (e.button !== undefined && e.button > 0)) return;
    const q = duzNokta(e);
    if (!q) return;
    duzIsaretci = e.pointerId;
    try { duzSvg.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    e.preventDefault();
    if (kalem === 'silgi') { duzSil(q); return; }
    duzCizim = { cz: yeniCizgi({ duz: true, yuz: gorunum, noktalar: [q] }), yol: null };
    duzCizim.yol = duzYol(duzCizim.cz);
  });
  duzSvg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== duzIsaretci) return;
    const q = duzNokta(e);
    if (!q) return;
    if (kalem === 'silgi') { duzSil(q); return; }
    const n = duzCizim.cz.noktalar, son_ = n[n.length - 1];
    if (Math.hypot(son_[0] - q[0], son_[1] - q[1]) < MIN_ARALIK || n.length >= EN_COK_NOKTA) return;
    n.push(q);
    duzCizim.yol.remove();
    duzCizim.yol = duzYol(duzCizim.cz);
  });
  const duzBitir = (e) => {
    if (e.pointerId !== duzIsaretci) return;
    duzIsaretci = null;
    if (kalem === 'silgi') { if (duzSilindi) { duzSilindi = false; degisti(); } return; }
    if (duzCizim && ucak.boya.cizgiler.length < EN_COK_CIZGI) ucak.boya.cizgiler.push(duzCizim.cz);
    duzCizim = null;
    degisti();
  };
  duzSvg.addEventListener('pointerup', duzBitir);
  duzSvg.addEventListener('pointercancel', duzBitir);

  ciz();
  requestAnimationFrame(() => { cerceveleriCiz(kap); girdiCizgisi(); });
  return {
    boyut() { cerceveleriCiz(kap, true); girdiCizgisi(); },
    sok() { adiYaz(); window.removeEventListener('pagehide', adiYaz); },
    get ucak() { return ucak; },
  };
}
