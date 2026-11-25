// #/not/:veri — Bir not geldi: kağıt uçak ekrana süzülür; yakalayınca motor tersine çalışır, kağıt adım adım açılır,
// not okunur. Bağlantıdan gelen veri güvenilmez: notCoz sıkı doğrular.
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { durumCiz, ucakCiz, ucakModeli, RENKLER } from './ucakCiz.js';
import { hepsiniAc, notuYaz } from './katlamaOynat.js';
import { notCoz } from '../engine/not.js';
import { boyaNoktasi } from '../engine/poz.js';
import { boyaDeseni } from '../engine/baski.js';
import { depo, yeniUcak } from '../depo.js';

const S = 300;
const VB = { x: -0.5, y: -0.25, w: 2.0, h: 1.9 };

function karma(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  let gelen = null, hata = '';
  try {
    if (typeof LZString === 'undefined') throw new Error('lz-string yüklenemedi');
    if (params.veri.length > 20000) throw new Error('bağlantı çok uzun');
    const metin = LZString.decompressFromEncodedURIComponent(params.veri);
    if (!metin || metin.length > 60000) throw new Error('bağlantı bozuk');
    gelen = notCoz(JSON.parse(metin));
  } catch (e) { hata = e.message; }
  let veri = null;
  if (gelen) { try { veri = await tasarimYukle(gelen.tasarim); } catch (e) { hata = e.message; } }
  if (!ctx.gecerli()) return {};
  if (!gelen || !veri) {
    ust(kap, 'Bu not okunamadı', { geri: { hash: '#/masa', yazi: 'masa' } });
    not(kap, `Bağlantı eksik ya da bozuk görünüyor (${hata}). Gönderenden yeniden iste.`);
    requestAnimationFrame(() => cerceveleriCiz(kap));
    return {};
  }
  const { tasarim, katlama } = veri;
  const D = depo();
  const kaynak = karma(params.veri);

  // gelen uçağın kaydı: boya noktaları alıcının motorunda yeniden eşlenir (katman + düz kağıt)
  const model = ucakModeli(katlama, { kalite: gelen.kalite, ayar: gelen.ayar });
  const cizgiler = gelen.cizgiler.map(c => (c.duz ? c : {
    ...c, noktalar: c.noktalar.map(([x, y]) => {
      const b = boyaNoktasi(katlama.son, model, c.kanat, [x, y]);
      return b ? [x, y, b.poligonId, +b.fx.toFixed(4), +b.fy.toFixed(4)] : null;
    }).filter(Boolean),
  })).filter(c => c.noktalar.length);
  const ucak = { id: 'gelen-' + kaynak, ad: gelen.ad, kalite: gelen.kalite, ayar: gelen.ayar, boya: { cizgiler }, isimStili: gelen.isimStili };

  ust(kap, gelen.gonderen ? `${gelen.gonderen} sana bir uçak gönderdi` : 'Sana bir uçak geldi', { geri: { hash: '#/masa', yazi: 'masa' } });
  const ipucu = el('p', { sinif: 'adim-metni' }, kap);
  KL.harfle(ipucu, 'Bir kağıt uçak süzülüyor… yakala!');
  if (gelen.eskiKalip) {
    const n = el('p', { sinif: 'not' }, kap);
    KL.harfle(n, 'Bu uçak tasarımın eski kalıbıyla katlanmış; yazısı ve uçağı geldi ama boyası yeni kalıba oturmadığı için gelmedi.', { anlik: true });
  }
  const svg = svgKatman(kap, VB.w * S, VB.h * S, 'not-sahnesi', 'group');
  svg.setAttribute('viewBox', `${VB.x * S} ${VB.y * S} ${VB.w * S} ${VB.h * S}`);
  const gKagit = KL.svgEl('g', null, svg), gNot = KL.svgEl('g', null, svg);
  const gUcak = KL.svgEl('g', { class: 'gelen-ucak', role: 'button', tabindex: 0, 'aria-label': 'Uçağı yakala' }, svg);
  ucakCiz(gUcak, katlama, { ucak, merkez: [0, 0], olcek: S * 0.75, zemin: -0.5 });
  const nav = el('nav', { sinif: 'dugmeler' }, kap);
  const yakalaD = dugme(nav, { id: 'not-yakala', yazi: 'Yakala!', tik: () => yakala() });

  // süzülme: soldan sağa doğru alçalan, hafif dalgalı yol; merkezde durur
  let yakalandi = false, cerceve = 0;
  const t0 = performance.now(), SURE = 2600;
  const hedef = [0.5 * S, 0.75 * S];
  function suz(simdi) {
    if (yakalandi || !ctx.gecerli()) return;
    const u = Math.min(1, (simdi - t0) / SURE);
    const e = 1 - Math.pow(1 - u, 2);
    const x = -0.9 * S + (hedef[0] + 0.9 * S) * e;
    const y = 0.1 * S + (hedef[1] - 0.1 * S) * e + Math.sin(u * Math.PI * 3) * 0.05 * S * (1 - u);
    const a = -10 * (1 - u) + Math.sin(u * Math.PI * 3) * 4 * (1 - u);
    gUcak.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)})`);
    cerceve = requestAnimationFrame(suz);
  }
  if (KL.animasyonVar()) cerceve = requestAnimationFrame(suz);
  else gUcak.setAttribute('transform', `translate(${hedef[0]} ${hedef[1]})`);
  gUcak.addEventListener('click', () => yakala());
  gUcak.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); yakala(); } });

  async function yakala() {
    if (yakalandi) return;
    yakalandi = true;
    cancelAnimationFrame(cerceve);
    nav.hidden = true;
    KL.harfle(ipucu, 'Yakaladın! Kağıt açılıyor…', { anlik: true });
    window.Kit.ses.cal('hisirti');
    gUcak.remove();
    svg.setAttribute('viewBox', `${-0.08 * S} ${-0.08 * S} ${(katlama.kagit.en + 0.16) * S} ${(katlama.kagit.boy + 0.16) * S}`);   // yaprağa yaklaş
    svg.classList.add('okuma');
    durumCiz(gKagit, katlama.son, { olcek: S });
    await hepsiniAc(gKagit, katlama, { olcek: S, sure: 230, gecerli: ctx.gecerli });
    if (!ctx.gecerli()) return;
    const boya = boyaDeseni(katlama.son, model, cizgiler);
    for (const cz of boya.on) {
      KL.svgEl('path', { d: 'M' + cz.noktalar.map(([x, y]) => `${(x * S).toFixed(1)},${(y * S).toFixed(1)}`).join('L'), fill: 'none', stroke: RENKLER[cz.renk], 'stroke-width': 3.3, 'stroke-linecap': 'round', opacity: .88 }, gKagit);
    }
    notuYaz(gNot, gelen.not, S, { imza: gelen.gonderen, kagit: katlama.kagit });
    KL.harfle(ipucu, gelen.gonderen ? `${gelen.gonderen} yazmış:` : 'Notta şöyle yazıyor:', { anlik: true });
    sonButonlar();
  }

  function sonButonlar() {
    const s = el('nav', { sinif: 'dugmeler' }, kap);
    const varMi = D.ucaklar().some(u => u.kaynak === kaynak);
    const durum = el('p', { sinif: 'not' }, kap);
    if (varMi) KL.harfle(durum, 'Bu uçak zaten hangarında.', { anlik: true });
    else dugme(s, { id: 'not-as', yazi: SZ.ileri.hangaraAs, onem: 'birincil', tik: () => {
      const u = yeniUcak({ tasarim: gelen.tasarim, kalite: gelen.kalite, mod: 'gelen' });
      u.ad = gelen.ad; u.ayar = { ...u.ayar, ...gelen.ayar }; u.boya = { cizgiler }; u.isimStili = gelen.isimStili;
      u.not = { metin: gelen.not, gonderen: gelen.gonderen, tarih: gelen.tarih };
      u.kaynak = kaynak;
      D.ucakEkle(u);
      ctx.git('#/hangar');
    } });
    dugme(s, { id: 'not-katla', yazi: SZ.ileri.katla, href: '#/katalog' });
    requestAnimationFrame(() => cerceveleriCiz(s));
  }

  requestAnimationFrame(() => cerceveleriCiz(kap));
  void yakalaD;
  return { sok() { cancelAnimationFrame(cerceve); }, boyut() { cerceveleriCiz(kap, true); } };
}
