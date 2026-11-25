// Ortak sayfa parçaları: başlık, düğme, kurşun kalem notu, svg katmanı. Hepsi "defter" malzemesi.
const KL = () => window.Kit.kalem;

export function el(ad, oz = {}, ebeveyn = null) {
  const e = document.createElement(ad);
  for (const [k, v] of Object.entries(oz)) {
    if (v == null || v === false) continue;
    if (k === 'sinif') e.className = v;
    else if (k === 'metin') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  if (ebeveyn) ebeveyn.appendChild(e);
  return e;
}

// Sayfanın üst satırı: el yazısı başlık + sağda geri bağlantısı.
export function ust(kap, baslikYazi, o = {}) {
  const satir = el('header', { sinif: 'ust' }, kap);
  const h = el('h1', { sinif: 'baslik' }, satir);
  KL().harfle(h, baslikYazi, { tohum: ['baslik', baslikYazi] });
  if (o.geri) {
    const a = el('a', { sinif: 'dugme ikincil kucuk', href: o.geri.hash, id: 'geri-' + o.geri.hash.replace(/\W/g, '') }, satir);
    a.style.setProperty('--egim', '.9deg');                 // geri bağlantısı her sayfada aynı yatar
    const s = el('span', { sinif: 'yazi' }, a);
    KL().harfle(s, '← ' + o.geri.yazi);
  }
  return satir;
}

// Kurşun kalem notu (dünyaya ait açıklama). El yazısı politikası: sayfanın ilk açılışında başlık, giriş notu
// (sayfadaki ilk not) ve birincil düğme kalemle yazılır; geri kalanı (ve her yeniden çizim) anında görünür.
export function not(kap, yazi, o = {}) {
  const giris = kap.id === 'sayfa' && !kap.querySelector('.not');
  const p = el('p', { sinif: 'not' + (o.sinif ? ' ' + o.sinif : '') }, kap);
  KL().harfle(p, yazi, { tohum: ['not', yazi], anlik: o.anlik ?? !giris });
  return p;
}

// Düğme ya da bağlantı. Çerçeve, sayfa yerleştikten sonra cerceveleriCiz ile çizilir.
// onem: 'birincil' (iki kez çerçeveli, sayfanın tek ana işi) · 'ikincil' (varsayılan, tek çerçeve) ·
// 'ucuncul' (çerçevesiz, kurşun kalem alt çizgi). tehlikeli: kırmızı mürekkep (silme, sıfırlama).
// Eğim düğmenin kimliğinden gelir: aynı düğme her sayfada aynı yatar (sıradaki yerinden bağımsız).
export function dugme(kap, o) {
  const etiket = o.href ? 'a' : 'button';
  const onem = o.onem || 'ikincil';
  const b = el(etiket, {
    sinif: `dugme ${onem}` + (o.tehlikeli ? ' kirmizi' : '') + (o.sinif ? ' ' + o.sinif : ''),
    id: o.id,
    href: o.href,
    type: o.href ? null : 'button',
    disabled: !o.href && o.sonuk,
    'aria-disabled': o.href && o.sonuk ? 'true' : null,
  }, kap);
  const r = KL().rastgele('egim', o.id || o.yazi);
  b.style.setProperty('--egim', (-1.3 + r() * 2.4).toFixed(2) + 'deg');
  const s = el('span', { sinif: 'yazi' }, b);
  // ok son kelimeden ayrılmasın (dar sütunda "→" tek başına alt satıra düşmesin): araya bölünmez boşluk
  const yazi = String(o.yazi).replace(/ ([→←])/g, '\u00a0$1').replace(/([→←]) /g, '$1\u00a0');
  KL().harfle(s, yazi, { tohum: ['dugme', o.id], anlik: o.anlik ?? onem !== 'birincil' });
  if (yazi !== o.yazi) b.setAttribute('aria-label', o.yazi);
  if (o.tik) b.addEventListener('click', o.tik);
  if (o.sonuk && o.href) b.addEventListener('click', (e) => e.preventDefault());
  return b;
}

// Üçüncül düğmenin kurşun kalem alt çizgisi (çerçeve yerine).
function altCizgi(b, gecikme, anlik) {
  const w = b.offsetWidth, h = b.offsetHeight;
  if (!w || !h) return;
  let svg = b.querySelector(':scope > svg.cerceve');
  if (!svg) { svg = KL().svgEl('svg', { class: 'cerceve', 'aria-hidden': 'true' }); b.insertBefore(svg, b.firstChild); }
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.textContent = '';
  const yazi = b.querySelector('.yazi');
  const y = yazi ? Math.min(h - 2, yazi.offsetTop + yazi.offsetHeight + 4) : h - 4;   // dokunma alanı uzun olsa da yazının hemen altı
  KL().kalemYap(svg).cizgi(svg, [5, y, w - 4, y + 0.5], { stroke: KL().renkDeger('kursun'), strokeWidth: 1.2 },
    ['alt', b.id, b.dataset.vurgu || 0], { gecikme, anlik });
}

// Birincil düğmenin ikinci kalem geçişi: "iki kez çerçevelenmiş" vurgu.
function ikinciGecis(b, gecikme, anlik) {
  const svg = b.querySelector(':scope > svg.cerceve');
  if (!svg) return;
  const w = b.offsetWidth, h = b.offsetHeight;
  const g = KL().svgEl('g', { class: 'ikinci' }, svg);
  KL().kutu(KL().kalemYap(svg), g, 2.5, 3, w - 6, h - 5.5, { tohum: ['dugme2', b.id], gecikme: gecikme + 120, anlik, tasma: 3, cizgi: { strokeWidth: 1.1 } });
}

// Kap içindeki bütün .dugme'lerin elle çizilmiş çerçevesi; üzerine gelince kalem bir kez daha geçer.
export function cerceveleriCiz(kap, anlik = false) {
  const liste = Array.from(kap.querySelectorAll('.dugme'));
  liste.forEach((b, i) => {
    const sonuk = b.disabled || b.getAttribute('aria-disabled') === 'true';
    if (b.classList.contains('ucuncul')) altCizgi(b, i * 60, anlik);
    else {
      KL().dugmeCerceve(b, i * 60, anlik);
      if (b.classList.contains('birincil')) ikinciGecis(b, i * 60, anlik);
    }
    if (sonuk) b.querySelectorAll('svg.cerceve path').forEach(p => p.setAttribute('stroke', KL().renkDeger('kursun')));
    if (!b.dataset.vurguBagli) {
      b.dataset.vurguBagli = '1';
      const vurgu = () => {
        if (b.disabled || b.getAttribute('aria-disabled') === 'true') return;
        if (b.classList.contains('ucuncul')) { b.dataset.vurgu = (parseInt(b.dataset.vurgu || '0', 10) + 1); altCizgi(b, 0, true); }
        else KL().dugmeVurgu(b);
      };
      b.addEventListener('pointerenter', vurgu);
      b.addEventListener('focus', vurgu);
    }
  });
}

// viewBox'lı boş svg. Genişlik CSS'te, yükseklik orana göre. İçinde bağlantı ya da düğme olacaksa rol: 'group'
// (role="img" çocuklarını ekran okuyucudan gizler).
export function svgKatman(kap, w, h, sinif = '', rol = 'img') {
  const svg = KL().svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: sinif, role: rol });
  kap.appendChild(svg);
  return svg;
}

// Faz 1 iskeleti: içi henüz boş sayfa.
export function bosSayfa(kap, o) {
  ust(kap, o.baslik, { geri: o.geri });
  const govde = el('div', { sinif: 'govde' }, kap);
  for (const n of o.notlar || []) not(govde, n);
  const satir = el('nav', { sinif: 'dugmeler' }, govde);
  for (const d of o.baglantilar || []) dugme(satir, d);
  requestAnimationFrame(() => cerceveleriCiz(kap));
  return govde;
}

// Düğmeyi aç/kapat; çerçevenin mürekkebi de değişir (kapalı = kurşun kalem).
export function dugmeDurum(b, acik) {
  if (b.tagName === 'BUTTON') b.disabled = !acik;
  else b.setAttribute('aria-disabled', acik ? 'false' : 'true');
  if (b.classList.contains('ucuncul')) return;              // alt çizgi zaten kurşun kalem
  const renk = KL().renkDeger(acik ? (b.classList.contains('kirmizi') ? 'kirmizi' : 'mavi') : 'kursun');
  b.querySelectorAll('svg.cerceve path').forEach(p => p.setAttribute('stroke', renk));
}

// Seçmeli düğme grubu (filtreler, mod anahtarı): seçili olan mavi mürekkep, öbürleri kurşun.
export function secimGrubu(kap, secenekler, secili, degisince, o = {}) {
  const nav = el('div', { sinif: 'secim' + (o.sinif ? ' ' + o.sinif : ''), role: 'group', 'aria-label': o.etiket || null }, kap);
  const dugmeler = secenekler.map(s => {
    const b = dugme(nav, { id: s.id, yazi: s.yazi, sinif: 'kucuk', sonuk: s.sonuk });
    if (s.renk) b.style.color = s.renk;
    b.setAttribute('aria-pressed', String(s.deger === secili));
    if (!s.sonuk) b.addEventListener('click', () => {
      dugmeler.forEach((d, i) => d.setAttribute('aria-pressed', String(secenekler[i].deger === s.deger)));
      degisince(s.deger);
    });
    return b;
  });
  return nav;
}
