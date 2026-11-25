// ui/sahne.js — ölçü (sayfa, marj, alıştırma kutusu genişliği, çöp boyu), yerleşim düzeni, font bekleme, ekran okuyucu duyurusu.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const C = KB.config, Mo = KB.model;
  const kok = document.documentElement;
  const O = { duzen: 'defter', sq: 19, kupurW: 600, tekKisi: false };

  // Alıştırma kutusunun iç boşluğu (px, iki yan toplam; kalem çerçevesi payıyla) ve sahnenin kenar payı (L cinsinden)
  const icBosluk = () => (O.duzen === 'dar' ? 28 : Math.round(2.2 * O.sq) + 4);
  const SAHNE_PAY = .8;

  // Açık defterde sağ sayfanın parçaları; tek sayfa düzeninde sol sayfaya taşınır (sırası ekran okuyucu için anlamlı)
  const $ = (id) => document.getElementById(id);
  function parcalariYerlestir(duzen) {
    const sol = $('sayfa'), sag = $('sayfa-sag');
    if (!sol || !sag) return;
    const parca = ['skor-bas', 'rakip', 'gecmis', 'yan', 'komutlar-genel'].map($);
    if (duzen === 'dar') {
      if (parca[0].parentNode === sol) return;
      sol.insertBefore(parca[0], $('marj'));
      sol.insertBefore(parca[1], $('oyun-alani'));
      sol.insertBefore(parca[2], $('komutlar'));
      sol.insertBefore(parca[3], $('komutlar'));
      sol.appendChild(parca[4]);
    } else {
      if (parca[0].parentNode === sag) return;
      parca.forEach(p => sag.appendChild(p));
    }
  }

  function olc(o = {}) {
    if (o.tekKisi !== undefined) O.tekKisi = o.tekKisi;
    const { vw, vh } = Kit.kalem.alan();
    O.vw = vw; O.vh = vh;
    O.duzen = vw < C.olcu.acikPx ? 'dar' : 'defter';
    document.body.dataset.duzen = O.duzen;
    parcalariYerlestir(O.duzen);
    if (O.duzen === 'defter') {
      // açık defter: iki sayfa ekranı doldurur
      const W = Math.min(vw - 36, 1760);
      const H = Math.round(Math.max(560, Math.min(vh - 30, W / 1.25)));
      const sayfaW = Math.floor(W / 2);
      const sq = Math.max(16, Math.min(23, Math.round(Math.min(H / 40, sayfaW / 32))));
      const marjX = Math.round(3.4 * sq);
      const kupurW = sayfaW - marjX - Math.round(1.1 * sq) - Math.round(1.7 * sq);
      // kısa ekran (sayfa < 780 px): sıkı düzen — efsane açıklaması gizli, aralıklar küçük
      const basik = H < 780;
      // yükseklik payı (sol sayfa daha uzun): başlık + kutu (başlık, iki satır talimat; sahne 2.56 L) + notlar/kibrit kutusu +
      // efsane + komutlar
      const Lh = (H - (basik ? 23 : 28) * sq - 8) / 2.56;
      Object.assign(O, { sq, sayfaW, sayfaH: H, marjX, kupurW, Lh, basik });
    } else {
      // tek sayfa (telefon, tablet, dar pencere): ortalanmış, en çok 780 px
      const sayfaW = Math.min(vw - 6, 780);
      const sq = vw < 600 ? 18 : 20;
      const marjX = vw < 600 ? 14 : 22;
      const kupurW = sayfaW - marjX - 22;
      Object.assign(O, { sq, sayfaW, marjX, kupurW, sayfaH: vh - 14, Lh: Infinity, basik: false });
    }
    const d = $('defter');
    if (d) d.classList.toggle('basik', !!O.basik);
    kok.style.setProperty('--sq', O.sq + 'px');
    kok.style.setProperty('--sayfa-w', Math.round(O.sayfaW) + 'px');
    kok.style.setProperty('--sayfa-h', Math.round(O.sayfaH) + 'px');
    kok.style.setProperty('--marj-gen', O.marjX + 'px');
    kok.style.setProperty('--kupur-w', Math.round(O.kupurW) + 'px');
    return O;
  }

  // Bu şablon için çöp boyu (px). Sığmıyorsa en az değeri döner (seçim bunu önler).
  function L(sablonId, kupurW = O.kupurW) {
    const ic = kupurW - icBosluk();
    const v = ic / (Mo.genislikL(sablonId) + SAHNE_PAY);
    // açık defterde sayfa yüksekliğine sığsın (çok kısa ekranda en az değerin altına inmez; sayfa uzar)
    const h = Math.max(O.Lh ?? Infinity, enAzL());
    return Math.min(C.olcu.enCokL, v, h);
  }
  // En küçük çöp boyu: masaüstünde 54 px (okunurluk), telefonda 44 px, çok dar ekranda 38 px
  const enAzL = () => (O.duzen === 'defter' ? C.olcu.enAzLMasa : Kit.kalem.alan().vw < 360 ? C.olcu.enAzLDar : C.olcu.enAzL);
  // Bu ekranda çöp ≥ en az L ile sığan şablonların en büyük genişliği (L birimi)
  const enCokGenislik = () => (O.kupurW - icBosluk()) / enAzL() - SAHNE_PAY;
  const sigar = (sablonId) => Mo.genislikL(sablonId) <= enCokGenislik() + 1e-9;

  // Sayfada boş kalan dikey yerin bir kısmı alıştırma kutularına verilir: sahnenin üstü ve altı açılır (iki kutu aynı boyda
  // kalır; yarış ekranı defterin dışında olduğundan etkilenmez). Tur kurulunca ve pencere değişince ölçülür.
  function ekAyarla() {
    const defter = $('defter'), kart = $('kupur'), sayfa = $('sayfa');
    if (!defter || !kart || !sayfa) return 0;
    defter.style.setProperty('--sahne-ek', '0px');
    if (!kart.firstChild) return 0;
    let bos;
    if (O.duzen === 'defter') {
      const ef = $('rakamlar'), alt = kart.nextElementSibling;
      if (!ef || !ef.firstChild || !alt) return 0;
      bos = ef.offsetTop - (alt.offsetTop + alt.offsetHeight) - O.sq * .9;
    } else {
      const son = $('komutlar-genel');
      bos = sayfa.clientHeight - (son.offsetTop + son.offsetHeight) - O.sq;
    }
    // en az yarısı (açık defterde en az beş kare) boş kalır: notlar uzayabilir, maç sonu yazısı oraya yazılır
    let ek = Math.max(0, Math.min(bos * .5, O.duzen === 'defter' ? bos - 5 * O.sq : bos, (O.duzen === 'defter' ? 4 : 5) * O.sq));
    // sağ sayfada bilgisayarın kutusu da aynı boyda büyür: maç defterine en az başlık + beş satır kalsın
    const rakip = $('rakip');
    if (O.duzen === 'defter' && rakip && !rakip.hidden) ek = Math.min(ek, Math.max(0, $('gecmis').clientHeight - 7.2 * O.sq));
    ek = Math.round(ek);
    defter.style.setProperty('--sahne-ek', ek + 'px');
    return ek;
  }

  let duyuruZ = 0;
  function duyur(metin) {
    const el = document.getElementById('duyuru');
    clearTimeout(duyuruZ);
    el.textContent = '';
    duyuruZ = setTimeout(() => { el.textContent = metin; }, 60);
  }

  async function fontlar() {
    const KL = Kit.kalem;
    const s = await Promise.all([
      KL.fontBekle('Kalam', 'AİŞĞÇÖÜıüöç0123', 2500),
      KL.fontBekle('PT Serif', 'AİŞĞÇÖÜıüöç', 2500),
      KL.fontBekle('Archivo Narrow', 'ÇÖZÜLDÜ İğ', 2500),
    ]);
    return s.every(Boolean);
  }

  KB.sahne = { O, olc, L, enAzL, enCokGenislik, sigar, duyur, fontlar, ekAyarla, SAHNE_PAY, icBosluk };
})();
