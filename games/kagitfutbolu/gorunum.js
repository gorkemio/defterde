// Ekran yerleşimi ve erişilebilir yön kontrolleri; oyun kurallarına müdahale etmez.
(function () {
  'use strict';
  const KF = window.KF, L = KF.layout;
  const $ = s => document.querySelector(s);
  function kur({ O, oyna, girisAcik, yenidenBoyutla }) {
    let oneriKapali = false, yatay = false;
    const yonler = [...document.querySelectorAll('#yonler .yon')];
    const isim = (x, y) => (y < 0 ? ['Sol üst', 'Yukarı', 'Sağ üst'] : y > 0 ? ['Sol alt', 'Aşağı', 'Sağ alt'] : ['Sol', '', 'Sağ'])[x + 1];

    function araclariHizala() {
      const grup = $('.sayfa-araclari'), yazi = $('#sayfa-no text'), ikon = $('#ses-dugme .ikon > g');
      if (!yazi || !ikon) return;
      const kutu = grup.getBoundingClientRect(), a = yazi.getBoundingClientRect(), b = ikon.getBoundingClientRect();
      if (!a.width || !b.width) return;
      // SVG iç boşlukları asimetriktir. Görünen yazı ve çizimin ortak merkezini kullan.
      const merkez = (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2;
      grup.style.setProperty('--arac-kaymasi', (kutu.left + kutu.width / 2 - merkez) + 'px');
    }
    function yonHedef(dx, dy) {
      if (!O.d || !girisAcik()) return null;
      const [x, y] = L.sahaYon(dx, dy, yatay);
      return O.hedefler.find(h => h.x === O.G.nx[O.d.top] + x && h.y === O.G.ny[O.d.top] + y);
    }
    function yonleriGuncelle() {
      const aktif = O.d && !O.d.bitti && !O.izliyor ? O.d.sira : -1;
      $('#skor').querySelectorAll('.mavi, .kirmizi').forEach((el, i) => {
        if (i === aktif) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
      for (const b of yonler) {
        const dx = +b.dataset.dx, dy = +b.dataset.dy, h = yonHedef(dx, dy);
        b.disabled = !h;
        b.setAttribute('aria-label', isim(dx, dy) + (h ? `: ${h.x}, ${h.y}${h.sekme ? ', sekme' : ''}` : ', kapalı'));
      }
      if (O.d) {
        const hedef = yatay ? (O.d.sira === 0 ? 'sağ' : 'sol') : (O.d.sira === 0 ? 'üst' : 'alt');
        $('#saha').setAttribute('aria-label', `Kağıt futbolu sahası. Top ${O.G.nx[O.d.top]}, ${O.G.ny[O.d.top]}. ${O.d.sira === 0 ? 'Mavi' : 'Kırmızı'} ${hedef} kaleye oynuyor.`);
      }
    }
    function kagidiHizala(kare) {
      if (!O.T || kare <= 0) return;
      const sayfa = $('#sayfa'), r = sayfa.getBoundingClientRect(), css = getComputedStyle(sayfa);
      if (!r.width || !r.height) return;
      const ekran = O.T.dunya.getScreenCTM();
      const p = new DOMPoint(...O.T.nok(0, 0)).matrixTransform(ekran);
      const alt = new DOMPoint(...O.T.nok(O.W, O.H)).matrixTransform(ekran);
      sayfa.style.setProperty('--saha-alt', (alt.y - r.top) + 'px');
      const hiz = L.izgaraHizasi(r.width, r.height, parseFloat(css.getPropertyValue('--defter-egimi')) || 0,
        kare, p.x - r.left, p.y - r.top);
      const matris = `matrix(${hiz.matris.join(' ')})`, marj = parseFloat(css.getPropertyValue('--marj-x'));
      // Yalnız basılı çizgiler ters döner. Doku, tek kâğıt kenarı ve gölge aynı kalır.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}">
        <defs><pattern id="kare" patternUnits="userSpaceOnUse" width="${kare}" height="${kare}" patternTransform="${matris} translate(${hiz.x} ${hiz.y})">
          <path d="M ${kare} 0 H 0 V ${kare}" fill="none" stroke="${css.getPropertyValue('--izgara').trim()}" stroke-width="1"/>
        </pattern></defs><rect width="100%" height="100%" fill="url(#kare)"/>
        <path d="M ${marj} ${-r.height} V ${r.height * 2}" transform="${matris}" stroke="${css.getPropertyValue('--marj').trim()}" stroke-width="2"/>
      </svg>`;
      sayfa.style.setProperty('--kagit-cizgileri', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      sayfa.style.setProperty('--kagit-cizgi-boyutlari', '100% 100%');
    }
    function olcu() {
      // Pinch zoom stays under the browser's control; do not resize the world around the user's finger.
      const vv = window.visualViewport;
      if (vv && vv.scale !== 1) return;
      const height = vv ? vv.height : innerHeight;
      document.documentElement.style.setProperty('--gorunum-yuk', height + 'px');
      yatay = document.documentElement.clientWidth > height;
      const sayfa = $('#sayfa'), slot = $('.saha-alani');
      sayfa.dataset.yatay = String(yatay);
      $('#cevir-oneri').hidden = true;
      $('#yonler').hidden = true;
      sayfa.dataset.pad = 'false';
      const sigdir = () => L.sigdir(O.W, O.H, slot.clientWidth, slot.clientHeight, yatay);
      const ilk = sigdir();
      const pad = ilk.adim < 44 || $('#yonleri-goster').checked;
      $('#yonler').hidden = !pad;
      sayfa.dataset.pad = String(pad);
      let boy = sigdir();
      const yan = L.sigdir(O.W, O.H, height - 264, document.documentElement.clientWidth - 110, true);
      $('#cevir-oneri').hidden = oneriKapali || yatay || boy.adim >= 44 || yan.adim <= boy.adim * 1.1;
      boy = sigdir();
      const saha = $('#saha');
      saha.style.width = boy.width + 'px'; saha.style.height = boy.height + 'px';
      document.documentElement.style.setProperty('--sq', boy.adim / 2 + 'px');
      if (O.T) KF.draw.yonAyarla(O.T, yatay);
      kagidiHizala(boy.adim / 2);
      // A resize/cancel cannot leave a drag preview or captured pointer behind.
      if (O.surukle) {
        if (saha.hasPointerCapture(O.surukle.id)) saha.releasePointerCapture(O.surukle.id);
        O.surukle = null;
        if (O.T) KF.draw.surukleSil(O.T);
      }
      yonleriGuncelle();
      araclariHizala();
    }
    function skor() {
      const b = $('#skor').querySelectorAll('b');
      b[0].textContent = O.puan[0]; b[1].textContent = O.puan[1];
      $('#skor').setAttribute('aria-label', `Skor: Mavi ${O.puan[0]}, Kırmızı ${O.puan[1]}`);
    }
    function baslat() {
      yonler.forEach(b => b.addEventListener('click', () => {
        const h = yonHedef(+b.dataset.dx, +b.dataset.dy);
        if (h) oyna(h);
      }));
      const tuslar = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        q: [-1, -1], w: [0, -1], e: [1, -1], a: [-1, 0], d: [1, 0], z: [-1, 1], x: [0, 1], c: [1, 1] };
      $('#saha').addEventListener('keydown', ev => {
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
        const yon = tuslar[ev.key] || tuslar[ev.key.toLowerCase()];
        if (!yon) return;
        ev.preventDefault();
        const h = yonHedef(...yon);
        if (h) oyna(h);
      });
      $('#yonleri-goster').addEventListener('change', yenidenBoyutla);
      $('#cevir-kapat').addEventListener('click', () => { oneriKapali = true; yenidenBoyutla(); $('#saha').focus({ preventScroll: true }); });
      $('#tam-ekran').addEventListener('click', async () => {
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
          if (screen.orientation && typeof screen.orientation.lock === 'function') await screen.orientation.lock('landscape');
          else $('#duyuru').textContent = 'Tam ekran açıldı. Yatay oynamak için cihazını yan çevirebilirsin.';
        } catch (e) { $('#duyuru').textContent = 'Bu tarayıcı ekran yönünü değiştiremiyor. Cihazını elle yan çevirebilirsin.'; }
        yenidenBoyutla();
      });
      window.addEventListener('resize', yenidenBoyutla);
      window.addEventListener('orientationchange', yenidenBoyutla);
      window.visualViewport?.addEventListener('resize', yenidenBoyutla);
      // Status text can wrap after a goal or text zoom without a window resize.
      const observer = new ResizeObserver(yenidenBoyutla);
      observer.observe($('.oyun-alani'));
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && screen.orientation?.unlock) screen.orientation.unlock();
        yenidenBoyutla();
      });
    }
    return { olcu, skor, yonleriGuncelle, araclariHizala, baslat };
  }
  KF.gorunum = { kur };
})();
