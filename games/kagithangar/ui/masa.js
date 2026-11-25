// #/masa — defterin ilk sayfası: kalemle çizilmiş bir oda; duvarda hangar kapısı ve pencere, masada kağıt destesi,
// kalem, ataç kutusu ve son uçak.
// İki hâl: yeni (tek ana iş: ilk uçağını katla) ve dönen (son uçağınla hemen uç; günün uçuşu kartı).
import { ATAC_YOLU, ATAC_RENGI } from './atac.js';
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, dugme, el, cerceveleriCiz, svgKatman } from './sayfa.js';
import { kagitCiz } from './kagitCiz.js';
import { depo } from '../depo.js';
import { gununUcusu, SAHNELER } from '../engine/sahneler.js';
import { masaDurumu, ucusRotasi } from '../engine/akis.js';
import { pilotKarti } from '../engine/pilot.js';
import { tasarimYukle } from './tasarimYukle.js';
import { ucakCiz } from './ucakCiz.js';
import { KAMERALAR } from '../engine/poz.js';

let ilkCizim = true;                       // masa yalnız uygulama ilk açıldığında kalemle çizilerek gelir

export function kur(kap, params, ctx) {
  const D = depo();
  const durum = masaDurumu(D.ucaklar(), D.ayarlar());
  ust(kap, 'Kağıt Hangar');
  // dönen pilota rütbesi ve bir sonraki basamak (hangardaki uçak sayısı zaten kapıda yazıyor)
  const kart = durum.yeni ? null : pilotKarti(D.ucaklar(), D.ayarlar());
  not(kap, durum.yeni ? 'Bir kağıt al, katla, adını koy, fırlat. Uçağın hangarda seni bekler.'
    : `${D.ayarlar().pilotAdi ? `${D.ayarlar().pilotAdi}, rütben` : 'Rütben'}: ${kart.rutbe} · ${kart.puan} puan.${kart.sonraki ? ` ${kart.sonraki.ad} olmana ${kart.sonraki.kalan} puan kaldı.` : ''}`);
  const duzen = el('div', { sinif: 'masa-duzen' }, kap);
  const svg = svgKatman(duzen, 640, 430, 'masa-sahnesi', 'group');
  svg.setAttribute('aria-label', 'Oda: duvarda hangar kapısı ve pencere; masada kağıt destesi, kalem, ataç kutusu' + (durum.yeni ? '' : ' ve son uçağın'));
  const anlik = !ilkCizim;
  ilkCizim = false;
  const ucakYeri = sahne(svg, durum, anlik);

  // dönen kullanıcı: son uçağı masada duruyor; dokununca uçar
  if (!durum.yeni && ucakYeri) {
    tasarimYukle(durum.sonUcak.tasarim).then((v) => {
      if (ctx && !ctx.gecerli()) return;
      ucakCiz(ucakYeri, v.katlama, { ucak: durum.sonUcak, kamera: KAMERALAR.HANGAR, merkez: [474, 240], olcek: 100, zemin: -0.24, golge: { dx: 5, dy: 7, opaklik: .16 }, bulaniklik: 3 });
    }).catch(() => {});
  }

  const liste = el('nav', { sinif: 'masa-baglantilar' }, duzen);
  if (durum.yeni) {
    dugme(liste, { id: 'masa-ilk', yazi: SZ.ileri.ilkKatla, href: '#/atolye/ok', onem: 'birincil' });
    not(liste, 'Ok: herkesin ilk uçağı. Adım adım birlikte katlarız.');
    const alt = el('div', { sinif: 'dugmeler masa-ucuncul' }, liste);
    dugme(alt, { id: 'masa-katalog', yazi: 'Başka bir tasarım seç', href: '#/katalog', onem: 'ucuncul' });
    dugme(alt, { id: 'masa-nasil', yazi: 'Nasıl uçar?', href: '#/nasil', onem: 'ucuncul' });
  } else {
    const u = durum.sonUcak;
    dugme(liste, { id: 'masa-uc', yazi: `${u.ad || 'İsimsiz'} ile uç →`, href: ucusRotasi(u.id, D.ayarlar()), onem: 'birincil' });
    dugme(liste, { id: 'masa-katla', yazi: SZ.ileri.katla, href: '#/katalog' });
    gununBolumu(kap, u);
    const alt = el('nav', { sinif: 'dugmeler masa-ucuncul' }, kap);
    dugme(alt, { id: 'masa-duello', yazi: 'Düello', href: '#/duello', onem: 'ucuncul' });
    dugme(alt, { id: 'masa-nasil', yazi: 'Nasıl uçar?', href: '#/nasil', onem: 'ucuncul' });
    dugme(alt, { id: 'masa-pilot', yazi: 'Pilot kartı', href: '#/pilot', onem: 'ucuncul' });
    dugme(alt, { id: 'masa-stil', yazi: 'Stil rehberi', href: '#/stil', onem: 'ucuncul' });
  }
  requestAnimationFrame(() => cerceveleriCiz(kap));
  return { boyut() { cerceveleriCiz(kap, true); } };
}

// Oda: her şey aynı zemine basar. Duvarda (yere inen) hangar kapısı ve pencere, önde derinliği olan bir masa;
// masanın üstünde gerçek kağıttan deste, tükenmez kalem, ataç kutusu ve (varsa) son uçak. Kapı hangara, deste
// katlamaya, uçak uçuşa götürür. Dönüş: son uçağın çizileceği bağlantı grubu (yoksa null).
function sahne(svg, durum, anlik) {
  const KL = window.Kit.kalem;
  const K = KL.kalemYap(svg);
  const an = (...p) => ['oda', ...p];
  const o = { anlik };
  const kursun = KL.renkDeger('kursun');
  const link = (href, etiket) => KL.svgEl('a', { href, 'aria-label': etiket }, svg);
  const ZEMIN = 404;

  // zemin, süpürgelik ve döşeme tahtaları (perspektif)
  K.cizgi(svg, [0, ZEMIN, 640, ZEMIN - 1], { strokeWidth: 2 }, an('zemin'), o);
  K.cizgi(svg, [0, ZEMIN - 9, 640, ZEMIN - 10], { strokeWidth: .9, stroke: kursun }, an('supurgelik'), o);
  [[70, 40], [250, 226], [430, 452], [600, 636]].forEach(([ust_, alt], i) =>
    K.cizgi(svg, [ust_, ZEMIN + 2, alt, 430], { strokeWidth: .8, stroke: kursun }, an('tahta', i), o));

  // pencere: dışarıda bulutlar ve süzülen küçük bir uçak (oyunun vaadi)
  K.dikdortgen(svg, [298, 26, 176, 132], { strokeWidth: 2 }, an('pencere'), o);
  K.dikdortgen(svg, [306, 34, 160, 116], { strokeWidth: 1 }, an('pencere-ic'), o);
  K.cizgi(svg, [386, 34, 386, 150], { strokeWidth: 1.2 }, an('kayit-d'), o);
  K.cizgi(svg, [306, 92, 466, 92], { strokeWidth: 1.2 }, an('kayit-y'), o);
  K.cizgi(svg, [290, 162, 482, 161], { strokeWidth: 1.8 }, an('esik'), o);
  K.egri(svg, [[318, 62], [328, 54], [340, 60], [352, 52], [366, 60]], { strokeWidth: 1, stroke: kursun }, an('bulut1'), o);
  K.egri(svg, [[404, 118], [414, 111], [426, 117], [438, 110], [452, 117]], { strokeWidth: 1, stroke: kursun }, an('bulut2'), o);
  K.egri(svg, [[332, 132], [356, 116], [384, 112], [404, 98]], { strokeWidth: 1, stroke: kursun, strokeLineDash: [4, 6] }, an('iz'), o);
  kagitCiz(svg, [
    { noktalar: [[404, 98], [432, 84], [420, 100]], yuz: 'on', isik: 1 },
    { noktalar: [[404, 98], [432, 84], [417, 94]], yuz: 'arka', isik: .82 },
  ], { golge: false });

  // hangar kapısı: yere basar, üstünde tabela
  const kapi = link('#/hangar', 'Hangar kapısı: hangara git');
  K.dikdortgen(kapi, [14, 140, 138, ZEMIN - 140], { strokeWidth: 1.1, stroke: kursun }, an('kasa'), o);
  K.dikdortgen(kapi, [22, 148, 122, ZEMIN - 148], { strokeWidth: 2.1 }, an('kapi'), o);
  K.dikdortgen(kapi, [34, 164, 98, 96], { strokeWidth: 1 }, an('kapi-ust'), o);
  K.dikdortgen(kapi, [34, 280, 98, 108], { strokeWidth: 1 }, an('kapi-alt'), o);
  K.daire(kapi, [126, 278, 10], { strokeWidth: 1.4 }, an('tokmak'), o);
  K.dikdortgen(kapi, [26, 110, 114, 24], { strokeWidth: 1.3 }, an('tabela'), o);
  K.cizgi(kapi, [52, 110, 60, 96], { strokeWidth: .9, stroke: kursun }, an('tabela-ip1'), o);
  K.cizgi(kapi, [114, 110, 106, 96], { strokeWidth: .9, stroke: kursun }, an('tabela-ip2'), o);
  KL.metinSvg(kapi, 'HANGAR', { x: 83, y: 128, boyut: 17, renk: 'mavi', anlik });
  const sayi = durum.aktif.length;
  KL.metinSvg(kapi, sayi ? `${sayi} uçak içeride` : 'henüz boş', { x: 83, y: 218, boyut: 14, renk: 'kursun', aci: -3, anlik });
  KL.svgEl('rect', { x: 10, y: 92, width: 146, height: ZEMIN - 92, fill: 'none', 'pointer-events': 'all' }, kapi);

  // masa: üst tabla (arka ve ön kenar), kalınlık, çekmece, dört ayak, zeminde gölge
  const g = KL.svgEl('g', { opacity: .3 }, svg);
  K.cokgen(g, [[188, ZEMIN], [606, ZEMIN], [622, ZEMIN + 10], [176, ZEMIN + 10]], { stroke: 'none', fill: kursun, fillStyle: 'hachure', hachureGap: 5, fillWeight: .8 }, an('golge'), o);
  K.cizgi(svg, [214, 260, 214, ZEMIN - 10], { strokeWidth: 1, stroke: kursun }, an('ayak-a1'), o);
  K.cizgi(svg, [614, 256, 614, ZEMIN - 12], { strokeWidth: 1, stroke: kursun }, an('ayak-a2'), o);
  K.cizgi(svg, [204, 250, 630, 248], { strokeWidth: 1.4 }, an('tabla-arka'), o);
  K.cizgi(svg, [204, 250, 184, 272], { strokeWidth: 1.4 }, an('tabla-sol'), o);
  K.cizgi(svg, [630, 248, 614, 270], { strokeWidth: 1.4 }, an('tabla-sag'), o);
  K.cizgi(svg, [182, 272, 616, 270], { strokeWidth: 2.4 }, an('tabla-on'), o);
  K.cizgi(svg, [184, 282, 614, 280], { strokeWidth: 1.2 }, an('tabla-kalin'), o);
  K.cizgi(svg, [184, 272, 184, 282], { strokeWidth: 1.2 }, an('kalin-sol'), o);
  K.cizgi(svg, [614, 270, 614, 280], { strokeWidth: 1.2 }, an('kalin-sag'), o);
  K.dikdortgen(svg, [432, 284, 150, 30], { strokeWidth: 1.2 }, an('cekmece'), o);
  K.cizgi(svg, [494, 300, 520, 300], { strokeWidth: 2.2 }, an('kulp'), o);
  K.cizgi(svg, [196, 282, 198, ZEMIN], { strokeWidth: 2 }, an('ayak1'), o);
  K.cizgi(svg, [602, 280, 600, ZEMIN], { strokeWidth: 2 }, an('ayak2'), o);

  // kağıt destesi: masanın üstünde, perspektifte üst üste gerçek yapraklar
  const deste = link(durum.yeni ? '#/atolye/ok' : '#/katalog', 'Kağıt destesi: katlamaya başla');
  const yaprak = (dy, dx = 0) => [[236 + dx, 246 - dy], [348 + dx, 238 - dy], [382 + dx, 260 - dy], [256 + dx, 268 - dy]];
  const katlar = [0, 2, 4, 6, 8].map((dy, i) => ({ noktalar: yaprak(dy, (i % 2) * 2), yuz: 'on', isik: 0.88 + i * 0.03 }));
  kagitCiz(deste, katlar, { golge: { dx: 4, dy: 5, opaklik: .18 }, bulaniklik: 3 });
  KL.svgEl('rect', { x: 228, y: 222, width: 164, height: 50, fill: 'none', 'pointer-events': 'all' }, deste);
  K.egri(deste, [[262, 330], [272, 306], [292, 278]], { stroke: kursun, strokeWidth: 1.1 }, an('deste-ok'), o);
  K.cizgi(deste, [292, 278, 284, 282], { stroke: kursun, strokeWidth: 1.1 }, an('deste-ok-u1'), o);
  K.cizgi(deste, [292, 278, 291, 287], { stroke: kursun, strokeWidth: 1.1 }, an('deste-ok-u2'), o);
  KL.metinSvg(deste, durum.yeni ? 'buradan katla' : 'yeni kağıt', { x: 262, y: 348, boyut: 16, renk: 'kursun', aci: -3, anlik });

  // tükenmez kalem: destenin üstünde, çaprazına bırakılmış
  K.cokgen(svg, [[272, 242], [366, 231], [368, 237], [274, 248]], { strokeWidth: 1.5, fill: '#fbf9f2', fillStyle: 'solid' }, an('kalem'), o);
  K.cokgen(svg, [[272, 242], [274, 248], [258, 247]], { strokeWidth: 1.3, fill: KL.renkDeger('mavi'), fillStyle: 'solid' }, an('kalem-uc'), o);
  K.cizgi(svg, [336, 233, 360, 230], { strokeWidth: 2.4 }, an('kalem-klips'), o);

  // ataç kutusu: masanın arka köşesinde, tabana oturur
  K.dikdortgen(svg, [548, 214, 60, 40], { strokeWidth: 1.5 }, an('kutu'), o);
  K.cizgi(svg, [548, 224, 608, 224], { strokeWidth: 1 }, an('kutu-agiz'), o);
  KL.metinSvg(svg, 'ataç', { x: 578, y: 246, boyut: 14, renk: 'mavi', aci: -2, anlik });
  [[556, 206, -12], [576, 208, 8], [592, 204, -4]].forEach(([x, y, a]) => {
    const t = KL.svgEl('g', { transform: `translate(${x} ${y}) rotate(${a}) scale(.9)` }, svg);
    KL.svgEl('path', { d: ATAC_YOLU, fill: 'none', stroke: ATAC_RENGI, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, t);
  });

  if (durum.yeni) return null;
  // son uçak masada: gerçek kağıt, dokununca uçar
  const u = durum.sonUcak;
  const ucak = link(ucusRotasi(u.id, depo().ayarlar()), `${u.ad || 'İsimsiz'}: masada duruyor, dokun ve uç`);
  KL.svgEl('rect', { x: 410, y: 196, width: 136, height: 64, fill: 'none', 'pointer-events': 'all' }, ucak);
  K.egri(svg, [[516, 178], [528, 192], [518, 208]], { stroke: kursun, strokeWidth: 1.1 }, an('ucak-ok'), o);
  KL.metinSvg(svg, (u.ad || 'İsimsiz').slice(0, 18), { x: 520, y: 172, boyut: 15, renk: 'mavi', aci: -4, anlik });
  return ucak;
}

// Günün uçuşu: tarih tohumlu görev; son uçakla tek dokunuşta denenir.
function gununBolumu(kap, ucak) {
  const KL = window.Kit.kalem;
  const D = depo();
  const g = gununUcusu();
  const b = el('section', { sinif: 'gunun', 'aria-label': 'Günün uçuşu' }, kap);
  el('span', { sinif: 'bant', 'aria-hidden': 'true' }, b);
  const h = el('h2', { sinif: 'bolum' }, b);
  KL.harfle(h, 'Günün uçuşu');
  const ruzgar = g.ruzgar ? `, rüzgâr ${g.ruzgar.ort >= 0 ? 'arkadan' : 'karşıdan'} ${Math.abs(g.ruzgar.ort).toFixed(1).replace('.', ',')} m/s` : '';
  KL.harfle(el('p', { sinif: 'not mavi' }, b), `${SAHNELER[g.sahne].ad}${ruzgar}. Hedef: ${g.hedef} metre.`, { anlik: true });
  const kayit = D.ayarlar().gunun;
  if (kayit && kayit.gun === g.gun) KL.harfle(el('p', { sinif: 'not' }, b), `Bugünkü en iyin: ${String(kayit.enIyi).replace('.', ',')} m${kayit.basarili ? ' · başardın!' : ''}`, { anlik: true });
  const nav = el('nav', { sinif: 'dugmeler' }, b);
  dugme(nav, { id: 'gunun-dene', yazi: `${ucak.ad || 'İsimsiz'} ile dene →`, href: `#/uc/${ucak.id}/gunun` });
  dugme(nav, { id: 'gunun-baska', yazi: 'Başka uçak seç', href: '#/hangar', onem: 'ucuncul' });
}
