// scripts/kaynak/cocuk.mjs — "kolay" banda girecek, çocukların bildiği temel kelimeler (elle yazıldı).
// Neden elle: kelime sıklığı kaynağı (OpenSubtitles) yetişkin diyaloğudur; "ilk 5 bin" listesi çocuk dağarcığını değil
// "cinayet", "tahliye", "ihanet" gibi kelimeleri öne çıkarıyordu. Kolay band = bu liste ∩ TDK; 4–7 harfli isim/sıfat/fiil olanlar.
// Listedeki kelime TDK'da yoksa ya da başka bir bant kuralına takılırsa sessizce düşer; rapor.md sayıları yazar.
const kelimeler = (s) => s.split(/\s+/).filter(Boolean);

export const COCUK = kelimeler(`
  anne baba abla ağabey dede nine babaanne anneanne hala amca teyze dayı bebek çocuk kardeş arkadaş komşu misafir kız oğlan
  öğrenci öğretmen doktor hemşire polis asker pilot aşçı garson berber terzi bakkal kasap manav çiftçi balıkçı çoban hasta usta
  sporcu şarkıcı kral kraliçe prens prenses cadı cüce dev peri melek ejderha hayalet robot astronot şövalye korsan palyaço sihirbaz
  baş saç göz kulak burun ağız dudak diş dil çene yanak alın boyun omuz kol dirsek bilek el parmak tırnak göğüs karın sırt bel
  bacak diz ayak topuk kalp kemik deri kan nefes ter
  ev oda kapı pencere masa sandalye koltuk yatak yastık yorgan battaniye çarşaf halı perde lamba dolap ayna saat anahtar kilit çatı
  tavan duvar zemin merdiven balkon bahçe garaj asansör mutfak banyo salon sofra tabak bardak kaşık çatal bıçak fincan tencere
  tava ocak fırın süpürge fırça sabun havlu tarak
  ekmek peynir yumurta süt çorba pilav makarna köfte kebap börek pide simit poğaça pasta kek kurabiye çikolata şeker bal reçel
  yoğurt ayran dondurma bisküvi sakız tuz yağ çay kahve meyve sebze elma armut muz kiraz vişne çilek üzüm incir nar şeftali
  kayısı erik portakal mandalina limon karpuz kavun domates biber patlıcan kabak havuç patates soğan sarımsak ıspanak marul
  lahana bezelye fasulye nohut mercimek mısır pirinç buğday fındık fıstık ceviz badem
  kedi köpek kuş balık eşek inek öküz koyun kuzu keçi oğlak tavuk horoz civciv ördek hindi güvercin kartal baykuş serçe karga
  leylek martı penguen papağan aslan kaplan zürafa zebra kurt tilki tavşan fare sincap kirpi geyik maymun deve domuz yılan
  kurbağa kaplumbağa timsah kertenkele kelebek karınca sinek böcek örümcek salyangoz solucan balina yunus ahtapot yengeç karides
  ağaç çiçek yaprak dal çimen orman dağ tepe vadi ova deniz göl nehir dere şelale ada plaj kum taş kaya toprak güneş yıldız
  gezegen dünya gökyüzü bulut yağmur dolu rüzgâr fırtına şimşek gökkuşağı sis buz ateş duman gölge ışık
  elbise gömlek pantolon etek çorap ayakkabı çizme terlik şapka bere atkı eldiven mont ceket kazak tişört gözlük çanta kemer
  kravat önlük pijama mayo şort yelek
  okul sınıf ders tahta tebeşir kalem defter kitap silgi cetvel oyun oyuncak top balon bisiklet uçurtma salıncak kaydırak
  yapboz kukla resim boya müzik şarkı masal şiir hikâye film sinema tiyatro dans sirk park
  araba otobüs tren uçak gemi tekne kayık motosiklet kamyon taksi helikopter roket yol köprü tünel liman istasyon durak
  kırmızı mavi sarı yeşil mor pembe turuncu siyah beyaz renk daire kare üçgen çizgi nokta şekil
  dört altı yedi sekiz dokuz yirmi otuz elli
  sabah öğle akşam gece gün hafta yıl saat dakika bugün yarın pazar salı cuma bahar yaz sonbahar kış mevsim tatil bayram
  gelmek gitmek almak vermek bakmak görmek okumak yazmak çizmek boyamak oynamak gülmek ağlamak koşmak yürümek uyumak yemek içmek
  yıkamak silmek açmak kapamak atlamak düşmek çalmak söylemek sevmek bilmek duymak kalmak olmak kesmek yapmak çıkmak girmek binmek
  inmek uçmak yüzmek tutmak bulmak aramak beklemek bağırmak öpmek sarılmak paylaşmak toplamak dökmek doldurmak itmek çekmek
  asmak dikmek örmek pişirmek yakmak durmak oturmak kalkmak yatmak uyanmak giymek soymak taramak
  büyük küçük uzun kısa kalın ince geniş dar yüksek alçak derin ağır hafif hızlı yavaş sıcak soğuk ıslak kuru temiz kirli yeni
  eski güzel çirkin tatlı acı ekşi tuzlu mutlu üzgün kızgın korkak cesur akıllı çalışkan tembel sessiz boş dolu açık kapalı doğru
  yanlış kolay zor ucuz pahalı genç yaşlı şişman zayıf güçlü komik sevimli renkli yumuşak sert düz eğri
  hediye düğün parti bayrak harita şehir köy sokak cadde bina market lokanta fabrika müze para cüzdan kutu torba sepet şişe
  kavanoz kova ip iplik iğne makas çekiç testere çivi vida pil radyo telefon kamera
`);
