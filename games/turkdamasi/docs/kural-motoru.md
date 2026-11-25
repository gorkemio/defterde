# Kural motoru sözleşmesi

`board.js` klasik script olarak `globalThis.TD.board` sunar. DOM, ağ, depolama,
görsel taş kimliği ve saat/animasyon durumu içermez. `a1=0`, `h8=63`;
`+1/+2` mavi normal/dama, `-1/-2` kırmızı normal/dama, `0` boş.

## Konum ve hamle

- `position(cells, turn)` / `initialPosition()`: değiştirilemez `{ cells, turn }`.
- `positionKey(position)`: 64 hücre ve sırayı kapsar; dama niteliği ayrıdır.
- Tam hamle: `{ from, landings, captures: [{square, piece}], promotion }`.
  Listeler ve iç kayıtlar değiştirilemez. Bir zincir bir tam turdur.
- `generateMoves(position)`: ilerletilebilir iterator. Ara adımları `undefined`;
  **yalnız `done:true` değerinde** global maksimuma uyan bütün hamleler bulunur.
- `legalMoves(position)`: aynı üreticinin senkron, tam sonuç veren kolaylık yordamı.
  Küçük test/konumlar içindir; etkileşimli arayüz ağır konumlarda bunu kullanmaz.
- `collectMoves(position, {signal, sliceMs, yieldTask, now})`: zaman dilimlerinde
  tamamlar; `{moves, stats}` döner. İptalde `AbortError`; kısmi liste döndürmez.
  Varsayılan dilim 8 ms. `yieldTask` görev kuyruğuna döner; `now` monoton saattir.

## Seçim ve uygulama

- `continuations(legal, from, prefix)`: `{matches, next, complete}`.
  Başlangıç ve sıralı iniş önekiyle filtreler; kuralları yeniden tahmin etmez.
- `preview(position, legal, from, prefix)`: alınan taşları çıkarılmış ara konum;
  sıra değişmez, terfi uygulanmaz, tekrar/geçmişe dokunmaz. Yarım zinciri iptal
  etmek, başlangıç konumunu yeniden göstermekten ibarettir.
- `applyMove(position, move, legal?)`: yalnız tam ve yasal hamleyi uygulayan yeni
  konum. Sağlanan liste motorun **o konum için tamamladığı** liste olmalıdır;
  kopya, filtrelenmiş veya eski liste reddedilir. Liste verilmezse tamamı üretilir.
  Hamlenin alma metadatası da doğrulanır; çağıranın uydurduğu taşlar kaldırılmaz.

## Oyun ve sonuç

- `createGame(position?, legal?)`: başlangıcı bir kez sayan değiştirilemez
  `{position, repetitions, history, result}`.
- `outcome(position, repetitions, legal?)`: `null` veya `{winner, reason}`.
  Kazanan `1/-1`, beraberlik `0`. Öncelik: taşı kalmama, hamlesizlik, birer taş,
  üçüncü aynı konum. Sebepler: `no-pieces`, `blocked`, `one-each`, `repetition`.
- `play(game, move, {legal, nextLegal}?)`: tam tur, sıra, terfi, tekrar ve sonucu
  birlikte kaydeder. Gerekirse önce `applyMove` ile yeni konum bulunup bunun
  `nextLegal` listesi asenkron hazırlanabilir; sonuç hesabında yeniden arama gerekmez.
- `undo(game, count=1)`: en çok istenen sayıda **tam tur** geri döner.
  Anlık görüntüler önceki konumu, tekrarları ve sonucu birlikte geri getirir.
  Görsel kimliklerin ve yarım zincir seçiminin saklanması Faz 3 UI katmanındadır.
- `agreeDraw(game)`: UI'ın karşı tarafça kabul edildiğini doğruladığı anlaşmayı
  kaydeder. Sonuç sebebi `agreement`; teklif etme/kabul kararı motorun görevi değildir.
- `repetitionContext(repetitions)`: sıralı, deterministik geçmiş anahtarı.
  Gelecek AI aynı tahta için farklı tekrar geçmişlerini ayırt etmekte kullanır.

Geçersiz konum/argüman `TypeError`, yasadışı hamle veya bitmiş oyun `RangeError`
üretir. Girdi durumları değişmez. Üretim iptali oyun durumunu değiştiremez.
