// ui/oyun.js — oyun denetleyicisi: bulmacayı açar, kare işlemlerini (dokunma, sürükleme, klavye) geçmişe yazar, modları
// (Klasik · Rahat · Üç Silgi), ipucu, kontrol, üstü çizme, otomatik çarpı, kalıcılık ve bitişi yönetir.
(function () {
  'use strict';
  const KK = window.KK;
  const C = KK.config, M = KK.model, B = Kit.bulmaca;
  const depo = B.depo.Depo('kk-');
  const album = B.album.Album(depo);

  const O = {
    resim: null, b: null, d: null, kilit: null, silgi: null, gecmis: null, kr: null,
    hata: 0, ipucu: 0, mod: 'klasik', silgiKalan: 3, bitti: false, izle: false,
    surukle: null, imlec: null, islem: null, bekleyenYanlis: [], ekran: 'oyun',
    ayar: Object.assign({}, C.varsayilanAyar, depo.oku('ayar', {})),
    depo, album,
  };

  const ses = (ad, gec, arg) => { if (O.ayar.ses && Kit.ses) Kit.ses.cal(ad, gec, arg); };
  const duyur = (m) => KK.sayfa && KK.sayfa.duyur(m);
  const anahtar = () => 'durum-' + O.resim.id;

  // ---------- açma
  function ac(resim, o = {}) {
    if (!o.izle && KK.izle && KK.izle.oynuyor !== undefined) KK.izle.durdur();
    if (O.kaydetZaman) { clearTimeout(O.kaydetZaman); kaydet(); }
    O.resim = resim;
    O.b = KK.resimler.bulmaca(resim);
    O.kilit = M.kilitli(O.b);
    O.bitti = false; O.izle = !!o.izle; O.surukle = null; O.imlec = null; O.bekleyenYanlis = [];
    O.mod = o.mod || (O.ayar.cocuk ? 'rahat' : O.ayar.mod);
    const kay = !o.temiz && !O.izle ? depo.oku(anahtar(), null) : null;
    const n = O.b.en * O.b.boy;
    if (kay && kay.en === O.b.en && kay.boy === O.b.boy) {
      O.d = B.izgara.rleOku(kay.d, n); O.silgi = B.izgara.rleOku(kay.s, n);
      for (const k of O.b.baslangic) O.d[k.r * O.b.en + k.c] = k.v;
      O.gecmis = B.gecmis.Gecmis(kay.g); O.kr = B.sure.Kronometre(kay.sure || 0);
      O.hata = kay.hata || 0; O.ipucu = kay.ipucu || 0; O.mod = o.mod || kay.mod || O.mod; O.silgiKalan = kay.silgiKalan ?? 3;
    } else {
      O.d = M.durumYap(O.b); O.silgi = new Uint8Array(n);
      O.gecmis = B.gecmis.Gecmis(); O.kr = B.sure.Kronometre(0);
      O.hata = 0; O.ipucu = 0; O.silgiKalan = 3;
    }
    if (o.durum) O.d.set(o.durum);
    if (o.mod === 'klasik' && resim.gunluk) O.mod = 'klasik';
    O.ekran = 'oyun';
    KK.sayfa.oyunAc();
    tahtaKur(true);
    if (!O.izle && !o.durgun) O.kr.baslat();
    ses('cetvel');
    cocukIpucuKur();
    duyur(`${resim.ad && !gizliAd() ? resim.ad + ', ' : ''}${O.b.en}'e ${O.b.boy} bulmaca. ${C.modAdi[O.mod]} mod.`);
  }
  const gizliAd = () => O.resim && (O.resim.tur === 'resim' || O.resim.gunluk) && !O.bitti;

  // Tahta (yeniden) kurulumu: yerleşim değişince de çağrılır; kamera odağı korunur
  function tahtaKur(ilk) {
    const t = KK.tahta, yer = KK.sayfa.yerlestir(O.b);
    const b = yer.sq, bn = yer.bantlar;
    const G = { b, en: O.b.en, boy: O.b.boy, W: O.b.en * b, H: O.b.boy * b, Lw: bn.Lw * b, Lh: bn.Lh * b };
    let odak = null, s = null;
    if (!ilk && t.G) {
      const k = t.kam, eskiB = t.G.b, D = t.donusum();
      odak = [((D.gx0 + (t.w - D.gx0) / 2 - k.tx) / k.s) / eskiB * b, ((D.gy0 + (t.h - D.gy0) / 2 - k.ty) / k.s) / eskiB * b];
      s = k.s;
    }
    t.boyutla(yer.alan.w * b, yer.alan.h * b);
    t.yukle(G);
    KK.zemin.kur();
    KK.isaretler.kur({ d: O.d, kilit: O.kilit, silgi: O.silgi });
    KK.bitis.katmanKur();
    ustuGuncelle(true);
    const kam = { s0: yer.s0, smin: yer.smin, smax: yer.smax };
    if (s != null) kam.s = Math.min(kam.smax, Math.max(kam.smin, s));
    if (odak) kam.odak = odak;
    t.kameraKur(kam);
    KK.sayfa.bilgiGuncelle();
  }

  // ---------- kare işlemleri
  function oynanabilir() { return O.ekran === 'oyun' && !O.bitti && !O.izle && !(KK.bitis && KK.bitis.suruyor) && !O.yirtiliyor; }
  function koyHam(i, v, o = {}) {
    const eski = O.d[i];
    if (eski === v) return false;
    if (eski && !v) O.silgi[i] = Math.min(3, O.silgi[i] + 1);
    O.d[i] = v;
    KK.isaretler.degisti(i, { anim: o.anim === false ? null : v === 1 ? 'tarama' : v === 2 ? 'carpi' : null, kirinti: eski && !v });
    return true;
  }
  function sonraki(cur, arac) {
    if (arac === 'carpi') return cur === 2 ? 0 : 2;
    if (arac === 'silgi') return 0;
    return cur === 0 ? 1 : cur === 1 ? 2 : 0;
  }
  const denetimli = () => O.mod === 'rahat' || O.mod === 'ucsilgi';

  function surukleBasla(r, c, o = {}) {
    if (!oynanabilir()) return null;
    const i = r * O.b.en + c;
    if (O.kilit[i]) return null;
    const hedef = o.carpi || o.sag ? sonraki(O.d[i], 'carpi') : sonraki(O.d[i], O.ayar.arac);
    O.surukle = { r0: r, c0: c, hedef, once: new Map(), dokunulan: [], durdu: false };
    if (!O.kr.calisiyor) O.kr.baslat();
    surukleUygula([i]);
    return hedef;
  }
  function cizgiKareleri(r0, c0, r, c) {
    const s = [], dr = Math.sign(r - r0), dc = Math.sign(c - c0), n = Math.max(Math.abs(r - r0), Math.abs(c - c0));
    for (let k = 0; k <= n; k++) s.push((r0 + dr * k) * O.b.en + (c0 + dc * k));
    return s;
  }
  function surukleUygula(kareler) {
    const S = O.surukle, yeni = new Set(kareler);
    // aralıktan çıkanlar eski hâline
    for (const i of S.dokunulan) if (!yeni.has(i) && !O.bekleyenYanlis.some(y => y.i === i)) koyHam(i, S.once.get(i), { anim: false });
    S.dokunulan = [];
    let sesli = 0;
    for (const i of kareler) {
      if (O.kilit[i]) continue;
      if (!S.once.has(i)) S.once.set(i, O.d[i]);
      S.dokunulan.push(i);
      if (S.durdu) continue;
      if (O.d[i] === S.hedef) continue;
      if (denetimli() && S.hedef && M.yanlisMi(O.b, (i / O.b.en) | 0, i % O.b.en, S.hedef)) {
        koyHam(i, S.hedef);
        yanlisYap(i, S.once.get(i));
        S.durdu = true;
        continue;
      }
      if (koyHam(i, S.hedef)) sesli++;
    }
    if (sesli) ses(S.hedef === 1 ? 'tarama' : S.hedef === 2 ? 'carpi' : 'silgi');
    KK.tahta.kirli();
  }
  function surukleGuncelle(r, c) { if (O.surukle) surukleUygula(cizgiKareleri(O.surukle.r0, O.surukle.c0, r, c)); }
  function surukleBitir() {
    const S = O.surukle;
    if (!S) return;
    O.surukle = null;
    const degisiklik = [];
    for (const [i, eski] of S.once) {
      if (O.bekleyenYanlis.some(y => y.i === i)) continue;
      if (O.d[i] !== eski) degisiklik.push({ i, eski, yeni: O.d[i] });
    }
    islemKaydet(degisiklik, 'surukle');
  }
  function surukleIptal() {
    const S = O.surukle;
    if (!S) return;
    O.surukle = null;
    for (const [i, eski] of S.once) if (!O.bekleyenYanlis.some(y => y.i === i)) koyHam(i, eski, { anim: false });
    KK.tahta.kirli();
  }

  // Rahat ve Üç Silgi: yanlış hamle hemen gösterilir, 600 ms sonra silinir, sayılır
  function yanlisYap(i, eski) {
    O.hata++;
    const r = (i / O.b.en) | 0, c = i % O.b.en;
    KK.ust.yanlislar.push({ r, c, bas: performance.now(), sure: 900 });
    O.bekleyenYanlis.push({ i, eski });
    ses('cizik');
    duyur(`${r + 1}. satır ${c + 1}. kare yanlış.`);
    setTimeout(() => {
      O.bekleyenYanlis = O.bekleyenYanlis.filter(y => y.i !== i);
      koyHam(i, eski, { anim: false });
      ses('silgi');
      KK.tahta.kirli();
      ustuGuncelle();
    }, 600);
    if (O.mod === 'ucsilgi') {
      O.silgiKalan--;
      KK.sayfa.silgiKullan(2 - O.silgiKalan);
      if (O.silgiKalan <= 0) setTimeout(yirt, 700);
    }
    KK.sayfa.bilgiGuncelle();
    kaydetGec();
  }
  function yirt() {
    O.yirtiliyor = true;
    duyur('Silgiler bitti; sayfa yırtıldı. Bulmaca baştan başlıyor.');
    ses('sayfa');
    KK.sayfa.yirt(() => {
      O.yirtiliyor = false;
      O.d.set(M.durumYap(O.b)); O.silgi.fill(0); O.gecmis.temizle();
      O.hata = 0; O.ipucu = 0; O.silgiKalan = 3; O.kr.sifirla(0); O.kr.baslat();
      KK.ust.yanlislar = []; KK.ust.ipucu = null;
      KK.isaretler.hepsiDegisti(); KK.sayfa.silgilerKur(); ustuGuncelle(); KK.sayfa.bilgiGuncelle();
      depo.sil(anahtar());
    });
  }

  function islemKaydet(degisiklik, etiket) {
    if (!degisiklik.length) return;
    // tamamlanan satırı çarpıyla doldur
    if (O.ayar.otoCarpi) {
      const cizgiler = new Set();
      for (const x of degisiklik) { cizgiler.add('r' + ((x.i / O.b.en) | 0)); cizgiler.add('c' + (x.i % O.b.en)); }
      for (const k of cizgiler) {
        const sat = k[0] === 'r', n = +k.slice(1), uz = sat ? O.b.en : O.b.boy;
        const idx = (j) => (sat ? n * O.b.en + j : j * O.b.en + n);
        const cizgi = []; for (let j = 0; j < uz; j++) cizgi.push(O.d[idx(j)]);
        const ip = sat ? O.b.ipuclari.satir[n] : O.b.ipuclari.sutun[n];
        if (M.cizgiSaglandi(cizgi, ip)) for (let j = 0; j < uz; j++) { const i = idx(j); if (!O.d[i] && !O.kilit[i]) { degisiklik.push({ i, eski: 0, yeni: 2 }); koyHam(i, 2); } }
      }
    }
    O.gecmis.islem(degisiklik, etiket);
    sonrasi(degisiklik);
  }
  function sonrasi(degisiklik) {
    if (KK.ust.ipucu && degisiklik && degisiklik.length) KK.ust.ipucu = null, KK.zemin.vurgula(null);
    cocukIpucuKur();
    ustuGuncelle();
    KK.sayfa.bilgiGuncelle();
    duyurTamamlanan(degisiklik);
    kaydetGec();
    if (!O.izle && M.cozulduMu(O.d, O.b)) bitir();
  }
  // Çocuk modu: açıklamalı ipucu her zaman açık — 5 s hareketsiz kalınca bir sonraki çıkarım kendiliğinden gösterilir (sayılmaz)
  function cocukIpucuKur() {
    clearTimeout(O.cocukZaman);
    if (!O.ayar.cocuk || O.izle) return;
    O.cocukZaman = setTimeout(() => {
      if (!oynanabilir() || KK.ust.ipucu) return;
      const ip = KK.explain.sonrakiIpucu(O.d, O.b);
      if (!ip || ip.tur === 'yok') return;
      if (ip.tur === 'yanlis') { for (const h of ip.hucreler) KK.ust.yanlislar.push({ r: h.r, c: h.c, bas: performance.now(), sure: 4000 }); }
      else { KK.ust.ipucu = Object.assign({ hucreler: ip.adim.hucreler, bas: performance.now() }, ip.adim.bolge); KK.zemin.vurgula(ip.adim.bolge.tur === 'kare' ? null : ip.adim.bolge); }
      KK.sayfa.ipucuNotu(ip.metin);
      KK.tahta.kirli();
    }, 5000);
  }

  // satır/sütun tamamlanınca aria-live
  function duyurTamamlanan(degisiklik) {
    if (!degisiklik || !degisiklik.length) return;
    const s = new Set(), u = new Set();
    for (const x of degisiklik) { s.add((x.i / O.b.en) | 0); u.add(x.i % O.b.en); }
    const m = [];
    for (const r of s) if (M.cizgiDurumu(O.d, O.b, 'satir', r).saglandi) m.push(`${r + 1}. satır tamam`);
    for (const c of u) if (M.cizgiDurumu(O.d, O.b, 'sutun', c).saglandi) m.push(`${c + 1}. sütun tamam`);
    if (m.length && m.length < 4) duyur(m.join(', ') + '.');
  }

  function geriAl() {
    if (!oynanabilir()) return;
    const d = O.gecmis.geriAl();
    if (!d) return;
    for (const x of d) koyHam(x.i, x.deger, { anim: false });
    ses('silgi');
    sonrasi(d.map(x => ({ i: x.i })));
    duyur('Geri alındı.');
  }
  function yinele() {
    if (!oynanabilir()) return;
    const d = O.gecmis.yinele();
    if (!d) return;
    for (const x of d) koyHam(x.i, x.deger);
    ses('tarama');
    sonrasi(d.map(x => ({ i: x.i })));
    duyur('Yinelendi.');
  }

  // ---------- üstü çizilen ipuçları (yalnız oyuncunun işaretleri)
  function ustuGuncelle(zorla) {
    const b = O.b, satir = [], sutun = [];
    for (let r = 0; r < b.boy; r++) satir.push(M.ustuCizilenler(M.satirAl(O.d, b.en, r), b.ipuclari.satir[r]));
    for (let c = 0; c < b.en; c++) sutun.push(M.ustuCizilenler(M.sutunAl(O.d, b.en, b.boy, c), b.ipuclari.sutun[c]));
    KK.zemin.acik = O.ayar.ustunuCiz;
    if (zorla) KK.zemin.ustu = null;
    KK.zemin.ustuGuncelle({ satir, sutun });
  }

  // ---------- ipucu, kontrol
  function ipucuVer() {
    if (!oynanabilir()) return;
    const ip = KK.explain.sonrakiIpucu(O.d, O.b);
    if (!ip) return;
    O.ipucu++;
    if (ip.tur === 'yanlis') {
      for (const h of ip.hucreler) KK.ust.yanlislar.push({ r: h.r, c: h.c, bas: performance.now(), sure: 4000 });
      KK.ust.ipucu = { tur: 'kare', r: ip.hucreler[0].r, c: ip.hucreler[0].c, bas: performance.now() };
      odakKare(ip.hucreler[0].r, ip.hucreler[0].c);
    } else if (ip.tur === 'adim') {
      const a = ip.adim;
      KK.ust.ipucu = Object.assign({ hucreler: a.hucreler, bas: performance.now() }, a.bolge);
      KK.zemin.vurgula(a.bolge.tur === 'kare' ? null : a.bolge);
      const h = a.hucreler[0];
      if (h) odakKare(h.r, h.c);
    }
    KK.sayfa.ipucuNotu(ip.metin);
    ses('kalem');
    duyur(ip.metin);
    KK.sayfa.bilgiGuncelle();
    kaydetGec();
    KK.tahta.kirli();
  }
  function odakKare(r, c) {
    const t = KK.tahta, D = t.donusum(), b = t.G.b * t.kam.s;
    const x = t.kam.tx + (c + .5) * b, y = t.kam.ty + (r + .5) * b;
    if (x < D.gx0 || x > t.w || y < D.gy0 || y > t.h) t.odakla([(c + .5) * t.G.b, (r + .5) * t.G.b], false);
  }
  function kontrolEt() {
    if (!oynanabilir()) return;
    const y = M.yanlislar(O.d, O.b);
    O.ipucu++;
    if (!y.length) { KK.sayfa.ipucuNotu('Yanlış işaretlenmiş kare yok.'); duyur('Yanlış kare yok.'); }
    else {
      for (const h of y) KK.ust.yanlislar.push({ r: h.r, c: h.c, bas: performance.now(), sure: 3500 });
      KK.sayfa.ipucuNotu(y.length === 1 ? '1 kare yanlış işaretlenmiş.' : `${y.length} kare yanlış işaretlenmiş.`);
      duyur(`${y.length} yanlış kare.`);
      ses('cizik');
    }
    KK.sayfa.bilgiGuncelle();
    kaydetGec();
    KK.tahta.kirli();
  }

  // ---------- klavye
  function imlecHareket(dr, dc, shift) {
    if (O.ekran !== 'oyun') return;
    const b = O.b;
    if (!O.imlec) { O.imlec = { r: 0, c: 0 }; }
    else {
      const r = Math.max(0, Math.min(b.boy - 1, O.imlec.r + dr)), c = Math.max(0, Math.min(b.en - 1, O.imlec.c + dc));
      if (shift && oynanabilir() && (r !== O.imlec.r || c !== O.imlec.c)) {
        const v = O.d[O.imlec.r * b.en + O.imlec.c], i = r * b.en + c;
        if (!O.kilit[i] && O.d[i] !== v) {
          if (denetimli() && v && M.yanlisMi(b, r, c, v)) { koyHam(i, v); yanlisYap(i, 0); }
          else { const eski = O.d[i]; koyHam(i, v); islemKaydet([{ i, eski, yeni: v }], 'tus'); }
        }
      }
      O.imlec = { r, c };
    }
    KK.ust.imlec = O.imlec;
    KK.tahta.takip(O.imlec.r, O.imlec.c);
    imlecDuyur();
    KK.tahta.kirli();
  }
  function imlecDuyur() {
    if (!O.imlec) return; // Son hamle bitişi başlatınca imleç kaldırılır.
    const { r, c } = O.imlec, b = O.b, v = O.d[r * b.en + c];
    const sd = M.cizgiDurumu(O.d, b, 'satir', r), ud = M.cizgiDurumu(O.d, b, 'sutun', c);
    duyur(`${r + 1}. satır, ipucu ${sd.ipucu.join(' ')}, ${sd.dolu} kare dolu. ${c + 1}. sütun, ipucu ${ud.ipucu.join(' ')}. Kare ${v === 1 ? 'dolu' : v === 2 ? 'çarpı' : 'boş'}.`);
  }
  function tusIsle(ne) {
    if (!oynanabilir()) return;
    if (!O.imlec) { imlecHareket(0, 0); return; }
    const { r, c } = O.imlec, i = r * O.b.en + c;
    if (O.kilit[i]) return;
    const cur = O.d[i], v = ne === 'dolu' ? (cur === 1 ? 0 : 1) : ne === 'carpi' ? (cur === 2 ? 0 : 2) : 0;
    if (v === cur) return;
    if (!O.kr.calisiyor) O.kr.baslat();
    if (denetimli() && v && M.yanlisMi(O.b, r, c, v)) { koyHam(i, v); yanlisYap(i, cur); return; }
    koyHam(i, v);
    ses(v === 1 ? 'tarama' : v === 2 ? 'carpi' : 'silgi');
    islemKaydet([{ i, eski: cur, yeni: v }], 'tus');
    imlecDuyur();
  }
  function imlecGizle() { if (O.imlec) { O.imlec = null; KK.ust.imlec = null; } }
  function uzerinde(h) {
    const s = h && h.tur === 'izgara' ? { r: h.r, c: h.c } : h && h.tur === 'satir' ? { r: h.r } : h && h.tur === 'sutun' ? { c: h.c } : null;
    const e = KK.ust.serit;
    if ((e && s && e.r === s.r && e.c === s.c) || (!e && !s)) return;
    KK.ust.serit = s;
    KK.tahta.kirli();
  }
  function baslikDokun(h) {
    KK.ust.ipucu = h.tur === 'satir' ? { tur: 'satir', i: h.r, bas: performance.now() } : { tur: 'sutun', i: h.c, bas: performance.now() };
    const st = M.cizgiDurumu(O.d, O.b, h.tur, h.tur === 'satir' ? h.r : h.c);
    duyur(`${(h.tur === 'satir' ? h.r : h.c) + 1}. ${h.tur === 'satir' ? 'satır' : 'sütun'}, ipucu ${st.ipucu.join(' ')}, ${st.dolu} kare dolu.`);
    clearTimeout(O.baslikZaman);
    O.baslikZaman = setTimeout(() => { if (KK.ust.ipucu && !KK.ust.ipucu.hucreler) { KK.ust.ipucu = null; KK.tahta.kirli(); } }, 1200);
    KK.tahta.kirli();
  }

  // ---------- kalıcılık
  function kaydet() {
    O.kaydetZaman = 0;
    if (!O.resim || O.izle || O.resim.tur === 'ornek') return;
    if (O.bitti) { depo.sil(anahtar()); return; }
    depo.yaz(anahtar(), {
      en: O.b.en, boy: O.b.boy, d: B.izgara.rle(O.d), s: B.izgara.rle(O.silgi), g: O.gecmis.yaz(),
      sure: Math.round(O.kr.ms()), hata: O.hata, ipucu: O.ipucu, mod: O.mod, silgiKalan: O.silgiKalan, tarih: Kit.bulmaca.gunluk.istanbulTarih(),
    });
  }
  function kaydetGec() { clearTimeout(O.kaydetZaman); O.kaydetZaman = setTimeout(kaydet, 400); }
  const yarimMi = (id) => !!depo.oku('durum-' + id, null);
  function ayarYaz(k, v) { O.ayar[k] = v; depo.yaz('ayar', O.ayar); }

  // ---------- bitiş
  function bitir() {
    O.bitti = true;
    O.kr.duraklat();
    imlecGizle(); KK.ust.serit = null; KK.ust.ipucu = null; KK.zemin.vurgula(null);
    const r = O.resim, sure = Math.round(O.kr.ms());
    const kayit = { sure, hata: O.hata, ipucu: O.ipucu, mod: O.mod, tarih: Kit.bulmaca.gunluk.istanbulTarih() };
    if (r.tur !== 'ornek' && r.tur !== 'izle') {
      if (r.tur === 'kilim') album.kaydet('kilim', r.id, Object.assign({ tohum: r.tohum, boyN: r.en, ad: r.ad }, kayit));
      else if (r.tur === 'kendi') album.kaydet('kendi', r.id, Object.assign({ kod: r.kod, ad: r.ad, cizen: r.cizen }, kayit));
      else album.kaydet(r.defter, r.albumId || r.id, kayit);
      if (r.gunluk) KK.gunluk.kaydet(r, kayit);
      depo.sil(anahtar());
    }
    KK.sayfa.bilgiGuncelle();
    duyur(`Bitti! ${r.ad || ''}`);
    KK.bitis.baslat(kayit);
  }

  O.bulmaca = () => O.b;
  O.ekranda = () => O.ekran === 'oyun';
  Object.assign(O, { ac, tahtaKur, oynanabilir, surukleBasla, surukleGuncelle, surukleBitir, surukleIptal, geriAl, yinele, ipucuVer, kontrolEt, imlecHareket, tusIsle, imlecGizle, uzerinde, baslikDokun, kaydet, kaydetGec, yarimMi, ayarYaz, ustuGuncelle, koyHam, gizliAd, ses, sonrasi });
  KK.oyun = O;
})();
