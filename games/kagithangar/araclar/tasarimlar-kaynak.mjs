// Altı MVP tasarımının kaynağı. `node araclar/beklenen.mjs` bunlardan tasarimlar/*.json üretir ve
// `beklenen` alanını motorun çıktısıyla doldurur. Tasarımı değiştirmek için JSON'u elle de düzenleyebilirsin;
// o zaman `node araclar/beklenen.mjs --yalniz-beklenen` yalnız beklenen alanını yeniler.
const K2 = Math.SQRT1_2;                                  // 0.7071…
const A = 1.414;
// yatay A4 (en = √2, boy = 1), burun üstte
const EN = 1.41422, S2 = 0.70711, C = 0.353555;
const RULO = 0.058;                                       // 1,25 cm / 21,6 cm
const GOVDE = 0.116;                                      // 2,5 cm gövde
const orta = (ek) => ({ tip: 'vadi', cizgi: [[0.5, 0], [0.5, A]], katman: 'hepsi', tut: [1, 0.707], ac: true,
  metin: 'Kağıdı uzunlamasına ikiye katla, sonra aç.', ...ek });
const koseler = { tip: 'vadi', cizgi: { nokta: [0, 0], hedef: [0.5, 0.5] }, katman: 'hepsi', ayna: true,
  metin: 'Üst köşeleri orta çizgiye getir.' };
const egriKenar = { tip: 'vadi', cizgi: { nokta: [0, 0.5], hedef: [0.5, K2] }, katman: 'hepsi', ayna: true,
  metin: 'Eğik kenarları da orta çizgiye getir.' };
const yarim = (tip = 'vadi', metin = 'Ortadan ikiye katla; kapaklar içeride kalsın.') =>
  ({ tip, cizgi: [[0.5, 0], [0.5, A]], katman: 'hepsi', tut: [1, A], metin });
const kanat1 = (x, metin = 'Üstteki kanadı, gövdeye paralel katla.') =>
  ({ tip: 'vadi', cizgi: [[x, 0], [x, A]], katman: 'ust', tut: [0, A], kanat: 'sol', poz: 90, metin });
const cevir = (metin = 'Uçağı ters çevir.') => ({ tip: 'cevir', metin });
const kanat2 = (x, metin = 'Öbür kanadı da aynı hizada katla.') =>
  ({ tip: 'vadi', cizgi: [[x, 0], [x, A]], katman: 'ust', tut: [1, A], kanat: 'sag', poz: 90, metin });
// Dart ailesinin gerçek kanat katı: ikiye katlanmış uçağın üst (eğik) kenarı, menteşe noktasından (burun) geçen
// açıortayla bir hizaya indirilir. P: üst kenarın arka ucu, A: menteşe noktası, hizaX: kenarın oturacağı dikey çizgi.
// Hedef, P'nin A'ya uzaklığı kadar aşağıda o çizgi üstünde: kat çizgisi A'dan geçen orta dikmedir.
const aciliKanat = (P, A, hizaX, metin, ikinci = false) => {
  const d = Math.hypot(P[0] - A[0], P[1] - A[1]);
  const Q = [hizaX, A[1] + Math.sqrt(Math.max(0, d * d - (hizaX - A[0]) ** 2))];   // P'nin indiği yer
  // kat çizgisi A'dan geçer (köşe tam üstünde kalsın diye iki noktayla, yuvarlamasız): AP ile AQ'nun açıortayı
  let u = [(P[0] - A[0]) / d + (Q[0] - A[0]) / d, (P[1] - A[1]) / d + (Q[1] - A[1]) / d];
  const L = Math.hypot(u[0], u[1]);
  u = [u[0] / L, u[1] / L];
  const B = [A[0] + u[0] * 1.6, A[1] + u[1] * 1.6];
  const ayna = ([x, y]) => [1 - x, y];
  return ikinci
    ? { tip: 'vadi', cizgi: [ayna(A), ayna(B)], katman: 'ust', tut: ayna(P), kanat: 'sag', poz: 90, metin }
    : { tip: 'vadi', cizgi: [A, B], katman: 'ust', tut: P, kanat: 'sol', poz: 90, metin };
};
const EGIK_UC = 0.5 + 0.5 * Math.SQRT2;                    // eğik kenarlar orta çizgiye inince kenarın x=0'daki ucu (1.2071)

export default [
  {
    // foldnfly.com Basic Dart: kanatlar "gövdenin alt kenarına" indirilir; gövde burunda sıfır, kuyrukta derin.
    id: 'ok', ad: 'Ok', orijinalAd: 'Basic Dart', zorluk: 1, tur: 'mesafe', surum: 2,
    kaynak: 'foldnfly.com Basic Dart',
    karakter: { hiz: 7, suzulme: 4, denge: 6, akrobasi: 2 },
    aciklama: 'Herkesin ilk uçağı. Sert at, dümdüz gider.',
    adimlar: [orta(), koseler, egriKenar, yarim(),
      aciliKanat([0, EGIK_UC], [0.5, 0], 0.5, 'Kanadı burnun ucundan başlayarak aşağı katla; üst kenarı gövdenin alt kenarına otursun.'),
      cevir(),
      aciliKanat([0, EGIK_UC], [0.5, 0], 0.5, 'Öbür kanadı da aynı şekilde katla.', true)],
  },
  {
    // Nakamura Lock (Eiji Nakamura). Exploratorium yönergesi: ucun 2,5 cm'si kilit olarak yukarı katlanır.
    id: 'kilit', ad: 'Kilit', orijinalAd: 'Nakamura Lock', zorluk: 2, tur: 'mesafe', surum: 2,
    kaynak: 'Nakamura Lock (Exploratorium yönergesi)',
    karakter: { hiz: 6, suzulme: 6, denge: 7, akrobasi: 2 },
    aciklama: 'Burnundaki kilit kanatları bir arada tutar. Dengeli ve uzun uçar.',
    adimlar: [
      orta(), koseler,
      { tip: 'vadi', cizgi: [[0, 0.6], [1, 0.6]], katman: 'hepsi', tut: [0.5, 0], metin: 'Sivri ucu aşağı katla.' },
      { tip: 'vadi', cizgi: { nokta: [0, 0.6], hedef: [0.5, 1.1] }, katman: 'hepsi', ayna: true,
        metin: 'Yeni köşeleri ortada buluştur; ucun küçük bir parçası açıkta kalsın.' },
      { tip: 'vadi', cizgi: [[0, 1.1], [1, 1.1]], katman: 'ust', tut: [0.5, 1.2],
        metin: 'Açıkta kalan ucu yukarı katla: kilit bu.' },
      yarim('dag', 'Kilit dışarıda kalacak şekilde ortadan arkaya katla.'),
      aciliKanat([0, 1.1], [0.5, 0.6], 0.5, 'Kanadı burundan başlayarak aşağı katla; üst kenarı gövdenin alt kenarına otursun.'),
      cevir(),
      aciliKanat([0, 1.1], [0.5, 0.6], 0.5, 'Öbür kanadı da aynı şekilde katla.', true),
    ],
  },
  {
    // Bulldog Dart (Art of Manliness): ikinci köşe katı kağıt çevrilip yapılır; uç, katların ortada buluştuğu
    // yerin dibine iner; kanat kenarı küt burnun üstüyle bir hizaya gelir.
    id: 'buldog', ad: 'Buldog', orijinalAd: 'Bulldog Dart', zorluk: 2, tur: 'mesafe', surum: 2,
    kaynak: 'Bulldog Dart (Art of Manliness)',
    karakter: { hiz: 6, suzulme: 4, denge: 9, akrobasi: 2 },
    aciklama: 'Küt burunlu, inatçı bir dart. Duvara çarpsa da kolay kolay bozulmaz; yumuşak at.',
    adimlar: [
      orta(), koseler, cevir('Kağıdı ters çevir.'),
      { ...egriKenar, metin: 'Köşeleri yine orta çizgiye getir; eğik kenar ortaya otursun.' },
      { tip: 'vadi', cizgi: [[0, K2 / 2], [1, K2 / 2]], katman: 'hepsi', tut: [0.5, 0],
        metin: 'Sivri ucu, katların ortada buluştuğu yerin dibine indir: küt burun.' },
      yarim('vadi', 'Ortadan ikiye katla; küt burun içeride kalsın.'),
      aciliKanat([0, EGIK_UC], [0.5 - K2 / 2 * Math.tan(Math.PI / 8), K2 / 2], 0.5 - K2 / 2 * Math.tan(Math.PI / 8),
        'Kanadı aşağı katla; kanadın kenarı küt burnun üstüyle düz bir çizgi olsun.'),
      cevir(),
      aciliKanat([0, EGIK_UC], [0.5 - K2 / 2 * Math.tan(Math.PI / 8), K2 / 2], 0.5 - K2 / 2 * Math.tan(Math.PI / 8),
        'Öbür kanadı da aynı hizada katla.', true),
    ],
  },
  {
    // John Collins'in 2012 mesafe dünya rekoru uçağı. Kaynak: Maker Camp 2015 "Suzanne" sayfası (19 mm kırpma atlandı).
    id: 'marti', ad: 'Martı', orijinalAd: 'Suzanne', zorluk: 3, tur: 'suzulme', surum: 2,
    kaynak: 'John Collins, 2012 mesafe dünya rekoru (Suzanne)',
    kagit: { en: EN, boy: 1 },
    karakter: { hiz: 4, suzulme: 8, denge: 8, akrobasi: 2 },
    aciklama: 'Dünya rekoru kıran planör. Yatay kağıttan kısa, geniş kanatlı; yumuşak at, uzun süzülsün.',
    adimlar: [
      { tip: 'vadi', cizgi: { nokta: [EN, 0], hedef: [0, EN] }, katman: 'hepsi', ac: true, ayna: true,
        metin: 'Kağıdı yatay tut. Üst köşeyi karşı kenara katla ve aç; öbür köşe için de yap: bir X kırışığı.' },
      { tip: 'vadi', cizgi: { nokta: [EN, 1], hedef: [1.12133, 1.12133] }, katman: 'hepsi', ac: true, ayna: true,
        metin: 'Yan kenarı ilk çapraz kırışığa getir ve aç; öbür yanda da.' },
      { tip: 'vadi', cizgi: { nokta: [0, 1], hedef: [0.29289, 1.12133] }, katman: 'hepsi', ayna: true,
        metin: 'Sol kapağı katla, sağ kapağı da onun üstüne katla.' },
      { tip: 'vadi', cizgi: [[0, C], [EN, C]], katman: 'hepsi', tut: [S2, 0],
        metin: 'Kapak kenarlarının kesiştiği yerden üst kısmı aşağı katla; üst kenar alt kenara paralel.' },
      { tip: 'vadi', cizgi: [[S2, C], [0.10711, 0.953555]], katman: 'hepsi', tut: [0.43934, C], ayna: true,
        metin: 'Üst köşeleri ortada buluştur.' },
      cevir(),
      { tip: 'vadi', cizgi: [[S2, 0], [S2, 1]], katman: 'hepsi', tut: [1.24264, 1],
        metin: 'Ortadan ikiye katla: alt kenar üst kenara.' },
      { tip: 'vadi', cizgi: { nokta: [0.17158, 1], hedef: [S2, 1.18409] }, katman: 'ust', kanat: 'sol', poz: 90,
        metin: 'Kanadı burnun biraz gerisinden başlayarak aşağı katla; çapraz kenar arka köşeyle hizalansın.' },
      cevir(),
      { tip: 'vadi', cizgi: { nokta: [EN - 0.17158, 1], hedef: [S2, 1.18409] }, katman: 'ust', kanat: 'sag', poz: 90,
        metin: 'Öbür kanadı da aynı hizada katla.' },
    ],
  },
  {
    // foldnfly.com Loop Plane. Aslında kanat uçlarına makasla iki yarık açılır; burada yarıkların yerine ayarlanabilir
    // kanatçık var (varsayılan bir çentik yukarı), böylece makassız takla atar.
    id: 'taklaci', ad: 'Taklacı', orijinalAd: 'Loop Plane', zorluk: 2, tur: 'akrobasi', surum: 2,
    kaynak: 'foldnfly.com Loop Plane (kanat yarıkları yerine kanatçık)',
    kagit: { en: EN, boy: 1 }, varsayilanAyar: { kanatcik: 1 },
    karakter: { hiz: 4, suzulme: 5, denge: 4, akrobasi: 9 },
    aciklama: 'Ağır rulo burunlu takla uçağı. Kanatçıkları yukarıdayken sertçe at, havada çember çizsin.',
    adimlar: [
      { tip: 'vadi', cizgi: [[S2, 0], [S2, 1]], katman: 'hepsi', tut: [EN, 0.5], ac: true,
        metin: 'Kağıdı yatay tut, soldan sağa ikiye katla ve aç.' },
      { tip: 'vadi', cizgi: { nokta: [0, 0], hedef: [S2, S2] }, katman: 'hepsi', ayna: true,
        metin: 'Üst köşeleri orta çizgiye katla.' },
      ...[1, 2, 3, 4].map(k => ({
        tip: 'vadi', cizgi: [[0, RULO * k], [EN, RULO * k]], katman: 'hepsi', tut: [S2, RULO * (k - 1)],
        metin: k === 1 ? 'Sivri ucu 1,25 cm aşağı katla.' : k === 4 ? 'Son bir kez daha: ağır, rulo bir burun.' : 'Bir kez daha aşağı katla.',
      })),
      { tip: 'vadi', cizgi: [[S2, 0], [S2, 1]], katman: 'hepsi', tut: [EN, 1], metin: 'Ortadan ikiye katla.' },
      { tip: 'vadi', cizgi: [[S2 - GOVDE, 0], [S2 - GOVDE, 1]], katman: 'ust', tut: [0, 1], kanat: 'sol', poz: 90,
        metin: 'Kanadı gövdeye paralel katla; gövde 2,5 cm kalsın.' },
      cevir(),
      { tip: 'vadi', cizgi: [[S2 + GOVDE, 0], [S2 + GOVDE, 1]], katman: 'ust', tut: [EN, 1], kanat: 'sag', poz: 90,
        metin: 'Öbür kanadı da aynı hizada katla.' },
      { tip: 'vadi', cizgi: [[0.332, 0], [0.332, 1]], katman: 'ust', tut: [0.232, 1], poz: 90,
        metin: 'Kanadın ucunu yukarı kıvır.' },
      cevir(),
      { tip: 'vadi', cizgi: [[EN - 0.332, 0], [EN - 0.332, 1]], katman: 'ust', tut: [EN - 0.232, 1], poz: 90,
        metin: 'Öbür kanadın ucunu da kıvır.' },
    ],
  },
  {
    // foldnfly.com Underside Plane: yatay kağıttan kısa, çok geniş bir uçan kanat. Kapaklar kanadın altında kalır.
    id: 'yarasa', ad: 'Yarasa', orijinalAd: 'Underside Plane', zorluk: 2, tur: 'suzulme', surum: 2,
    kaynak: 'foldnfly.com Underside Plane',
    kagit: { en: EN, boy: 1 },
    karakter: { hiz: 3, suzulme: 9, denge: 6, akrobasi: 3 },
    aciklama: 'Gövdesi minicik, kanadı kocaman bir uçan kanat. Yavaşça daireler çizerek süzülür.',
    adimlar: [
      { tip: 'vadi', cizgi: [[S2, 0], [S2, 1]], katman: 'hepsi', tut: [EN, 0.5], ac: true,
        metin: 'Kağıdı yatay tut, dikine ikiye katla ve aç.' },
      { tip: 'vadi', cizgi: [[0, 0.5], [EN, 0.5]], katman: 'hepsi', tut: [S2, 0], ac: true,
        metin: 'Enine de ikiye katla ve aç.' },
      { tip: 'vadi', cizgi: [[0, 0.25], [EN, 0.25]], katman: 'hepsi', tut: [S2, 0],
        metin: 'Üst kenarı ortadaki kırışığa indir.' },
      { tip: 'vadi', cizgi: [[0, 0.5], [EN, 0.5]], katman: 'hepsi', tut: [S2, 0.25],
        metin: 'Bir kez daha, ortadaki kırışıktan aşağı katla.' },
      { tip: 'vadi', cizgi: { nokta: [EN, 0.5], hedef: [EN - 0.25, 0.75] }, katman: 'hepsi', ayna: true,
        metin: 'Üst köşeleri şeridin alt çizgisine indir.' },
      { tip: 'vadi', cizgi: [[S2, 0.5], [0, 0.75]], katman: 'hepsi', tut: [0.25, 0.5], ayna: true,
        metin: 'Ortadan kenara çapraz katla; yanlar sivri bir tepe oluştursun.' },
      { tip: 'vadi', cizgi: [[0, 0.625], [EN, 0.625]], katman: 'hepsi', tut: [S2, 0.5],
        metin: 'Tepeyi şeridin alt çizgisine indir.' },
      { tip: 'dag', cizgi: [[S2, 0], [S2, 1]], katman: 'hepsi', tut: [EN, 1], metin: 'Ortadan arkaya ikiye katla; katlar dışarıda kalsın.' },
      { tip: 'vadi', cizgi: [[S2 - GOVDE, 0], [S2 - GOVDE, 1]], katman: 'ust', tut: [0, 1], kanat: 'sol', poz: 90,
        metin: 'Kanadı dışa katla; gövde 2,5 cm kalsın.' },
      cevir(),
      { tip: 'vadi', cizgi: [[S2 + GOVDE, 0], [S2 + GOVDE, 1]], katman: 'ust', tut: [EN, 1], kanat: 'sag', poz: 90,
        metin: 'Öbür kanadı da aynı hizada katla.' },
    ],
  },
];
