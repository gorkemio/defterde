// modlar.js — Okul, Günün kelimesi ve Maraton'un DOM'suz yardımcıları (girdi doğrulama, günlük kayıt, özet). DOM'a dokunmaz.
// Tarayıcıda AA.modlar, node'da module.exports.
(function () {
  'use strict';

  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('./tr.js') : window.AA.tr;
  const G = node ? require('./game.js') : window.AA.game;
  const S = node ? require('./secici.js') : window.AA.secici;
  const C = node ? require('./config.js') : window.AA.config;

  const M = {};

  /* ---------- Okul modu: gizli kelime girişi ---------- */

  // Sözlük kontrolü için: kelime → { anlam, kategori }. Önce sözlük, sonra kategori listeleri (şehir, ülke gibi özel adlar).
  M.sozlukIndeksi = function (veri) {
    const m = new Map();
    for (const [kelime, anlam] of veri.sozluk) m.set(kelime, { anlam, kategori: null });
    for (const [ad, satirlar] of Object.entries(veri.kategoriler)) {
      for (const [kelime, anlam] of satirlar) if (!m.has(kelime)) m.set(kelime, { anlam, kategori: ad });
    }
    for (const [soz, anlam] of veri.atasozleri) m.set(soz, { anlam, kategori: 'Atasözleri' });
    return m;
  };

  // metin: arkadaşın yazdığı ham metin. kontrol: true ise sözlükte (ya da kategori/atasözü listesinde) bulunmalı.
  // Döner: { ok: true, kelime, anlam|null } ya da { ok: false, hata }
  M.okulGirdisi = function (metin, { kontrol = false, indeks = null } = {}) {
    const ham = String(metin ?? '').trim();
    if (!ham) return { ok: false, hata: 'Bir kelime ya da söz yaz.' };
    const n = tr.normalize(ham);
    const harfler = Array.from(n);
    if (harfler.some((c) => /[QWX]/.test(c))) return { ok: false, hata: 'Q, W ve X harfleri bu oyunda yok.' };
    if (harfler.some((c) => c !== ' ' && !tr.ALFABE.includes(c))) return { ok: false, hata: 'Yalnız harf yazabilirsin: rakam ve noktalama olmaz.' };
    const sozcukler = n.split(' ');
    if (sozcukler.length > C.okul.enCokSozcuk) return { ok: false, hata: `En çok ${C.okul.enCokSozcuk} sözcük yazabilirsin.` };
    if (sozcukler.length === 1) {
      if (harfler.length < 3) return { ok: false, hata: 'En az 3 harf olmalı.' };
      if (harfler.length > 14) return { ok: false, hata: 'En çok 14 harf olabilir. Uzun söz için birkaç sözcük yaz.' };
    } else if (!tr.gecerliSoz(n)) {
      return { ok: false, hata: 'Boşluklarla birlikte en çok 45 karakter olabilir.' };
    }
    const bilgi = indeks ? indeks.get(n) : null;
    if (kontrol && !bilgi) return { ok: false, hata: 'Sözlükte bulamadım. Kelimeyi kontrol et ya da sözlük kontrolünü kapat.' };
    return { ok: true, kelime: n, anlam: bilgi ? bilgi.anlam : null, kategori: bilgi ? bilgi.kategori : null };
  };

  /* ---------- Günün kelimesi ---------- */

  // Bugünün kelimesi: { kelime, no, tarih, anlam, kategori, hak }
  M.gunlukBilgi = function (veri, tarih) {
    const g = S.gununAdayi(veri, tarih);
    return { ...g, hak: C.gunlukHak };
  };

  // Kaydedilmiş adımlardan oyunu yeniden kurar. adimlar: ['t', 'A'] (tahmin) · ['h', 'E'] (açılan harf) · ['a'] (anlam)
  M.gunlukOyna = function (bilgi, adimlar) {
    let d = G.yeniOyun({ kelime: bilgi.kelime, zorluk: 'orta', mod: 'gunun', kategori: bilgi.kategori, hak: bilgi.hak });
    for (const [tur, harf] of adimlar || []) {
      if (d.bitti) break;
      if (tur === 't') d = G.tahmin(d, harf);
      else if (tur === 'h') d = G.harfAc(d, Math.random, { harf, konumlar: tr.konumlar(d.hedef, harf) });
      else if (tur === 'a') d = G.anlamGoster(d);
    }
    return d;
  };

  // Günlük kayıt: { tarih, adimlar: [...], sonuc: null | 'kurtuldu' | 'asildi', cizgi, hak, no, kategori }
  M.gunlukKayitYeni = (bilgi) => ({ tarih: bilgi.tarih, no: bilgi.no, kategori: bilgi.kategori, hak: bilgi.hak, adimlar: [], sonuc: null, cizgi: 0 });
  M.gunlukKayitIsle = function (kayit, adim, d) {
    return { ...kayit, adimlar: [...kayit.adimlar, adim], sonuc: d.bitti ? d.sonuc : null, cizgi: G.kullanilanCizgi(d) };
  };
  M.gunlukPaylasim = (k) => G.paylasimMetni({ no: k.no, kategori: k.kategori, cizgi: k.cizgi, hak: k.hak, sonuc: k.sonuc });

  /* ---------- Maraton ---------- */

  // n: bu oyunun sırası (1'den). kurtarilan: bu oyundan ÖNCE kurtarılan kelime sayısı (= n − 1).
  M.maratonOzet = function (kurtarilan, enIyi) {
    const rekor = kurtarilan > enIyi;
    return { kurtarilan, enIyi: Math.max(kurtarilan, enIyi), rekor, metin: rekor && kurtarilan > 0 ? 'Yeni rekor!' : '' };
  };

  if (typeof window !== 'undefined') (window.AA = window.AA || {}).modlar = M;
  if (node) module.exports = M;
})();
