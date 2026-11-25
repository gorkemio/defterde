// Görünür tarayıcı alanını ölçer; yön değişimi hiçbir oyun verisine dokunmaz.
(function () {
  'use strict';
  const AB = window.AB;
  AB.viewport = {
    kur(degisti) {
      const oyun = document.querySelector('#oyun');
      const uyari = document.querySelector('#yon-uyari');
      const tam = document.querySelector('#tam-ekran');
      let bekleyen = 0, son = '', oncekiOdak = null;
      function olc() {
        const v = window.visualViewport;
        // Yakınlaştırma erişilebilirliği: pinch zoom yerleşimi küçültüp geri almamalı.
        const normal = !v || Math.abs(v.scale - 1) < .01;
        const css = getComputedStyle(document.body);
        const insets = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(k => [k, parseFloat(css.getPropertyValue('padding-' + k)) || 0]));
        const alan = {
          width: normal && v ? v.width : document.documentElement.clientWidth,
          height: normal && v ? v.height : window.innerHeight, insets,
        };
        const key = JSON.stringify(alan);
        if (key === son) return;
        son = key;
        const l = AB.layout.hesapla(alan);
        oyun.dataset.layout = l.mod;
        oyun.dataset.paused = String(l.duraklat);
        oyun.style.setProperty('--layout-w', l.width + 'px');
        oyun.style.setProperty('--layout-h', l.height + 'px');
        oyun.style.setProperty('--primary-size', l.ana + 'px');
        oyun.style.setProperty('--secondary-size', l.diger + 'px');
        document.documentElement.style.setProperty('--sq', (l.sq || l.ana / 22) + 'px');
        degisti(l);
        if (l.duraklat && !uyari.open) {
          oncekiOdak = document.activeElement;
          uyari.showModal();
        } else if (!l.duraklat && uyari.open) {
          uyari.close();
          if (oncekiOdak?.isConnected) oncekiOdak.focus({ preventScroll: true });
        }
      }
      function planla() {
        cancelAnimationFrame(bekleyen);
        bekleyen = requestAnimationFrame(olc);
      }
      uyari.addEventListener('cancel', e => e.preventDefault());
      tam.hidden = !document.documentElement.requestFullscreen;
      tam.addEventListener('click', async () => {
        const sonuc = document.querySelector('#yon-sonuc');
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
          if (screen.orientation?.lock) await screen.orientation.lock('landscape');
          sonuc.textContent = 'Gerekirse cihazını elle yana çevir.';
        } catch (e) {
          sonuc.textContent = 'Tarayıcı otomatik geçişe izin vermedi. Cihazını elle yana çevirebilirsin.';
        }
        planla();
      });
      window.addEventListener('resize', planla);
      window.addEventListener('orientationchange', planla);
      window.visualViewport?.addEventListener('resize', planla);
      screen.orientation?.addEventListener('change', planla);
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) screen.orientation?.unlock?.();
        planla();
      });
      olc();
      return planla;
    },
  };
})();
