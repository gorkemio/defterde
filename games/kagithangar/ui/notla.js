// #/notla/:ucakId — Notla gönder: kağıda not yazılır, kağıt katlanır, uçak uçar; veri lz-string ile bağlantıya
// sıkıştırılır. Bağlantıyı kopyalamak/paylaşmak kullanıcının işidir (hiçbir yere kendiliğinden gönderilmez).
import { cizgiStili } from '../engine/murekkep.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman, dugmeDurum } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { durumCiz, ucakCiz, ucakModeli, RENKLER } from './ucakCiz.js';
import { atolyeCercevesi } from './atolye.js';
import { hepsiniKatla, notuYaz } from './katlamaOynat.js';
import { boyaDeseni } from '../engine/baski.js';
import { notPaketle, NOT_SINIRI } from '../engine/not.js';
import { depo } from '../depo.js';

const S = 300;

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const D = depo();
  const ucak = D.ucak(params.ucakId);
  let veri = null;
  if (ucak) { try { veri = await tasarimYukle(ucak.tasarim); } catch (e) { veri = null; } }
  if (!ctx.gecerli()) return {};
  ust(kap, ucak ? `Notla gönder · ${ucak.ad || 'İsimsiz'}` : 'Uçak bulunamadı', { geri: { hash: '#/hangar', yazi: 'hangar' } });
  if (!ucak || !veri) { not(kap, 'Bu uçak hangarda yok.'); requestAnimationFrame(() => cerceveleriCiz(kap)); return {}; }
  if (typeof LZString === 'undefined') { not(kap, 'Sıkıştırma kütüphanesi (lz-string) yüklenemedi; internet bağlantını kontrol et.'); return {}; }
  const { tasarim, katlama } = veri;
  const VB = atolyeCercevesi(katlama);

  const duzen = el('div', { sinif: 'atolye' }, kap);
  const masa = el('div', {}, duzen);
  const panel = el('aside', { sinif: 'atolye-panel' }, duzen);
  const svg = svgKatman(masa, VB.w * S, VB.h * S, 'atolye-svg');
  svg.setAttribute('viewBox', `${VB.x * S} ${VB.y * S} ${VB.w * S} ${VB.h * S}`);
  svg.setAttribute('aria-label', 'Not yazılan kağıt');
  const gKagit = KL.svgEl('g', null, svg), gNot = KL.svgEl('g', null, svg), gUcak = KL.svgEl('g', { class: 'ucan' }, svg);

  // düz kağıt + ön yüze düşen boya (uçağın kendi deseni) + not
  const model = ucakModeli(katlama, { kalite: ucak.kalite, ayar: ucak.ayar });
  const boya = boyaDeseni(katlama.son, model, ucak.boya.cizgiler);
  function duzCiz() {
    gKagit.textContent = '';
    durumCiz(gKagit, katlama.anlar[0], { olcek: S });
    for (const cz of boya.on) {
      KL.svgEl('path', { d: 'M' + cz.noktalar.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join('L'), fill: 'none', stroke: RENKLER[cz.renk], 'stroke-width': cizgiStili(cz).kalinlik * 3, 'stroke-linecap': 'round', opacity: cizgiStili(cz).saydamlik }, gKagit);
    }
  }
  duzCiz();

  const yonerge = el('p', { sinif: 'adim-metni' }, panel);
  KL.harfle(yonerge, 'Kağıda notunu yaz. Sonra katla ve uçur.');
  const alan = el('textarea', { id: 'not-metni', maxlength: NOT_SINIRI, rows: 5, sinif: 'not-alani', 'aria-label': 'Not', placeholder: 'Teneffüste bahçede buluşalım…' }, panel);
  const imzaSatir = el('div', { sinif: 'satir-alan' }, panel);
  KL.harfle(el('label', { sinif: 'etiket', for: 'not-imza' }, imzaSatir), 'İmza:', { anlik: true });
  const imza = el('input', { id: 'not-imza', type: 'text', maxlength: 24, sinif: 'imza-girdi', autocomplete: 'off' }, imzaSatir);
  imza.value = D.ayarlar().pilotAdi || '';
  const nav = el('nav', { sinif: 'dugmeler' }, panel);
  const katlaD = dugme(nav, { id: 'not-katla', yazi: 'Katla ve uçur →', tik: () => gonder() });
  const sonuc = el('div', { sinif: 'not-sonucu', hidden: true }, panel);

  let zaman = 0;
  const notuGuncelle = () => { gNot.textContent = ''; notuYaz(gNot, alan.value, S, { anlik: true, imza: imza.value.trim(), kagit: katlama.kagit }); };
  alan.addEventListener('input', () => { clearTimeout(zaman); zaman = setTimeout(notuGuncelle, 120); });
  imza.addEventListener('input', () => { clearTimeout(zaman); zaman = setTimeout(notuGuncelle, 120); });

  async function gonder() {
    if (!alan.value.trim()) { alan.focus(); KL.harfle(yonerge, 'Önce bir şey yaz; boş kağıt uçmaz.', { anlik: true }); return; }
    dugmeDurum(katlaD, false);
    alan.disabled = true; imza.disabled = true;
    if (imza.value.trim()) D.ayarGuncelle({ pilotAdi: imza.value.trim() });
    // not içeride kalır: katlanmaya başlarken yazı solar
    gNot.animate ? gNot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }) : (gNot.style.opacity = 0);
    await hepsiniKatla(gKagit, katlama, { olcek: S, sure: 260, gecerli: ctx.gecerli });
    if (!ctx.gecerli()) return;
    gKagit.textContent = '';
    ucakCiz(gUcak, katlama, { ucak, merkez: [(VB.x + VB.w / 2) * S, (VB.y + VB.h * 0.45) * S], olcek: S * 0.8, zemin: -0.4 });
    if (KL.animasyonVar() && gUcak.animate) {
      await gUcak.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${S * 1.6}px, ${-S * 0.5}px) rotate(-8deg)` }],
        { duration: 900, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    }
    if (!ctx.gecerli()) return;
    const paket = notPaketle(ucak, alan.value.trim(), imza.value.trim());
    const kod = LZString.compressToEncodedURIComponent(JSON.stringify(paket));
    const url = `${location.href.split('#')[0]}#/not/${kod}`;
    sonucGoster(url);
  }

  function sonucGoster(url) {
    sonuc.hidden = false;
    sonuc.textContent = '';
    KL.harfle(el('p', { sinif: 'not mavi' }, sonuc), 'Uçak yola çıktı! Bu bağlantıyı alan kişi uçağı yakalayıp notunu okuyabilir.', { anlik: true });
    const kutu = el('input', { type: 'text', readonly: true, sinif: 'baglanti-kutusu', 'aria-label': 'Not bağlantısı' }, sonuc);
    kutu.value = url;
    kutu.addEventListener('focus', () => kutu.select());
    const s = el('nav', { sinif: 'dugmeler' }, sonuc);
    const durum = el('p', { sinif: 'not' }, sonuc);
    dugme(s, { id: 'not-kopyala', yazi: 'Bağlantıyı kopyala', tik: async () => {
      try { await navigator.clipboard.writeText(url); KL.harfle(durum, 'Kopyalandı.', { anlik: true }); } catch (e) { kutu.select(); KL.harfle(durum, 'Kopyalanamadı; seçili bağlantıyı elle kopyala.', { anlik: true }); }
    } });
    if (navigator.share) dugme(s, { id: 'not-paylas', yazi: 'Paylaş', tik: () => navigator.share({ title: 'Kağıt Hangar', text: 'Sana bir kağıt uçak gönderdim!', url }).catch(() => {}) });
    if (url.length > 8000) KL.harfle(durum, 'Bağlantı uzun çıktı; bazı uygulamalar kesebilir.', { anlik: true });
    requestAnimationFrame(() => cerceveleriCiz(sonuc));
  }

  requestAnimationFrame(() => { cerceveleriCiz(kap); alan.focus({ preventScroll: true }); });
  return { sok() { clearTimeout(zaman); }, boyut() { cerceveleriCiz(kap, true); } };
}
