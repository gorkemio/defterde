// ui/havuz.js — data/havuz paketlerini script etiketiyle tembel yükler (file:// altında da çalışır), puana göre seçer,
// son 500 oynananı dışlar, havuzda uygun bulmaca kalmazsa tarayıcı üreticisine düşer; kitaplar ve günün bulmacası.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const Mo = KB.model, D = KB.difficulty, Ra = KB.rating, G = KB.generator, C = KB.config;
  const bekleyen = {};
  const kategoriOnbellek = {};

  function yukle(ad) {
    window.KB_HAVUZ = window.KB_HAVUZ || {};
    if (window.KB_HAVUZ[ad]) return Promise.resolve(window.KB_HAVUZ[ad]);
    if (bekleyen[ad]) return bekleyen[ad];
    bekleyen[ad] = new Promise((res, rej) => {
      const s = document.createElement('script');
      const m = window.KB_HAVUZ_META || {};
      const u = m.surum || m.uretim || '';
      s.src = `data/havuz/${ad}.js?u=${u}`;
      s.onload = () => (window.KB_HAVUZ[ad] ? res(window.KB_HAVUZ[ad]) : rej(new Error('paket boş: ' + ad)));
      s.onerror = () => { delete bekleyen[ad]; rej(new Error('paket yüklenemedi: ' + ad)); };
      document.head.appendChild(s);
    });
    return bekleyen[ad];
  }

  const noOf = (kimlik) => 1000 + (Mo.karma('no', kimlik) % 9000);
  function kayitYap(p, x) {
    const sablon = p.sablonlar[x[0]], hex = x[1];
    const kimlik = sablon + ':' + hex;
    return { kimlik, sablon, hex, puan: x[2], etiket: x[3], kategori: p.kategori, bant: p.bant, no: noOf(kimlik), durum() { return Mo.maskeOku(sablon, hex); } };
  }
  async function kategori(kat) {
    if (kategoriOnbellek[kat]) return kategoriOnbellek[kat];
    const paketler = await Promise.all(D.BANTLAR.map(b => yukle(`${kat}-${b}`).catch(() => null)));
    const l = [];
    for (const p of paketler) if (p) for (const x of p.kayitlar) l.push(kayitYap(p, x));
    l.sort((a, b) => a.puan - b.puan || (a.kimlik < b.kimlik ? -1 : 1));
    kategoriOnbellek[kat] = l;
    return l;
  }

  // Üretici çıktısını kayda çevir
  function uretilmis(u) {
    const kimlik = Mo.kanonikDize(u.durum);
    const sablon = u.durum.sablon.id, hex = Mo.maske(u.durum);
    return { kimlik, sablon, hex, puan: u.zorluk.puan, etiket: u.zorluk.etiket, kategori: u.kategori, bant: u.zorluk.bant, no: noOf(kimlik), uretildi: true, durum() { return Mo.maskeOku(sablon, hex); } };
  }

  // Seçim: hedef puana göre, ekrana sığan şablonlardan, geçmiş dışında. o: { kategori, hedef, r, dislanan, sigarMi }
  async function sec(o) {
    const sigar = o.sigarMi || KB.sahne.sigar;
    const dislanan = o.dislanan || KB.depo.gecmisKume();
    let liste = [];
    try { liste = (await kategori(o.kategori)).filter(x => sigar(x.sablon)); } catch (e) { liste = []; }
    let k = Ra.sec(liste, o.hedef, dislanan, o.r || Math.random, Ra.aralik(0));
    if (k) return k;
    if (!o.sigarMi && !o.gevsek) {
      // ekrana hiçbir şablon sığmıyorsa en dar şablonlar (çöpler biraz küçülür)
      const tum = await kategori(o.kategori).catch(() => []);
      const enDar = Math.min(...tum.map(x => Mo.genislikL(x.sablon)));
      k = Ra.sec(tum.filter(x => Mo.genislikL(x.sablon) <= Math.max(enDar, KB.sahne.enCokGenislik()) + 1e-9), o.hedef, dislanan, o.r || Math.random, Ra.aralik(0));
      if (k) return k;
    }
    // havuzda uygun kalmadı: tarayıcı üreticisi
    const hedefBant = liste.length ? null : null;
    void hedefBant;
    const sablonlar = (o.kategori === 'romen' ? Mo.SABLONLAR_ROMEN : Mo.SABLONLAR).filter(sigar);
    for (let t = 0; t < 8; t++) {
      const u = G.uret([o.tohum || Date.now(), t].join('|'), { kategori: o.kategori, band: bantTahmini(o.kategori, o.hedef), sablonlar });
      if (u && !dislanan.has(Mo.kanonikDize(u.durum))) return uretilmis(u);
    }
    return null;
  }
  function bantTahmini(kat, puan) { return D.bantOf(kat, puan); }

  // Günün bulmacası: tek-orta paketinden, ≤ 6 hücreli şablonlar (her ekranda aynı), tarihle
  async function gunun(tarih) {
    try {
      const p = await yukle(`${C.gunun.kategori}-${C.gunun.bant}`);
      const l = p.kayitlar.map(x => kayitYap(p, x)).filter(x => Mo.sablon(x.sablon).hucreSayisi <= C.gunun.enCokHucre);
      if (!l.length) throw new Error('boş');
      const k = l[Mo.karma('gun', tarih) % l.length];
      return Object.assign(k, { no: gunNo(tarih) });
    } catch (e) {
      const u = G.uret(['gun', tarih].join('|'), { kategori: 'tek', band: 'orta', enCokHucre: C.gunun.enCokHucre });
      return Object.assign(uretilmis(u), { no: gunNo(tarih) });
    }
  }
  function gunNo(tarih) {
    const a = new Date(C.gunun.baslangic + 'T12:00:00'), b = new Date(tarih + 'T12:00:00');
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  // Kitaplar: kategori kayıtları → 100'lük kitaplar (her kitap kolaydan zora)
  async function kitaplar(kat) { return Ra.kitapDagit(await kategori(kat), C.kitapBoyu); }

  KB.havuz = { yukle, kategori, sec, gunun, gunNo, kitaplar, kayitYap, uretilmis, noOf };
})();
