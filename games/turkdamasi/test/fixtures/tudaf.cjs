// TÜDAF v3, PDF sayfa 5–9: her örneğin SOL (başlangıç) şeması.
// Mavi=beyaz (+1), kırmızı=siyah (-1). Damalar ayrı listelenir.
// x işaretli metinlerden değil, şemaların karelerinden aktarılmıştır.
module.exports = [
  {
    number: 1, page: 5, turn: 1,
    blue: 'a4 h4 a3 b3 c3 d3 e3 f3 g3 h3 a2 c2 d2 f2',
    red: 'c7 h7 a6 b6 c6 d6 e6 g6 h6 a5 b5 c5 e5 g5 f4',
    paths: ['f3 f5 d5 d7 b7'], maximum: 4,
  },
  {
    number: 2, page: 5, turn: 1,
    blue: 'a4 h4 a3 b3 c3 d3 e3 f3 g3 h3 a2 c2 d2 f2',
    red: 'c7 e7 g7 a6 b6 c6 d6 e6 g6 h6 a5 b5 c5 e5 g5 f4',
    paths: ['f3 f5 h5 h7 f7 d7 b7'], maximum: 6,
  },
  {
    number: 3, page: 6, turn: -1,
    blue: 'c5 a4 g4 a3 b3 c3 f3 h3 b2 e2 g2',
    red: 'a7 d7 e7 f7 g7 e6 f6 g6 e5', redKings: 'c8',
    // PDF iki dönüş yolunu yazar. İkinci yolda h2→f2 yerine e2/d2/c2
    // inişleri de yasaldır: e2 daha önce alınmıştır, b2 sonraki atlayıştadır.
    paths: [
      'c8 c4 c2 f2 h2 h4 f4 f2 a2', 'c8 c4 c2 f2 f4 h4 h2 f2 a2',
      'c8 c4 c2 f2 f4 h4 h2 e2 a2', 'c8 c4 c2 f2 f4 h4 h2 d2 a2',
      'c8 c4 c2 f2 f4 h4 h2 c2 a2',
    ], maximum: 8,
  },
  {
    number: 4, page: 6, turn: -1,
    blue: 'c5 a4 f4 g4 h4 a3 b3 c3 f3 h3 b2 e2 g2',
    red: 'a7 d7 e7 f7 g7 e6 f6 g6 f5', redKings: 'c8',
    paths: ['c8 c4 c2 f2 h2'], maximum: 4,
  },
  {
    number: 5, page: 7, turn: 1,
    blue: 'e4 a3 b3 e3 f3 h3 d2 e2 g2',
    red: 'a7 d7 e7 f7 g7 f6 g6 e5', redKings: 'c8',
    paths: ['e4 e6 e8'], maximum: 2, promotion: true,
  },
  {
    number: 6, page: 7, turn: 1,
    blue: 'f7 a4 c4 a3 b3 c3 d3 e3 g3 a2 b2 d2 f2 g2',
    red: 'a7 b7 c7 d7 a6 b6 c6 d6 h6 a5 c5', redKings: 'e8',
    paths: ['f7 f8'], maximum: 0, promotion: true,
    // Bu örnekte başka normal hamleler de yasaldır.
    allowOtherPaths: true,
  },
  {
    number: 7, page: 8, turn: 1,
    blue: 'f6 a4 c4 a3 b3 c3 d3 g3 a2 b2 d2 f2 g2',
    red: 'a7 b7 c7 d7 f7 a6 b6 c6 d6 h6 a5 c5', redKings: 'e8',
    paths: ['f6 f8 d8'], maximum: 2, promotion: true,
  },
  {
    number: 8, page: 8, turn: 1,
    blue: 'e5 a4 c4 a3 b3 c3 d3 e3 g3 a2 b2 c2 d2 e2 f2', blueKings: 'h1',
    red: 'a7 b7 c7 d7 a6 b6 c6 d6 h6 a5 c5 f5',
    paths: ['e5 g5', 'h1 h7', 'h1 h8'], maximum: 1,
  },
  {
    number: 9, page: 9, turn: 1,
    blue: 'e5 a4 c4 a3 b3 c3 d3 e3 g3 a2 b2 c2 d2 e2 f2', blueKings: 'h1',
    red: 'a7 b7 c7 d7 a6 b6 c6 d6 f6 g6 h6 a5 c5 f5',
    paths: ['e5 g5 g7'], maximum: 2,
  },
  {
    number: 10, page: 9, turn: 1,
    blue: 'e5 a4 c4 a3 b3 c3 d3 e3 g3 a2 b2 c2 d2 e2 f2', blueKings: 'h1',
    red: 'a7 b7 c7 d7 e7 g7 a6 b6 c6 d6 f6 h6 a5 c5 f5',
    paths: ['h1 h7 f7'], maximum: 2,
  },
];
