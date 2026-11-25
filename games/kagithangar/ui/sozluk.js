// Ortak sözlük: aynı yere giden her düğme aynı adı taşır. DOM'suz (node testinde denetlenir).
// Kurallar:
//   geri   — sayfanın sağ üstündeki dönüş: "← küçük harfle yer adı" (ui/sayfa.js ust()).
//   ileri  — döngüde bir sonraki sayfaya götüren iş: "Fiil →" (tek ok, sonda).
//   yan    — sayfada kalan iş: "Fiil", oksuz, büyük harfle başlar.
//   tehlikeli — veri silen ya da geri alınamayan iş: kırmızı mürekkep, satır içi onay ister.
//   Seçim çipleri (filtre, kalem, görünüm) küçük harfle yazılır; bunlar sözlükte değil.
export const SOZLUK = {
  geri: { masa: 'masa', katalog: 'katalog', hangar: 'hangar' },
  ileri: {
    ilkKatla: 'İlk uçağını katla →',
    katla: 'Yeni uçak katla →',
    ucur: 'Uçur →',
    hangaraAs: 'Hangara as →',
    duelloBasla: 'Düelloya başla →',
    devam: 'Devam et →',
    sonuclar: 'Sonuçlar →',
    notGonder: 'Katla ve uçur →',
  },
  yan: {
    adlandir: 'Adlandır ve boya',
    tekrar: 'Tekrar at',
    ayni: 'Aynı atış',
    hizli: 'Hızlı katla',
    geriAl: 'Geri al',
    kapat: 'Kapat',
    vazgec: 'Vazgeç',
    utule: 'Ütüle',
    yazdir: 'Yazdır',
    notla: 'Notla gönder',
    isimOner: 'İsim öner',
    deftereIsle: 'Deftere işle',
    yedekle: 'Hangarı yedekle',
    geriYukle: 'Yedekten geri yükle',
  },
  tehlikeli: {
    emekli: 'Emekli et',
    emekliEvet: 'Evet, emekli et',
    sil: 'Uçağı sil',
    silEvet: 'Evet, sil',
    boyaSil: 'Bütün boyayı sil',
    boyaSilEvet: 'Evet, boyayı sil',
    sifirla: 'Her şeyi sıfırla',
    sifirlaEvet: 'Evet, her şeyi sil',
    duelloBirak: 'Düelloyu bırak',
    hepsiniDegistir: 'Hepsini değiştir',
  },
};
