// Sonuç yalnız tamamlanmış oyun için gösterilir; kapatılan not kendiliğinden açılmaz.
(function () {
  'use strict';
  const TD = window.TD;
  function create(dialog) {
    const $ = id => dialog.querySelector('#' + id);
    const seen = new WeakSet();
    TD.draw.ornek($('sonuc-mavi'), 'sonuc-mavi-tas', 'mavi', false, 1);
    TD.draw.ornek($('sonuc-kirmizi'), 'sonuc-kirmizi-tas', 'kirmizi', false, 1);
    TD.draw.altCizgi($('sonuc-cizgi'), TD.config.renk.kirmizi, 'sonuc', 2.8);

    function render(state, { demo = false, motion = 'system' } = {}) {
      const result = state.game?.result;
      if (!result || demo) {
        if (dialog.open) dialog.close();
        return;
      }
      if (seen.has(result)) return;
      // Açık yardım/ayar/teklif üzerine ikinci modal bindirme. Kapanınca yeniden bakılır.
      if ([...document.querySelectorAll('dialog[open]')].some(el => el !== dialog)) return;
      const draw = result.winner === 0, ai = state.mode === 'ai';
      const won = result.winner === state.human;
      const winner = result.winner === 1 ? 'Mavi' : 'Kırmızı';
      const loser = result.winner === 1 ? 'Kırmızı' : 'Mavi';
      dialog.dataset.durum = draw ? 'berabere' : ai && !won ? 'kayip' : 'kazanc';
      dialog.dataset.takim = result.winner === -1 ? 'kirmizi' : 'mavi';
      dialog.dataset.hareket = motion === 'reduce' ||
        (motion === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'az' : 'tam';
      $('sonuc-mavi').style.display = draw || result.winner === 1 ? '' : 'none';
      $('sonuc-kirmizi').style.display = draw || result.winner === -1 ? '' : 'none';
      $('sonuc-baslik').textContent = draw ? 'Berabere!' : ai ? won ? 'Kazandın!' : 'Bu kez olmadı.' : winner + ' kazandı!';
      let reason;
      if (draw) {
        reason = ({
          'one-each': 'İki tarafta da birer taş kaldı.',
          repetition: 'Aynı konum üçüncü kez oluştu.',
          agreement: 'Beraberlikte anlaştınız.',
        })[result.reason];
      } else if (ai) {
        reason = result.reason === 'no-pieces'
          ? won ? 'Bilgisayarın taşı kalmadı.' : 'Bilgisayar kazandı; taşların bitti.'
          : won ? 'Bilgisayarın oynayabileceği hamle kalmadı.' : 'Bilgisayar kazandı; oynayabileceğin hamle kalmadı.';
      } else {
        reason = result.reason === 'no-pieces' ? loser + ' taşların hepsi alındı.' : loser + ' hamle yapamıyor.';
      }
      $('sonuc-aciklama').textContent = reason;
      $('sonuc-davet').textContent = draw ? 'Bir el daha?' : ai && !won ? 'Rövanşa ne dersin?' : 'Güzel oyun! Bir el daha?';
      seen.add(result);
      dialog.showModal();
    }
    return Object.freeze({ render });
  }
  TD.result = Object.freeze({ create });
})();
