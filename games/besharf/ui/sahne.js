// ui/sahne.js — ölçü: sayfa, daktilo kâğıdı, ızgara kutusu, tuşlar. Hem genişliğe hem yüksekliğe sığan en büyük kutu seçilir.
// 360 × 640'ta: kutu 41 px, tuş 30 × 52 px. Sonuç CSS değişkenlerine yazılır ve BH.sahne.olcu'da tutulur.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});

  function olc(duzen) {
    const a = Kit.kalem.alan();
    const vw = Math.max(300, a.vw), vh = Math.max(480, a.vh);           // gizli sekmede sıfır ölçü gelebilir
    const dar = vw < 620;
    const sayfaW = Math.floor(Math.min(dar ? vw : vw - 48, 600));
    const pad = dar ? 6 : 22;
    const ic = sayfaW - 2 * pad;
    // Tuşlar: en kalabalık satıra göre; Enter ve Sil üçüncü satırın iki ucunda, kalan yeri paylaşır.
    const kAr = dar ? 1.8 : 4;
    const satirlar = BH.klavye.satirlar(duzen).map((s, i) => s.length + (i === 2 ? 2 : 0));
    let tusW = Math.min(dar ? 40 : 46, ...satirlar.map(n => (ic - (n - 1) * kAr) / n));
    tusW = Math.floor(tusW * 10) / 10;
    const harf3 = satirlar[2] - 2;
    const genisW = Math.floor(Math.min(tusW * 2, (ic - harf3 * tusW - (harf3 + 1) * kAr) / 2) * 10) / 10;
    const tusH = Math.round(Math.max(52, Math.min(60, tusW * 1.3)));
    const klavyeH = 3 * tusH + 2 * kAr;
    const komutH = dar ? 40 : 44;
    const kagitW = Math.floor(Math.min(ic - (dar ? 4 : 28), 480));
    const disY = dar ? 0 : 40;
    const ara = dar ? 8 : 14;                                        // sayfadaki bütün dikey boşluklar

    let o = null;
    for (let s = 62; s >= 28 && !o; s--) {
      const g = Math.max(3, Math.round(s * .12));
      const izgaraW = 5 * s + 4 * g, izgaraH = 6 * s + 5 * g;
      const baslikBoy = Math.round(Math.min(30, Math.max(19, s * .56)));
      const noBoy = Math.round(Math.min(15, Math.max(11, s * .29)));
      const ust = 10 + baslikBoy + 9 + noBoy + 12;
      const notH = Math.round(Math.max(20, s * .5));
      const kagitH = ust + izgaraH + notH + 8;
      const toplam = disY + 5 * ara + 2 * komutH + kagitH + klavyeH + 4;   // +4: eğik kâğıdın taşması
      const yan = Math.max(42, s);
      if ((izgaraW + 2 * yan <= kagitW && toplam <= vh) || s === 28) {
        o = { s, g, izgaraW, izgaraH, baslikBoy, noBoy, ust, notH, kagitH, toplam };
      }
    }
    Object.assign(o, { dar, vw, vh, sayfaW, pad, ic, kAr, tusW, genisW, tusH, klavyeH, komutH, kagitW, disY, ara });
    o.uzanti = klavyeH + ara;                                        // oyun sonunda kâğıt tuşların yerine bu kadar uzar
    o.alanH = o.kagitH + o.uzanti;                                   // not sayfasının yüksekliği (kâğıt + tuşlar)
    o.izgaraX = Math.round((kagitW - o.izgaraW) / 2);
    o.izgaraY = o.ust;
    o.harfBoy = Math.round(o.s * .62);
    o.sq = Math.max(16, Math.min(22, Math.round(sayfaW / 22)));

    const st = document.documentElement.style;
    const px = (v) => v + 'px';
    st.setProperty('--sq', px(o.sq));
    st.setProperty('--sayfa-w', px(sayfaW));
    st.setProperty('--sayfa-pad', px(pad));
    st.setProperty('--kagit-w', px(kagitW));
    st.setProperty('--kagit-h', px(o.kagitH));
    st.setProperty('--tus-w', px(tusW));
    st.setProperty('--tus-genis', px(genisW));
    st.setProperty('--tus-h', px(tusH));
    st.setProperty('--tus-aralik', px(kAr));
    st.setProperty('--komut-h', px(komutH));
    st.setProperty('--dis-y', px(disY / 2));
    st.setProperty('--ara', px(ara));
    st.setProperty('--alan-h', px(o.alanH));
    document.body.dataset.duzen = dar ? 'dar' : 'genis';
    BH.sahne.olcu = o;
    return o;
  }

  // Ekran okuyucuya kısa duyuru (#duyuru, aria-live)
  function duyur(metin) {
    const d = document.getElementById('duyuru');
    if (!d) return;
    d.textContent = '';
    setTimeout(() => { d.textContent = metin; }, 30);
  }

  BH.sahne = { olc, duyur, olcu: null };
})();
