// kit/bulmaca/gunluk.js — günlük bulmaca: Türkiye saati (Europe/Istanbul), gün numarası, seri, paylaşım metni ve paylaşma.
(function () {
  'use strict';
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  let bicim = null;
  // 'YYYY-MM-DD' (İstanbul)
  function istanbulTarih(an = new Date()) {
    if (!bicim) bicim = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = {};
    for (const x of bicim.formatToParts(an)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  const gunSayisi = (t) => Math.round(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 86400000);
  const gunNo = (tarih, baslangic = '2026-10-19') => gunSayisi(tarih) - gunSayisi(baslangic) + 1;
  const gunEkle = (tarih, n) => new Date((gunSayisi(tarih) + n) * 86400000).toISOString().slice(0, 10);
  // 0 pazar … 6 cumartesi
  const haftaGunu = (tarih) => new Date(gunSayisi(tarih) * 86400000).getUTCDay();
  // Türkiye'de gece yarısına kalan süre (Türkiye 2016'dan beri sabit UTC+3)
  function sonrakiGuneKalanMs(an = new Date()) {
    const t = istanbulTarih(an), gece = (gunSayisi(t) + 1) * 86400000 - 3 * 3600000;
    return gece - an.getTime();
  }
  const tarihYazi = (tarih) => `${+tarih.slice(8, 10)} ${AYLAR[+tarih.slice(5, 7) - 1]}`;
  // Ardışık günler serisi: bugün henüz çözülmediyse dünden geriye sayılır (seri kırılmaz)
  function seri(gunler, bugun) {
    const k = new Set(gunler);
    let g = k.has(bugun) ? bugun : gunEkle(bugun, -1), n = 0;
    while (k.has(g)) { n++; g = gunEkle(g, -1); }
    return n;
  }
  function enUzunSeri(gunler) {
    const s = [...new Set(gunler)].sort();
    let en = 0, n = 0;
    s.forEach((g, i) => { n = i && gunSayisi(g) - gunSayisi(s[i - 1]) === 1 ? n + 1 : 1; en = Math.max(en, n); });
    return en;
  }
  const sureYazi = (ms) => { const s = Math.round(ms / 1000), d = Math.floor(s / 60); return d >= 60 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${d}:${String(s % 60).padStart(2, '0')}`; };
  // ['Kare Karalamaca', '20 Ekim', '15×15', '6:42', 'hatasız'] → 'Kare Karalamaca · 20 Ekim · 15×15 · 6:42 · hatasız'
  const paylasimMetni = (parcalar) => parcalar.filter(Boolean).join(' · ');
  // navigator.share → pano → görünür metin kutusu ('metin' döner; çağıran gösterir)
  async function paylas(metin, o = {}) {
    try { if (typeof navigator !== 'undefined' && navigator.share && o.paylas !== false) { await navigator.share({ text: metin }); return 'share'; } } catch (e) { if (e && e.name === 'AbortError') return 'iptal'; }
    try { if (typeof navigator !== 'undefined' && navigator.clipboard && (typeof isSecureContext === 'undefined' || isSecureContext)) { await navigator.clipboard.writeText(metin); return 'pano'; } } catch (e) { /* düş */ }
    return 'metin';
  }
  const api = { istanbulTarih, gunNo, gunEkle, haftaGunu, sonrakiGuneKalanMs, tarihYazi, seri, enUzunSeri, sureYazi, paylasimMetni, paylas, AYLAR, GUNLER };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).gunluk = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
