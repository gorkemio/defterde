// Pilot kartı: hangardaki bütün uçaklardan rütbe, puan ve rozetler; uçuşun istatistiğe işlenmesi ve rekorlar. DOM'suz.
import { SAHNELER, SAHNE_IDLERI } from './sahneler.js';
export const ROZETLER = [
  { id: 'ilk-ucus', ad: 'İlk Uçuş', aciklama: 'Bir uçağı ilk kez fırlattın.', kosul: (o) => o.toplamUcus >= 1 },
  { id: 'uzun-yol', ad: 'Uzun Yol', aciklama: '10 metreyi geçtin.', kosul: (o) => o.enUzak >= 10 },
  { id: 'pencere', ad: 'Pencere Kaçağı', aciklama: 'Bir uçağın pencereden kaçtı.', kosul: (o) => o.pencere >= 1 },
  { id: 'takla', ad: 'Takla Ustası', aciklama: 'Tek uçuşta iki takla.', kosul: (o) => o.enCokTakla >= 2 },
  { id: 'usta-el', ad: 'Usta El', aciklama: 'Elle %95 kaliteyle katladın.', kosul: (o) => o.enIyiElle >= 95 },
  { id: 'koleksiyon', ad: 'Koleksiyoncu', aciklama: 'Altı tasarımın hepsini katladın.', kosul: (o) => o.tasarimSayisi >= 6 },
  { id: 'utucu', ad: 'Ütücü', aciklama: 'Kırışık bir uçağı ütüledin.', kosul: (o) => o.utu >= 1 },
  { id: 'muzeci', ad: 'Müzeci', aciklama: 'Bir uçağı emekli ettin.', kosul: (o) => o.emekli >= 1 },
  { id: 'postaci', ad: 'Postacı', aciklama: 'Bir uçakla not aldın.', kosul: (o) => o.gelenNot >= 1 },
  { id: 'ikiz', ad: 'Dijital İkiz', aciklama: 'Gerçek bir atışı deftere işledin.', kosul: (o) => o.gercekAtis >= 1 },
  { id: 'koridor', ad: 'Koridor Koşucusu', aciklama: 'Koridorda 20 metreyi geçtin.', kosul: (o) => o.koridorEnUzak >= 20 },
  { id: 'merdiven', ad: 'Süzülme Ustası', aciklama: 'Merdiven boşluğunda 5 saniye havada kaldın.', kosul: (o) => o.merdivenEnUzun >= 5 },
  { id: 'ruzgar', ad: 'Rüzgâr Binicisi', aciklama: 'Balkonda ya da parkta 30 metreyi geçtin.', kosul: (o) => o.acikEnUzak >= 30 },
  { id: 'gunun', ad: 'Günün Pilotu', aciklama: 'Günün uçuşunda hedefi geçtin.', kosul: (o) => o.gununBasarili },
  { id: 'duello', ad: 'Düellocu', aciklama: 'Bir düelloyu sonuna kadar oynadın.', kosul: (o) => o.duello >= 1 },
];
export const RUTBELER = [[0, 'Çaylak'], [20, 'Kanat Adayı'], [60, 'Pilot'], [150, 'Kaptan'], [300, 'As Pilot'], [500, 'Gökyüzü Efsanesi']];

export function ozet(ucaklar, ayarlar = {}) {
  const o = {
    koridorEnUzak: 0, merdivenEnUzun: 0, acikEnUzak: 0,
    gununBasarili: !!(ayarlar.gunun && ayarlar.gunun.basarili) || (ayarlar.gununBasari || 0) > 0, duello: (ayarlar.duello && ayarlar.duello.oynanan) || 0,
    ucak: ucaklar.length, toplamUcus: 0, enUzak: 0, enUzakUcak: '', enCokTakla: 0, pencere: 0,
    enIyiElle: 0, tasarimSayisi: new Set(ucaklar.map(u => u.tasarim)).size, utu: 0, emekli: 0, gelenNot: 0, gercekAtis: 0, gercekEnUzak: 0,
  };
  for (const u of ucaklar) {
    const i = u.istatistik || {};
    o.toplamUcus += i.ucus || 0;
    if ((i.enUzak || 0) > o.enUzak) { o.enUzak = i.enUzak; o.enUzakUcak = u.ad || 'İsimsiz'; }
    o.enCokTakla = Math.max(o.enCokTakla, i.loop || 0);
    o.pencere += i.pencere || 0;
    if (u.mod === 'elle') o.enIyiElle = Math.max(o.enIyiElle, u.kalite || 0);
    o.utu += (u.yipranma && u.yipranma.utu) || 0;
    o.emekli += u.emekli ? 1 : 0;
    o.gelenNot += u.not ? 1 : 0;
    o.gercekAtis += (u.gercek || []).length;
    o.gercekEnUzak = Math.max(o.gercekEnUzak, ...(u.gercek || []).map(g => g.mesafe));
    const sh = i.sahneler || {};
    o.koridorEnUzak = Math.max(o.koridorEnUzak, (sh.koridor && sh.koridor.enUzak) || 0);
    o.merdivenEnUzun = Math.max(o.merdivenEnUzun, (sh.merdiven && sh.merdiven.enUzun) || 0);
    o.acikEnUzak = Math.max(o.acikEnUzak, (sh.balkon && sh.balkon.enUzak) || 0, (sh.park && sh.park.enUzak) || 0);
  }
  return o;
}

export function pilotKarti(ucaklar, ayarlar = {}) {
  const o = ozet(ucaklar, ayarlar);
  const rozetler = ROZETLER.map(r => ({ id: r.id, ad: r.ad, aciklama: r.aciklama, kazanildi: !!r.kosul(o) }));
  const kazanilan = rozetler.filter(r => r.kazanildi).length;
  const puan = o.ucak * 5 + o.toplamUcus * 2 + kazanilan * 15 + Math.floor(o.enUzak);
  let i = 0;
  while (i + 1 < RUTBELER.length && puan >= RUTBELER[i + 1][0]) i++;
  return {
    ozet: o, puan, rozetler, rutbe: RUTBELER[i][1],
    sonraki: RUTBELER[i + 1] ? { ad: RUTBELER[i + 1][1], kalan: RUTBELER[i + 1][0] - puan } : null,
  };
}

// Bir uçuştan önceki ve sonraki kart: yeni rozetler, rütbe atlaması, kazanılan puan (fişte kutlanır).
export function rozetFarki(once, sonra) {
  const vardi = new Set(once.rozetler.filter(r => r.kazanildi).map(r => r.id));
  return {
    yeniRozetler: sonra.rozetler.filter(r => r.kazanildi && !vardi.has(r.id)).map(({ id, ad, aciklama }) => ({ id, ad, aciklama })),
    rutbe: once.rutbe !== sonra.rutbe ? { once: once.rutbe, sonra: sonra.rutbe } : null,
    puan: sonra.puan - once.puan,
  };
}

// Uçuşu uçağın istatistiğine işler. Sınıfın rekorları klasik alanlarda (enUzak, enUzun, enYuksek), öbür mekânlar
// sahneler[id]'de. u: { mesafe, sure, enYuksek, loop, duvar (çarpma sayısı), pencere (bool) }, mesafe yuvarlanmış.
// Dönüş: yeni istatistik; bu mekânda ilk uçuş mu; rekor mu; önceki en iyi (ilk uçuşta null).
export function ucusIsle(istatistik, gunluk, u, sahneId) {
  const ist = { ...istatistik, sahneler: { ...(istatistik.sahneler || {}) } };
  let ilk, oncekiEnIyi;
  if (sahneId === 'sinif') {
    ilk = !(gunluk || []).some(g => !g.sahne || g.sahne === 'sinif');
    oncekiEnIyi = ilk ? null : ist.enUzak;
    ist.enUzak = Math.max(ist.enUzak, u.mesafe);
    ist.enUzun = Math.max(ist.enUzun, u.sure);
    ist.enYuksek = Math.max(ist.enYuksek, u.enYuksek);
  } else {
    const r = ist.sahneler[sahneId] || { ucus: 0, enUzak: 0, enUzun: 0 };
    ilk = r.ucus === 0;
    oncekiEnIyi = ilk ? null : r.enUzak;
    ist.sahneler[sahneId] = { ucus: r.ucus + 1, enUzak: Math.max(r.enUzak, u.mesafe), enUzun: Math.max(r.enUzun, u.sure) };
  }
  ist.ucus += 1;
  ist.loop = Math.max(ist.loop, u.loop);
  ist.duvar += u.duvar || 0;
  ist.pencere += u.pencere ? 1 : 0;
  const rekor = !ilk && u.mesafe > oncekiEnIyi + 1e-9;
  return { istatistik: ist, ilk, rekor, oncekiEnIyi };
}

// Uçağın uçtuğu mekânlardaki rekorları (mekân sırasıyla): uçak kartında gösterilir.
export function sahneRekorlari(ucak) {
  const i = ucak.istatistik || {}, sh = i.sahneler || {};
  const sinifUcus = (ucak.gunluk || []).filter(g => !g.sahne || g.sahne === 'sinif').length;
  return SAHNE_IDLERI.map(id => (id === 'sinif'
    ? { sahne: id, ad: SAHNELER[id].ad, ucus: sinifUcus, enUzak: i.enUzak || 0, enUzun: i.enUzun || 0 }
    : { sahne: id, ad: SAHNELER[id].ad, ucus: (sh[id] && sh[id].ucus) || 0, enUzak: (sh[id] && sh[id].enUzak) || 0, enUzun: (sh[id] && sh[id].enUzun) || 0 }))
    .filter(r => r.ucus > 0 || r.enUzak > 0);
}

// Hangarın bu mekândaki rekoru (emekliler dahil): { mesafe, ucakId, ucakAd } ya da null.
export function sahneRekoru(ucaklar, sahneId) {
  let en = null;
  for (const u of ucaklar) {
    const r = sahneRekorlari(u).find(x => x.sahne === sahneId);
    if (r && r.enUzak > 0 && (!en || r.enUzak > en.mesafe)) en = { mesafe: r.enUzak, ucakId: u.id, ucakAd: u.ad || 'İsimsiz' };
  }
  return en;
}
