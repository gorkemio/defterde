// ui/analiz.js — oyun sonu analizi: her tahminden sonra kalan aday sayısı, bilgisayarın o adımda ne önereceği ve kaç aday
// bırakacağı, beceri ve şans ayrı ayrı. Çözücü engine/solver.js (analiz ~0,1 sn: oyun biter bitmez açılır).
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const sayi = (n) => Number(n).toLocaleString('tr-TR');
  const bit = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1).replace('.', ',');
  const yuzde = (x) => '%' + Math.round(100 * x);

  function ac() {
    const d = BH.akis.durum;
    if (!d || !d.tahminler.length || !BH.game.bitti(d)) {
      BH.not.ac({ baslik: 'Analiz', ciz(ic, y) {
        y.satir('Analiz oyun bitince açılır: her tahminden sonra kaç aday kaldığı, bilgisayarın ne önereceği, beceri ve şans.');
      } });
      return;
    }
    const C = BH.modlar.solver();
    const a = C.analiz(d.tahminler.map((t) => t.kelime), d.cevap);
    BH.not.ac({
      baslik: 'Analiz', genis: true,
      ciz(ic, y) {
        const zincir = [sayi(a.adimlar[0].once), ...a.adimlar.map((x) => sayi(x.sonra))].join(' → ');
        y.satir('Kalan aday: ' + zincir, { sinif: 'analiz-zincir' });
        a.adimlar.forEach((x, i) => {
          y.satir(`${i + 1}. ${x.tahmin}${x.adayMi ? ' ' : '*'} ${sayi(x.once).padStart(5, ' ')} → ${sayi(x.sonra)}`, { sinif: 'analiz-adim' });
          if (x.oneri) {
            const ayni = x.oneri.kelime === x.tahmin;
            y.satir(`   öneri ${x.oneri.kelime}${ayni ? ' (aynısı)' : ''} → ${sayi(x.oneri.kalan)} · beceri ${yuzde(x.beceri)} · şans ${bit(x.sans)}`,
              { sinif: 'analiz-oneri' });
          } else if (x.once === 1) y.satir('   tek aday kalmıştı', { sinif: 'analiz-oneri' });
        });
        y.satir(`Beceri ${yuzde(a.beceri)} · Şans ${bit(a.sans)} bit`, { sinif: 'analiz-ozet' });
        if (a.cozuldu) y.satir(`${a.tahminSayisi} tahmin · Zor bilgisayar ${a.bilgisayarTahmin} tahminde bulurdu`, { sinif: 'analiz-ozet2' });
        else y.satir(`Bulunamadı · ${a.tahminSayisi} tahmin sonra ${sayi(a.kalanSayisi)} aday${a.kalanlar ? ': ' + a.kalanlar.join(', ') : ''}`, { sinif: 'analiz-ozet2' });
        y.satir('beceri: tahminin beklenen bilgisi / önerinin beklenen bilgisi. şans: beklenen kalan aday / gerçekte kalan (bit). '
          + '* cevap listesinde olmayan tahmin.', { sinif: 'analiz-not' });
      },
    });
  }

  BH.analiz = { ac };
})();
