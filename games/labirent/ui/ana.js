// ui/ana.js — açılış: malzeme (jel kalem), ses ayarı, font, marj, ilk labirent (adresteki ?kod= ya da Serbest seçimi).
// Modlar: Günün (açılış), Bölümler, Serbest. Ölçüm için ?dik=60x40.
(function () {
  'use strict';
  const LB = window.LB;
  const $ = (id) => document.getElementById(id);

  async function basla() {
    if (!window.rough || !window.Kit || !Kit.kalem) { if (window.Kit && Kit.kalem) Kit.kalem.kalemYok(); return; }
    Kit.malzeme.sec('jelkalem');
    Kit.ses.kur({ anahtar: LB.config.anahtar + '-sessiz' });
    // tarayıcılar ilk dokunuştan önce ses çaldırmaz: ilk dokunuşta ses bağlamı açılır
    const sesAc = () => Kit.ses.baslat();
    document.addEventListener('pointerdown', sesAc, { capture: true });
    document.addEventListener('keydown', sesAc, { capture: true });
    const yaziVar = await Kit.kalem.fontBekle();
    LB.marj.kur({ mod: 'gunun', kapali: [], sonra: [['sonraki', 'Sonraki seviye'], ['paylas', 'Paylaş']] });
    LB.oyun.kur();
    Kit.kalem.ayar.cizim.animasyon = !LB.oyun.ayar.azHareket;            // azaltılmış hareket: geçişler anında
    LB.ayarlar.kur(LB.oyun);
    LB.modlar.kur();
    $('k-yazdir').addEventListener('click', () => LB.yazdir.yazdir());
    $('k-ses').addEventListener('click', () => { Kit.ses.sessizYap(!Kit.ses.sessiz); LB.marj.sesCiz(); });

    // Açılış: adreste kod varsa o labirent (Serbest), yoksa günün labirenti. Ölçüm için ?dik=60x40.
    const q = new URLSearchParams(location.search), kod = q.get('kod'), dik = /^(\d+)x(\d+)$/.exec(q.get('dik') || '');
    if (dik) LB.modlar.serbest({ tur: 'D', boy: 'V', alg: 'K', tohum: 4242, W: Math.min(80, +dik[1]), H: Math.min(80, +dik[2]) }, true);
    else if (kod && LB.generate.kodOku(kod)) LB.modlar.serbest(LB.generate.kodOku(kod), true);
    else if (q.get('mod') === 'sonsuz') LB.modlar.sonsuz(true);
    else LB.modlar.gunun(true);

    let bekleyen = 0, son = null;
    const yeniden = () => {
      clearTimeout(bekleyen);
      bekleyen = setTimeout(() => {
        if (LB.aktif.d && LB.aktif.d.aktif) return yeniden();            // çizerken ölçü değişmesin (adres çubuğu)
        const w = $('alan').clientWidth, h = $('alan').clientHeight;
        if (son && Math.abs(w - son[0]) < 3 && Math.abs(h - son[1]) < 3) return;     // piksellik oynamalarda yerleşim kalır
        son = [w, h]; LB.aktif.yerlestir(true); LB.marj.yenile(); LB.giris.olc();
      }, 160);
    };
    son = [$('alan').clientWidth, $('alan').clientHeight];
    addEventListener('resize', yeniden);
    if (window.visualViewport) visualViewport.addEventListener('resize', yeniden);
    if (window.ResizeObserver) new ResizeObserver(yeniden).observe($('alan'));     // marj uzayıp kısalınca da
    if (!yaziVar) Kit.kalem.fontGelince(() => { LB.aktif.yerlestir(true); LB.marj.yenile(); });
    LB.hazir = true;
    document.documentElement.dataset.hazir = '1';
  }

  basla().catch(e => { console.error(e); const p = document.createElement('p'); p.className = 'uyari'; p.textContent = 'Defter açılamadı: ' + e.message; document.body.prepend(p); });
})();
