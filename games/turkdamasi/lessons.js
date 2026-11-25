(function (root) {
  'use strict';
  const TD = root.TD;
  const square = s => 'abcdefgh'.indexOf(s[0]) + 8 * (+s[1] - 1);
  function lesson(id, title, blue, red, route, notes, captures = 0, promotion = false) {
    const cells = Array(64).fill(0);
    for (const [list, side] of [[blue, 1], [red, -1]]) for (const s of list.split(' ')) cells[square(s)] = side;
    return Object.freeze({ id, title, position: TD.board.position(cells, 1),
      route: Object.freeze(route.split(' ').map(square)), notes: Object.freeze(notes), captures, promotion });
  }
  TD.lessons = Object.freeze([
    lesson('move', 'Normal hareket', 'c3 f2', 'f6 a7', 'c3 c4',
      ['Taş bir kare ileri ya da yana gider. Geri ve çapraz gidemez.', 'c3 → c4: Bir kare ileri gittik. Sıra kırmızıda.']),
    lesson('capture', 'Zorunlu alma', 'c3 f2', 'c4 g7', 'c3 c5',
      ['Önümüzde rakip, arkasında boş kare var. Almak zorundayız.', 'c4’teki taş kalktı. c5’e indik; başka bir hamle seçemezdik.'], 1),
    lesson('chain', 'Çoklu alma', 'c3 f2', 'c4 d5 g7', 'c3 c5 e5',
      ['En çok taşı alan tam yol seçilir. Bu yolda iki taş var.', 'Bir taş aldık. Sıra değişmedi; aynı taşla devam ediyoruz.', 'İkinci taşı da aldık. İki atlayış, tek tur.'], 2),
    lesson('crown', 'Dama olma', 'f6 a2', 'f7 e8 h6', 'f6 f8 d8',
      ['Alarak son sıraya gideceğiz.', 'Son sıradayız ama tur bitmedi. Bitişik almayı normal taş olarak sürdürüyoruz.', 'Tur bitti, taç geldi. Uzun menzili kendi sonraki sıramızda kullanabiliriz.'], 2, true),
  ]);
})(globalThis);
