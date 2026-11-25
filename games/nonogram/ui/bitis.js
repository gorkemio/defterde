// ui/bitis.js — bitiş anı (oyunun tek büyük anı; dokununca ya da bir tuşla atlanır):
// 1. son kare taranır, 300 ms durak · 2. marjda kuru boya kutusunun kapağı açılır · 3. resim renk gruplarına göre kare kare
// boyanır (önce koyular, sonra dolgular, en son zemin yıkaması; 2–3 s) · 4. tarama boyanın altında %30'a iner, çarpılar bir
// silgi geçişiyle silinir · 5. resmin altına adı yazılır · 6. albüm kartı kayarak gelir. Az harekette yumuşak geçiş.
(function () {
  'use strict';
  const KK = window.KK;
  const BY = Kit.boyama;
  const S = { boyanan: [], zeminler: [], kuyruk: [], suruyor: false, atlandi: false, jeton: 0, bekleyen: null };

  function katmanKur() {
    S.jeton++; S.suruyor = false; S.boyanan = []; S.zeminler = []; S.kuyruk = [];
    const G = KK.tahta.G;
    KK.tahta.katman('boya', { x0: 0, y0: 0, ww: G.W, wh: G.H, ciz: boyaCiz, harman: 'multiply' });
  }
  const yer = (i) => { const G = KK.tahta.G; return [(i % G.en) * G.b, ((i / G.en) | 0) * G.b]; };
  function hucreBoya(ctx, p, il = 1) { const [x, y] = yer(p.i); BY.hucre(ctx, x, y, KK.tahta.G.b, { renk: p.renk, tohum: ['boya', KK.oyun.resim.id, p.i], ilerleme: il }); }
  function boyaCiz(ctx) {
    const G = KK.tahta.G;
    for (const z of S.zeminler) { const [x, y] = yer(z.i); BY.yikama(ctx, x, y, G.b, { renk: z.renk, tohum: ['zemin', z.i] }); }
    for (const p of S.boyanan) hucreBoya(ctx, p);
    if (S.boyanan.length) BY.maskele(ctx, 0, 0, G.W, G.H, Math.max(.4, G.b / 40));
  }

  // Üst katman: boyanmakta olan kareler (multiply)
  function ciz(ctx, D) {
    if (!S.kuyruk.length) return false;
    const simdi = performance.now(), dpr = KK.tahta.dpr, kat = KK.tahta.kat.get('boya');
    ctx.save();
    ctx.beginPath(); ctx.rect(D.gx0, D.gy0, D.w - D.gx0, D.h - D.gy0); ctx.clip();
    ctx.setTransform(dpr * D.s, 0, 0, dpr * D.s, dpr * D.tx, dpr * D.ty);
    ctx.globalCompositeOperation = 'multiply';
    let renk = null;
    S.kuyruk = S.kuyruk.filter(p => {
      const f = (simdi - p.bas) / p.sure;
      if (f < 0) return true;
      if (f >= 1) { S.boyanan.push(p); hucreBoya(kat.ctx, p); return false; }
      hucreBoya(ctx, p, Math.max(.06, f)); renk = p.renk;
      return true;
    });
    ctx.restore();
    if (renk && renk !== S.sonRenk) { S.sonRenk = renk; KK.sayfa.kutuVurgula(KK.resimler.renkAdi(renk)); }
    if (simdi - (S.sonSes || 0) > 150 && renk) { S.sonSes = simdi; KK.oyun.ses('boya', 0, 160); }
    if (!S.kuyruk.length && S.bitince) { const f = S.bitince; S.bitince = null; setTimeout(f, 0); }
    return true;
  }

  function atla(e) {
    if (!S.suruyor) return;
    if (e && e.target && e.target.closest && e.target.closest('#bitis-karti')) return;
    S.atlandi = true;
    if (S.bekleyen) { const f = S.bekleyen; S.bekleyen = null; f(); }
  }
  const bekle = (ms) => (S.atlandi || !ms ? Promise.resolve() : new Promise((coz) => { S.bekleyen = coz; setTimeout(() => { if (S.bekleyen === coz) { S.bekleyen = null; coz(); } }, ms); }));

  // Bütün resmi göster (kamerayı en uzak yakınlığa yumuşakça getir)
  function tumGoster(hareket) {
    const t = KK.tahta, k = t.kam;
    const bas = { s: k.s, tx: k.tx, ty: k.ty };
    k.s = k.smin; t.sinirla();
    const hedef = { s: k.s, tx: k.tx, ty: k.ty };
    if (!hareket || Math.abs(bas.s - hedef.s) < .01) { t.srAyarla(k.s); t.yenidenCiz(); return Promise.resolve(); }
    Object.assign(k, bas);
    return new Promise((coz) => {
      const t0 = performance.now(), sure = 480;
      const adim = () => {
        const f = Math.min(1, (performance.now() - t0) / sure), e = 1 - Math.pow(1 - f, 3);
        k.s = bas.s + (hedef.s - bas.s) * e; k.tx = bas.tx + (hedef.tx - bas.tx) * e; k.ty = bas.ty + (hedef.ty - bas.ty) * e;
        t.kirli();
        if (f < 1 && !S.atlandi) requestAnimationFrame(adim);
        else { Object.assign(k, hedef); t.srAyarla(k.s); t.yenidenCiz(); coz(); }
      };
      requestAnimationFrame(adim);
    });
  }

  function boyaSirayla(boya) {
    const n = boya.length, T = Math.max(2000, Math.min(2700, 1500 + n * 6)), sure = Math.max(110, Math.min(260, 3000 / Math.sqrt(n + 1)));
    const dt = n > 1 ? (T - sure) / (n - 1) : 0, t0 = performance.now();
    S.kuyruk = boya.map((p, k) => ({ i: p.i, renk: p.renk, bas: t0 + k * dt, sure }));
    KK.tahta.kirli();
    return new Promise((coz) => {
      S.bitince = coz;
      const bak = () => { if (S.atlandi) { S.kuyruk = []; S.bitince = null; coz(); } else if (S.kuyruk.length || S.bitince) setTimeout(bak, 60); };
      bak();
    });
  }

  async function carpilariSil(hareket) {
    const I = KK.isaretler, liste = [];
    for (let i = 0; i < I.d.length; i++) if (I.d[i] === 2) liste.push(i);
    if (hareket && liste.length) {
      KK.oyun.ses('silgi');
      const dt = 500 / liste.length;
      for (let k = 0; k < liste.length && !S.atlandi; k++) {
        I.silinen.add(liste[k]); I.degisti(liste[k], { kirinti: k % 4 === 0 });
        if (k % 6 === 5) await bekle(dt * 6);
      }
    }
    I.carpiYok = true;
  }

  async function baslat(kayit) {
    const jeton = ++S.jeton, r = KK.oyun.resim, hareket = Kit.kalem.animasyonVar();
    S.suruyor = true; S.atlandi = !hareket; S.sonRenk = null;
    addEventListener('pointerdown', atla, true); addEventListener('keydown', atla, true);
    const gecerli = () => jeton === S.jeton;
    await bekle(420);
    if (!gecerli()) return;
    await tumGoster(hareket && !S.atlandi);
    KK.sayfa.kutuAc(S.atlandi);
    KK.oyun.ses('teneke');
    await bekle(460);
    if (!gecerli()) return;
    const { boya, zemin } = KK.resimler.boyamaSirasi(r);
    if (!S.atlandi) await boyaSirayla(boya);
    if (!gecerli()) return;
    // atlandıysa ya da az hareket: hepsi birden
    const boyali = new Set(S.boyanan.map(p => p.i));
    for (const p of boya) if (!boyali.has(p.i)) S.boyanan.push(p);
    S.kuyruk = [];
    S.zeminler = zemin;
    KK.sayfa.kutuVurgula(null);
    await carpilariSil(hareket && !S.atlandi);
    if (!gecerli()) return;
    KK.isaretler.soluk = .3;
    KK.isaretler.hepsiDegisti();
    KK.tahta.yenidenCiz('boya');
    if (!hareket) KK.sayfa.tahtaSoluk && KK.sayfa.tahtaSoluk();
    KK.sayfa.baslikYaz();
    const ad = r.tur === 'kendi' ? r.ad : r.ad, alt = r.tur === 'kendi' && r.cizen ? 'Çizen: ' + r.cizen : '';
    KK.sayfa.adYaz(ad, alt, S.atlandi);
    await bekle(700);
    if (!gecerli()) return;
    S.suruyor = false;
    removeEventListener('pointerdown', atla, true); removeEventListener('keydown', atla, true);
    kart(kayit);
  }

  function kart(k) {
    const O = KK.oyun, r = O.resim, G = Kit.bulmaca.gunluk;
    const bilgi = `süre ${G.sureYazi(k.sure)} · ${k.hata ? 'hata ' + k.hata : 'hatasız'}${k.ipucu ? ' · ipucu ' + k.ipucu : ''}`;
    const komutlar = [];
    if (O.izle) {
      KK.sayfa.bitisKarti({ baslik: r.ad || 'Bitti', bilgi: 'izlendi · çözülmüş sayılmaz', komutlar: [
        { yazi: 'kendin çöz', f: () => KK.oyun.ac(r, { temiz: true }) },
        { yazi: 'albüm', f: () => KK.defterler.ac() }, { yazi: 'kapat', f: () => KK.sayfa.notKapat() }] });
      return;
    }
    let ek = KK.config.modAdi[k.mod] + ' mod';
    if (r.gunluk) {
      const metin = KK.gunluk.paylasimMetni(r, k);
      ek += ` · seri ${KK.gunluk.seri()}`;
      komutlar.push({ yazi: 'paylaş', f: async () => { const s = await G.paylas(metin); if (s === 'pano') KK.sayfa.duyur('Panoya kopyalandı.'); if (s === 'metin' || s === 'pano') KK.sayfa.paylasimGoster(metin); } });
    }
    if (r.tur === 'kilim') komutlar.push({ yazi: 'yeni kilim', f: () => KK.defterler.kilimAc(r.en, null) });
    else if (r.tur === 'kendi') komutlar.push({ yazi: 'kendi resmini yap', f: () => KK.kendi.ac() });
    else if (r.tur === 'resim' && !r.gunluk) komutlar.push({ yazi: 'sıradaki', f: () => KK.defterler.yeniBulmaca() });
    komutlar.push({ yazi: 'albüm', f: () => KK.defterler.ac(r.tur === 'resim' && !r.gunluk ? r.defter : null) });
    komutlar.push({ yazi: 'kapat', f: () => KK.sayfa.notKapat() });
    KK.sayfa.bitisKarti({ baslik: r.ad || 'Bitti', bilgi, ek, komutlar });
  }

  KK.bitis = Object.assign(S, { katmanKur, baslat, ciz, atla });
})();
