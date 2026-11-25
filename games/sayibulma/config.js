// Ayarlar tek yerde. Tarayıcıda window.SB.config olur; node'da require edilebilir.
// Sayfadaki "Ayarlar" notu (mod, zorluk; Faz 6'da hane, sıfır, tekrarlı) bunların üstüne yazar.
(function () {
  'use strict';

  const config = {
    hane: 4,                                    // 3 · 4 · 5
    tekrar: true,                               // rakamlar tekrar edebilir (5755 gibi; çoklu küme sayımı). Günün sayısı hep farklı rakamlı
    sifirBaslar: false,                         // ilk hane 0 olabilir
    mod: 'senbul',                              // senbul · obulsun · yaris · ikikisi · gunun
    zorluk: 'kolay',                            // kolay · orta · zor (sen bul'da yardımlar, diğerlerinde çözücü seviyesi)
    ipucuNotuEsigi: 15,                         // bu kadar tahminden sonra "ipucu ister misin?"
    cozucu: {
      butceMs: 300,                             // tahmin hesabı bu süreyi aşarsa o ana kadarki en iyiyle devam
      dilimMs: 8,                               // hesap bu kadar çalışınca tarayıcıya döner
      islemSiniri: 8e6,                         // tahmin × aday çifti bunu aşarsa tohumlu örnekleme (5 hane, tekrarlı)
      dusunmeMs: [500, 900],                    // bilgisayarın tahmini en erken bu kadar sonra yazılır
    },
    ikiKisi: { cevaplariBizVeririz: false },    // açıkken cevaplar sayaçla girilir, cihaz yalnız çelişki kontrolü yapar
    satir: { masaustu: 36, telefon: 32 },       // satır aralığı (px)
    cizim: {},                                  // kırmızı-mavi kalem malzemesinin üstüne yazım (boş: malzemenin değerleri)
    renk: {},
  };

  if (typeof window !== 'undefined') (window.SB = window.SB || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
