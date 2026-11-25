// Uçak isim önerici: hazır favoriler + sıfat × ad birleşimleri (bazen sayıyla).
export const HAZIR = ['Mavi Şimşek', 'Kartal 7', 'Pencere Kırıcı', 'Sessiz Martı', 'Tebeşir Tozu', 'Teneffüs Zili',
  'Son Sıra', 'Kırmızı Baron', 'Uykucu', 'Kâğıt Kaplan', 'Defter Yaprağı', 'Gölge'];
export const SIFATLAR = ['Mavi', 'Sessiz', 'Çılgın', 'Hızlı', 'Uykucu', 'Asi', 'Kırmızı', 'Gümüş', 'Yorgun', 'Cesur',
  'Utangaç', 'Gece', 'Fırtına', 'Kayıp', 'Paslı', 'Neşeli'];
export const ADLAR = ['Şimşek', 'Martı', 'Kartal', 'Ok', 'Serçe', 'Roket', 'Baykuş', 'Kırlangıç', 'Fırtına', 'Yıldız',
  'Kuyruklu', 'Pilot', 'Kanat', 'Bulut', 'Sinek', 'Ejderha'];

// rastgele: () => [0, 1). Testlerde tohumlu verilebilir.
export function isimOner(rastgele = Math.random) {
  const sec = (l) => l[Math.floor(rastgele() * l.length)];
  if (rastgele() < 0.3) return sec(HAZIR);
  const ad = `${sec(SIFATLAR)} ${sec(ADLAR)}`;
  return rastgele() < 0.25 ? `${ad} ${1 + Math.floor(rastgele() * 9)}` : ad;
}

// Hangarda olmayan bir isim (büyük/küçük harf duyarsız). Havuz dolarsa sona sayı eklenir.
export function isimOnerEssiz(kullanilan = [], rastgele = Math.random) {
  const var_ = new Set(kullanilan.filter(Boolean).map(a => a.toLocaleLowerCase('tr')));
  const bos = (a) => !var_.has(a.toLocaleLowerCase('tr'));
  let ad = isimOner(rastgele);
  for (let i = 0; i < 12 && !bos(ad); i++) ad = isimOner(rastgele);
  for (let n = 2; !bos(ad); n++) ad = `${ad.replace(/ \d+$/, '')} ${n}`;
  return ad;
}
