// ui/ana.js — başlatma: malzeme, sesler, font, ölçü, komutlar; veri hazırlığı; açılışta Günün kelimesi.
// #vitrin adresi Faz 1 statik ekranını (kit vitrini) gösterir.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});

  function komutlariYaz(anlik) {
    document.querySelectorAll('.komutlar .dugme').forEach((btn, i) => {
      if (btn.hidden) { const y = btn.querySelector('.yazi'); if (!y.dataset.metin) y.dataset.metin = y.textContent.trim(); return; }
      const yazi = btn.querySelector('.yazi');
      if (!yazi.dataset.metin) yazi.dataset.metin = yazi.textContent.trim();
      Kit.daktilo.metin(yazi, yazi.dataset.metin, { anlik: true, tohum: ['komut', btn.id] });
      Kit.kalem.dugmeAltiCiz(btn, anlik ? 0 : 600 + i * 90, anlik);
    });
  }

  const KOMUTLAR = {
    'k-istatistik': () => BH.sonuc.istatistikNotu(),
    'k-paylas': () => (BH.modlar.aktif === 'duello' && BH.duello.mac && BH.duello.mac.turlar.length
      ? BH.sonuc.paylas(null, null, BH.duello.paylasimMetni()) : BH.sonuc.paylas(BH.akis.durum)),
    'k-analiz': () => BH.analiz && BH.analiz.ac(),
    'k-serbest': () => BH.modlar.serbestNotu(),
    'k-duello': () => BH.duello.notu(),
    'k-ayarlar': () => BH.ayarlar && BH.ayarlar.ac(),
    'k-nasil': () => BH.ayarlar && BH.ayarlar.nasil(),
    'k-ses': () => BH.ayarlar && BH.ayarlar.sesDegistir(),
    'k-gunun': () => BH.modlar.gunun(),
  };
  function komutlariBagla() {
    for (const [id, fn] of Object.entries(KOMUTLAR)) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => { Kit.kalem.dugmeAltiVurgu(b); fn(); });
    }
  }

  let sonGen = 0, sonYuk = 0, zamanlayici = 0;
  function boyutDegisti() {
    const { vw, vh } = Kit.kalem.alan();
    if (vw < 200 || vh < 200) return;                                      // gizli sekme ya da geçici sıfır ölçü
    if (Math.abs(vw - sonGen) < 2 && Math.abs(vh - sonYuk) < 40) return;   // mobil adres çubuğu oynaması
    sonGen = vw; sonYuk = vh;
    BH.sahne.olc(BH.depo.ayar().duzen);
    komutlariYaz(true);
    BH.ayarlar.sesGoster();
    if (BH.vitrinde) { BH.klavye.yenile(); BH.vitrin.goster({ anlik: true }); return; }
    if (BH.not.acik) { BH.not.boyutDegisti(); return; }              // gizli kâğıt ölçülemez: not kapanınca çizilir
    if (BH.akis.durum) BH.akis.ciz({ anlik: true });
    if (BH.modlar.boyut) BH.modlar.boyut();
  }

  async function basla() {
    if (typeof rough === 'undefined') { Kit.kalem.kalemYok(); return; }
    Kit.malzeme.sec('kopyakalemi');
    BH.ses.kur();
    BH.ayarlar.kur();
    const fontHazir = await Kit.kalem.fontBekle('Courier Prime', 'BEŞ HARF ğşıİçöü');
    const o = BH.sahne.olc(BH.depo.ayar().duzen);
    sonGen = o.vw; sonYuk = o.vh;
    komutlariYaz(false);
    komutlariBagla();
    addEventListener('resize', () => { clearTimeout(zamanlayici); zamanlayici = setTimeout(boyutDegisti, 150); });
    if (!fontHazir) Kit.kalem.fontGelince(() => { sonGen = 0; boyutDegisti(); }, 'Courier Prime', 'BEŞ HARF ğşıİ');

    if (location.hash === '#vitrin') {
      BH.vitrinde = true;
      BH.klavye.kur(document.getElementById('klavye'), { duzen: 'q' });
      await BH.vitrin.goster({ anlik: false });
    } else {
      BH.modlar.hazirla();
      if (BH.modlar.baslangic) BH.modlar.baslangic(); else BH.modlar.gunun();
    }
    addEventListener('hashchange', () => { if (/^#k=/.test(location.hash) && !BH.vitrinde) BH.modlar.baslangic(); });
    setTimeout(() => BH.ayarlar.sesGoster(), 1200);
    document.documentElement.dataset.hazir = 'true';
    BH.hazir = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
})();
