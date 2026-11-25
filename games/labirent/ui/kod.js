// ui/kod.js — labirent kodu ve linki, günün tarihi, paylaşım metni, panoya kopyalama.
//   LB.kod.link('D-O-W-7KQ9') → 'https://…/labirent/?kod=D-O-W-7KQ9' (göreli yol: sayfanın kendi adresi)
//   LB.kod.paylasim({ tarih, sure, par, ipuclu }) → 'Labirent · 21 Ekim · 0:52 · par 1:05 · ipuçsuz'
//   LB.kod.kopyala(metin) → Promise<boolean>   (pano yoksa gizli metin alanıyla dener)
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  // Yerel tarih: 'YYYY-MM-DD' (günün labirenti ve kayıt anahtarı)
  const bugun = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tarihYaz = (t) => { const [y, a, g] = t.split('-').map(Number); return `${g} ${AYLAR[a - 1]}`; };

  // Günün labirenti: tarihle tohumlanan Orta dikdörtgen; algoritma da tarihten (geri izleme, Prim, karışım)
  function gunun(t = bugun()) {
    const R = LB.rng;
    return { tur: 'D', boy: 'O', alg: ['G', 'P', 'K'][R.karma('gunun-alg', t) % 3], tohum: R.karma('gunun', t) % R.TOHUM_EN };
  }

  function link(kod) {
    const u = new URL(location.href);
    u.search = '?kod=' + kod;
    u.hash = '';
    return u.toString();
  }

  const paylasim = ({ tarih, sure, par, ipuclu }) =>
    ['Labirent', tarihYaz(tarih), LB.marj.sureYaz(sure), 'par ' + LB.marj.sureYaz(par), ipuclu ? 'ipuçlu' : 'ipuçsuz'].join(' · ');

  async function kopyala(metin) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(metin); return true; } } catch (e) { /* aşağıda dene */ }
    const t = document.createElement('textarea');
    t.value = metin; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }

  LB.kod = { AYLAR, bugun, tarihYaz, gunun, link, paylasim, kopyala };
})();
