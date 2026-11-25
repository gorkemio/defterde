// Akış kararları: masa hangi durumda, "Uçur" nereye gider, hangi defter sekmesi seçili. DOM'suz.
import { SAHNE_IDLERI } from './sahneler.js';

// Uçağın son kullanıldığı an: son uçuşu, yoksa katlandığı gün.
const sonAn = (u) => {
  const g = u.gunluk && u.gunluk.length ? u.gunluk[u.gunluk.length - 1].tarih : null;
  return Date.parse(g || u.tarih) || 0;
};

export const gecerliSahne = (id) => (SAHNE_IDLERI.includes(id) ? id : 'sinif');

// Masanın iki hâli: yeni (uçuşa hazır uçak yok) ya da dönen (son uçağıyla hemen uçabilir).
export function masaDurumu(ucaklar, ayarlar = {}) {
  const aktif = ucaklar.filter(u => !u.emekli);
  const sonUcak = aktif.reduce((a, u) => (!a || sonAn(u) >= sonAn(a) ? u : a), null);
  return { yeni: !aktif.length, sonUcak, sonSahne: gecerliSahne(ayarlar.sonSahne), aktif };
}

// "Uçur" her yerden son uçulan mekâna götürür (günün uçuşu kendi bağlantısıyla gelir, hatırlanmaz).
export function ucusRotasi(ucakId, ayarlar = {}) {
  return `#/uc/${ucakId}/${gecerliSahne(ayarlar.sonSahne)}`;
}

// Rota → defter sekmesi (masa, katla, hangar, pilot); sekmesi olmayan sayfalar null.
const SEKMELER = {
  masa: 'masa', katalog: 'katla', atolye: 'katla',
  hangar: 'hangar', adlandir: 'hangar', yazdir: 'hangar', notla: 'hangar',
  pilot: 'pilot',
};
export const sekmeIcin = (rotaAd) => SEKMELER[rotaAd] || null;
