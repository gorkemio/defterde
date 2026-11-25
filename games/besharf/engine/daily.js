// engine/daily.js — günlük eşleme: Türkiye saatiyle (Europe/Istanbul) takvim günü, gün numarası, günün cevabı, geri sayım.
// Gün n'nin cevabı cevaplar[n mod N]; n yayın gününden (No. 1) bu yana geçen gün. DOM'a dokunmaz.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('../kit/tr.js') : window.Kit.tr;
  const C = node ? require('../config.js') : window.BH.config;

  const SAAT_DILIMI = C.saatDilimi || 'Europe/Istanbul';
  const GUN_MS = 86400000;
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  let bicim = null;
  function parcalar(d) {
    bicim = bicim || new Intl.DateTimeFormat('en-GB', { timeZone: SAAT_DILIMI, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const p = {};
    for (const x of bicim.formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value);
    if (p.hour === 24) p.hour = 0;
    return p;
  }

  const iki = (n) => String(n).padStart(2, '0');

  // İstanbul'da o anın takvim günü: 'YYYY-MM-DD'
  function istanbulTarih(d = new Date()) {
    const p = parcalar(d);
    return `${p.year}-${iki(p.month)}-${iki(p.day)}`;
  }

  const gunSayisi = (tarih) => { const [y, a, g] = tarih.split('-').map(Number); return Math.round(Date.UTC(y, a - 1, g) / GUN_MS); };

  // Yayın gününden bu yana geçen gün (yayın günü 0); yayından önceki tarih 0'a sabitlenir
  const gunNo = (tarih, yayinGunu = C.yayinGunu) => Math.max(0, gunSayisi(tarih) - gunSayisi(yayinGunu));

  function gununCevabi(cevaplar, tarih = istanbulTarih(), yayinGunu = C.yayinGunu) {
    const n = gunNo(tarih, yayinGunu);
    return { kelime: cevaplar[n % cevaplar.length], no: n + 1, tarih, indeks: n % cevaplar.length };
  }

  // Bir sonraki İstanbul gece yarısına kalan süre (ms)
  function sonrakiGuneKalanMs(d = new Date()) {
    const p = parcalar(d);
    const gecen = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + (d.getTime() % 1000 + 1000) % 1000;
    return GUN_MS - gecen;
  }

  // 26_544_000 → "07:22:24"
  function geriSayimYazi(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${iki(Math.floor(s / 3600))}:${iki(Math.floor(s / 60) % 60)}:${iki(s % 60)}`;
  }

  // '2026-10-20' → "20 Ekim 2026"
  function tarihYazi(tarih) {
    const [y, a, g] = tarih.split('-').map(Number);
    return `${g} ${AYLAR[a - 1]} ${y}`;
  }

  // '2026-10-20' + n gün → '2026-10-21' (takvim günü; saat dilimi yok)
  function gunEkle(tarih, n) {
    const [y, a, g] = tarih.split('-').map(Number);
    const t = new Date(Date.UTC(y, a - 1, g + n));
    return `${t.getUTCFullYear()}-${iki(t.getUTCMonth() + 1)}-${iki(t.getUTCDate())}`;
  }

  // data/cevaplar.js → dizi (basit kodlu: Kit.tr.kaydir)
  const cozCevaplar = (veri) => tr.kaydir(veri.kodlu, -1).split('\n');

  const D = { SAAT_DILIMI, AYLAR, istanbulTarih, gunNo, gununCevabi, sonrakiGuneKalanMs, geriSayimYazi, tarihYazi, gunEkle, cozCevaplar };
  if (typeof window !== 'undefined') (window.BH = window.BH || {}).daily = D;
  if (node) module.exports = D;
})();
