// ui/gunluk.js — Günün karalaması: herkese aynı bulmaca, gün değişimi Türkiye saatiyle. Boy haftanın gününe göre
// (pazartesi 10×10 … pazar 25×25, cumartesi kilim). Resim albüm havuzundan; adı bitişe kadar gizli; Klasik mod.
// Paylaşım metni resmi ele vermez; resmin kendisi ertesi gün paylaşılabilir.
(function () {
  'use strict';
  const KK = window.KK;
  const G = Kit.bulmaca.gunluk;
  const depo = () => KK.oyun.depo;

  const bugun = () => G.istanbulTarih();
  function boyu(tarih) { return KK.config.gunluk.takvim[G.haftaGunu(tarih)]; }
  function havuz(en, boy) { return KK.resimler.yukle().tum.filter(r => r.en === en && r.boy === boy).sort((a, b) => a.id.localeCompare(b.id)); }

  // Tarihten resim: boy havuzu tohumla karıştırılır (her tur farklı sıra), sıradaki alınır
  function resim(tarih) {
    const b = boyu(tarih), no = G.gunNo(tarih, KK.config.gunluk.baslangic);
    if (b === 'kilim') {
      const tohum = Kit.kalem.karma('gunun-kilimi', tarih) % 1e9;
      const r = KK.kilim.resim(tohum, { boy: 15, hedefBant: 'orta' });
      return Object.assign(r, { id: 'gun-' + tarih, gunluk: tarih });
    }
    let [en, boy] = b, h = havuz(en, boy);
    if (h.length < 4) { const y = KK.config.gunluk.yedek[`${en}x${boy}`] || [10, 10]; h = havuz(...y); }
    if (!h.length) h = KK.resimler.yukle().tum.slice();
    const n = h.length, tur = Math.floor((no - 1) / n), r = Kit.kalem.rastgele('gunluk-sira', tur);
    const sira = h.map((x, i) => [r(), i]).sort((a, c) => a[0] - c[0]).map(x => h[x[1]]);
    const sec = sira[((no - 1) % n + n) % n];
    return Object.assign({}, sec, { id: 'gun-' + tarih, albumId: sec.id, gunluk: tarih });
  }

  function ac(tarih = bugun()) { KK.oyun.ac(resim(tarih), { mod: 'klasik' }); }
  function kaydet(r, k) { depo().yaz('gun-' + r.gunluk, { id: r.albumId || r.id, sure: k.sure, hata: k.hata, ipucu: k.ipucu }); }
  const sonuc = (tarih) => depo().oku('gun-' + tarih, null);
  const cozulenGunler = () => depo().anahtarlar('gun-').filter(k => /^gun-\d{4}-\d\d-\d\d$/.test(k)).map(k => k.slice(4));
  const seri = () => G.seri(cozulenGunler(), bugun());
  function istatistik() { const g = cozulenGunler(); return { cozulen: g.length, seri: G.seri(g, bugun()), enUzun: G.enUzunSeri(g) }; }

  function boyYazi(tarih) { const b = boyu(tarih); return b === 'kilim' ? 'kilim 15×15' : `${b[0]}×${b[1]}`; }
  function ozet() {
    const t = bugun(), s = sonuc(t), gun = G.GUNLER[G.haftaGunu(t)];
    let d = `${G.tarihYazi(t)} · ${gun} · ${boyYazi(t)}`;
    if (s) d += ` · çözüldü ${G.sureYazi(s.sure)}`;
    else if (KK.oyun.yarimMi('gun-' + t)) d += ' · yarım';
    const dun = sonuc(G.gunEkle(t, -1));
    if (dun) d += ' · dünkü resim paylaşılabilir';
    return d + ` · seri ${seri()}`;
  }
  function paylasimMetni(r, k) {
    const b = boyu(r.gunluk);
    return G.paylasimMetni(['Kare Karalamaca', G.tarihYazi(r.gunluk), b === 'kilim' ? 'kilim 15×15' : `${b[0]}×${b[1]}`, G.sureYazi(k.sure), k.hata || k.ipucu ? [k.hata ? `${k.hata} hata` : '', k.ipucu ? `${k.ipucu} ipucu` : ''].filter(Boolean).join(', ') : 'hatasız']);
  }

  // Dünün resmi (ertesi gün paylaşılabilir): renkli PNG
  async function dunuPaylas() {
    const t = G.gunEkle(bugun(), -1);
    if (!sonuc(t)) return false;
    const r = resim(t), k = 16, cv = document.createElement('canvas');
    cv.width = r.en * k + 32; cv.height = r.boy * k + 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#fbf9f2'; c.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < r.en * r.boy; i++) {
      const x = 16 + (i % r.en) * k, y = 16 + ((i / r.en) | 0) * k, h = r.renk[i] || r.zemin[i];
      if (h) { c.globalAlpha = r.renk[i] ? .9 : .35; c.fillStyle = h; c.fillRect(x, y, k, k); }
    }
    c.globalAlpha = 1; c.fillStyle = '#4a4a4a'; c.font = '18px "Architects Daughter", cursive';
    c.fillText(`${r.ad} · ${G.tarihYazi(t)}`, 16, cv.height - 18);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const dosya = new File([blob], `kare-karalamaca-${t}.png`, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [dosya] })) { await navigator.share({ files: [dosya], text: `Kare Karalamaca · ${G.tarihYazi(t)} · ${r.ad}` }); return true; } } catch (e) { if (e.name === 'AbortError') return true; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dosya.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  }

  KK.gunluk = { bugun, boyu, resim, ac, kaydet, sonuc, seri, istatistik, ozet, paylasimMetni, dunuPaylas, havuz };
})();
