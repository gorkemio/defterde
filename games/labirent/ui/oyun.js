// ui/oyun.js — bir labirentin oynanışı: yükle, çiz, kronometre, ipucu ve çözüm, bitiş ve istatistikler, Baştan.
// Moda özgü işler (künye, kayıt, bitiş sonrası komutlar) ui/modlar.js'te; burası baglam.mod'a göre ona sorar.
// Motor (LB.generate, LB.solve, LB.path) ile çizimi (LB.sahne, LB.maze, LB.yolCiz, LB.marj) birbirine bağlar.
// Çizim işi kare döngüsünde yapılır: işaretçi olayları yalnız motoru ilerletir ve yolu "kirli" işaretler.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const $ = (id) => document.getElementById(id);
  const G = () => LB.generate, P = () => LB.path, Sol = () => LB.solve, S = () => LB.sahne, M = () => LB.marj;

  const IPUCU_CEZA = 10, IPUCU_SURE = 9000;

  const O = {
    lab: null, d: null, y: null, spec: null, par: 0, cozumUzunlugu: 0,
    baglam: { mod: 'serbest' },
    sure: { bas: 0, bitis: 0, calisiyor: false }, ceza: 0, ipuclu: false, cozumGoruldu: false,
    ipucu: null, cozumAcik: false,
    kayit: null, ayna: null,                            // oyuncunun koşusu hayalet izi olarak: [{ hucre, t }]
    rakip: null, hayaletBas: 0, rakipCikti: false,      // yarış: { ad, sure, iz, renk }
    ayar: null, yolKirli: false, kilit: false,
  };
  let sayac = 0;

  const renk = () => window.Kit.jel.SIMLI[O.ayar.renk];
  const ham = () => (O.sure.bas ? ((O.sure.calisiyor ? performance.now() : O.sure.bitis) - O.sure.bas) / 1000 : 0);
  const gecen = () => ham() + O.ceza;
  const hayaletSaati = () => (O.hayaletBas ? (performance.now() - O.hayaletBas) / 1000 : 0);
  function duyur(m) { $('duyuru').textContent = m; }
  // İz bırak: ayar açık/kapalı ya da 'kucuk' (Küçük boyda açık)
  const izBirakMi = () => O.ayar.izBirak === true || (O.ayar.izBirak === 'kucuk' && O.lab && O.lab.boy === 'K');

  /* ---------- yerleşim ---------- */

  // Pay: izin duvara en yakın uzaklığı (ızgara biriminde): yol ve duvar yarı kalınlığı (±%15 oynama dahil) + boşluk
  function payHesapla(y) { return (LB.yolCiz.kalinlik(y) / 2 * 1.1 + y.kalinlik / 2 * 1.15 + 1.2) / y.birim; }

  function yerlestir(koru) {
    const alan = $('alan'), w = alan.clientWidth, h = alan.clientHeight;
    S().boyutla(w, h);
    O.y = LB.maze.yerlesim(O.lab, w, h);
    O.d.pay = payHesapla(O.y);
    S().katman('labirent', (ctx) => LB.maze.ciz(ctx, O.lab, O.y), 0);
    const uvNokta = koru ? LB.uv.U.noktalar.map(p => LB.maze.izgaraya(LB.uv.U.y, p)) : [];
    LB.uv.kur(O.lab, O.y, { acik: O.ayar.uv, hafiza: O.ayar.uvHafiza });
    LB.uv.U.noktalar = uvNokta.map(p => LB.maze.dunyaHam(O.y, p));           // hafıza yeni yerleşime taşınır
    const odak = koru && O.d.iz.length > 2 ? O.d.iz[O.d.iz.length - 1] : P().agizOrta(O.lab.grid, O.lab.giris);
    S().kameraKur(O.y.w, O.y.h, O.y.gorunurKoridor, LB.maze.dunya(O.y, odak));
    LB.yolCiz.baglan(O.d, O.lab, O.y, renk(), koru);
    if (koru && O.cozumAcik) LB.yolCiz.cozumGoster(Sol().cozum(O.lab));
    if (koru && O.ipucu) LB.yolCiz.ipucuGoster(O.ipucu);
    if (O.rakip) LB.yolCiz.hayaletKur([{ iz: O.rakip.iz, renk: O.rakip.renk, alfa: O.rakip.alfa }], hayaletSaati);
    S().katmanlariCiz();
  }

  /* ---------- labirent ---------- */

  function yukle(spec, baglam = { mod: 'serbest' }) {
    if (LB.sonsuz && LB.sonsuz.aktif) LB.sonsuz.cik();
    O.spec = spec;
    O.baglam = baglam;
    O.lab = G().uret(spec);
    O.cozumUzunlugu = Sol().cozum(O.lab).length - 1;
    O.par = Sol().par(O.lab);
    O.d = P().yeni(O.lab);
    LB.modlar.yuklendi(O);                               // künye, mod satırı, adres (önce marj: alanın boyu ona bağlı)
    sifirla();
    yerlestir(false);
    LB.ayarlar.kodYaz();
    $('ekran').setAttribute('aria-label', `Labirent: ${O.lab.kod}. Oklarla girişten çıkışa yol çiz.`);
  }

  function sifirla() {
    clearInterval(sayac);
    O.sure = { bas: 0, bitis: 0, calisiyor: false };
    O.ceza = 0; O.ipuclu = false; O.cozumGoruldu = false;
    O.ipucu = null; O.cozumAcik = false;
    LB.yolCiz.ipucuSil(); LB.yolCiz.cozumGoster(null);
    M().kronometre(0);
    M().cemberSil();
    M().sonuc(null);
    M().etkin($('k-cozum'), false);
    LB.modlar.sonrasiGizle();
    O.kayit = null; O.ayna = null;
    LB.uv.sifirla();
    rakipHazirla();
  }

  /* ---------- hayalet yarışı ---------- */

  // Ayardaki rakip: 'kendi' (bu labirentteki en iyi koşun) ya da bilgisayar 'kolay' | 'orta' | 'zor'. İlk çizginle başlar.
  function rakipHazirla() {
    O.rakip = null; O.hayaletBas = 0; O.rakipCikti = false;
    const r = O.ayar.hayalet;
    if (r === 'kendi') {
      const k = LB.depo.enIyi(O.lab.kod);
      if (k && k.iz) O.rakip = { ad: 'en iyin', sure: k.sure, iz: LB.ghost.ac(k.iz), renk: renk(), alfa: .45 };
    } else if (r && LB.config.hayalet[r]) {
      const sim = LB.ghost.simule(O.lab, r, Math.floor(Math.random() * 1e9));
      O.rakip = { ad: { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' }[r] + ' hayalet', sure: sim.sure, iz: sim.iz, renk: window.Kit.jel.RENK.gumus, alfa: .85 };
    }
    LB.yolCiz.hayaletKur(O.rakip ? [{ iz: O.rakip.iz, renk: O.rakip.renk, alfa: O.rakip.alfa }] : [], hayaletSaati);
    if (O.rakip) M().sonuc([[{ metin: 'rakip: ' + O.rakip.ad }, { metin: M().sureYaz(O.rakip.sure) }]]);
    else if (r === 'kendi') M().sonuc([[{ metin: 'bu labirentte kaydın yok; önce bir kez çöz' }]]);
  }

  // Oyuncunun yolu her değiştiğinde hayalet izine adım adım yazılır (geri sarmada her geri adım ayrı kayıt)
  function kayitGuncelle() {
    if (!O.kayit) return;
    const h = O.d.hucreler, a = O.ayna, t = ham();
    let p = 0;
    while (p < a.length && p < h.length && a[p] === h[p]) p++;
    while (a.length > p) { a.pop(); O.kayit.push({ hucre: a[a.length - 1], t }); }
    for (let i = p; i < h.length; i++) { a.push(h[i]); O.kayit.push({ hucre: h[i], t }); }
  }

  /* ---------- sayfa çevirme ---------- */

  // Eski sayfanın kopyası (canvas görüntüsüyle) üste konur ve cilt çevresinde kalkar; altındaki sayfa çoktan yenidir.
  function sayfaCevir(yap) {
    if (!window.Kit.kalem.animasyonVar()) { yap(); return; }
    const sayfa = $('sayfa'), kopya = sayfa.cloneNode(true);
    kopya.removeAttribute('id');
    kopya.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    kopya.querySelectorAll('.not').forEach(e => e.remove());
    kopya.setAttribute('aria-hidden', 'true');
    LB.ses.sayfa();
    const eski = $('ekran'), yeni = kopya.querySelector('canvas');
    yeni.width = eski.width; yeni.height = eski.height;
    yeni.getContext('2d').drawImage(eski, 0, 0);
    sayfa.after(kopya);
    yap();
    requestAnimationFrame(() => kopya.classList.add('ceviriliyor'));
    const bitir = () => kopya.remove();
    kopya.addEventListener('animationend', (e) => { if (e.target === kopya) bitir(); });
    setTimeout(bitir, 900);
  }
  function ac(spec, baglam) { LB.ayarlar.notKapat(); sayfaCevir(() => yukle(spec, baglam)); }

  /* ---------- çizim ---------- */

  function saatBaslat() {
    if (O.sure.calisiyor || O.d.bitti) return;
    O.sure = { bas: performance.now(), bitis: 0, calisiyor: true };
    if (!O.kayit) { O.kayit = [{ hucre: O.lab.giris.hucre, t: 0 }]; O.ayna = [O.lab.giris.hucre]; }
    if (O.rakip && !O.hayaletBas) { O.hayaletBas = O.sure.bas; S().kirli(); }
    clearInterval(sayac);
    sayac = setInterval(() => M().kronometre(gecen()), 200);
  }

  function olaylar() {
    const d = O.d;
    for (const o of d.olay.splice(0)) {
      if (o.tip === 'geri') { LB.ses.geri(); if (izBirakMi()) LB.yolCiz.izBirak(o.silinen); }
      else if (o.tip === 'takildi') { LB.ses.takildi(); S().sars(80); try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* yoksay */ } }
      else if (o.tip === 'uzak') LB.yolCiz.uzakParilti();
      else if (o.tip === 'bitis') { O.yolKirli = true; kayitGuncelle(); LB.ses.bitis(); bitis(); }
    }
    kayitGuncelle();
    O.yolKirli = true;
    S().kirli();
  }

  const izgara = (p) => LB.maze.izgaraya(O.y, p);
  function basla(p) {
    if (O.kilit) return false;
    LB.ayarlar.notKapat();
    const ok = P().basla(O.d, izgara(p));
    if (ok) { saatBaslat(); LB.ses.cizBasla(); }
    olaylar();
    return ok;
  }
  function surukle(p) { P().surukle(O.d, izgara(p)); if (O.d.aktif) LB.ses.cizNokta(p, O.y.birim); olaylar(); }
  function birak() { P().birak(O.d); LB.ses.cizBitir(); olaylar(); }
  function ok(yon) {
    if (O.d.bitti || O.kilit) return;
    const n = O.d.hucreler.length;
    P().ok(O.d, yon);
    if (O.d.hucreler.length !== n) saatBaslat();
    olaylar();
  }

  // Kare döngüsünde: yeni iz noktalarını katmana aktar, kalem ucunu kamerayla izle
  function kareOncesi() {
    if (O.rakip && O.hayaletBas && !O.rakipCikti && LB.ghost.yeri(O.rakip.iz, hayaletSaati()).bitti) {
      O.rakipCikti = true;
      if (!O.d.bitti) { M().sonuc([[{ metin: 'hayalet çıktı', sinif: 'beyaz' }, { metin: M().sureYaz(O.rakip.sure) }]]); duyur(`${O.rakip.ad} çıktı: ${M().sureYaz(O.rakip.sure)}.`); }
    }
    if (!O.yolKirli) return false;
    O.yolKirli = false;
    LB.yolCiz.guncelle();
    if (O.d.aktif) S().takip(LB.yolCiz.uc());
    LB.uv.guncelle(LB.yolCiz.uc());
    return false;
  }
  function uvCiz(ctx) { if (LB.uv.U.acik && LB.yolCiz.Y.lab) LB.uv.isikCiz(ctx, LB.yolCiz.uc()); return false; }
  let ipucuZaman = 0;

  /* ---------- ipucu ve çözüm ---------- */

  // Saptığın yer gümüş halkayla, doğru rotanın sonraki 5 hücresi kesikli çizgiyle; +10 sn ve sonuç "ipuçlu"
  function ipucu() {
    if (O.d.bitti || O.kilit) return;
    saatBaslat();
    O.ceza += IPUCU_CEZA; O.ipuclu = true;
    O.ipucu = Sol().ipucu(O.lab, O.d.hucreler, 5);
    LB.yolCiz.ipucuGoster(O.ipucu);
    clearTimeout(ipucuZaman);
    ipucuZaman = setTimeout(() => { O.ipucu = null; LB.yolCiz.ipucuSil(); }, IPUCU_SURE);   // ipucu bir süre görünür
    M().kronometre(gecen());
    duyur(O.ipucu.sapma !== null ? 'Buradan saptın: halkayla işaretli. Doğru rota kesikli çizgide. On saniye eklendi.' : 'Doğru yoldasın; sonraki beş hücre kesikli çizgide. On saniye eklendi.');
    S().kirli();
  }
  // Tam rota kesikli çizgiyle; o koşu rekor sayılmaz. İkinci basış gizler.
  function cozum() {
    if (O.kilit) return;
    O.cozumAcik = !O.cozumAcik;
    if (O.cozumAcik) O.cozumGoruldu = true;
    LB.yolCiz.cozumGoster(O.cozumAcik ? Sol().cozum(O.lab) : null);
    M().etkin($('k-cozum'), O.cozumAcik);
    duyur(O.cozumAcik ? 'Çözüm kesikli çizgide. Bu koşu rekor sayılmaz.' : 'Çözüm gizlendi.');
  }

  /* ---------- bitiş ---------- */

  async function bitis() {
    clearInterval(sayac);
    O.sure.bitis = performance.now();
    O.sure.calisiyor = false;
    O.ipucu = null; LB.yolCiz.ipucuSil();
    const sn = gecen();
    M().kronometre(sn);
    const ist = P().istatistik(O.d, O.cozumUzunlugu), fark = Math.floor(sn) - O.par;
    const kayit = LB.modlar.bitti(O, sn);                 // { onceki, ek: [satır parçaları], duyuru }
    const ikinci = [{ metin: `verim %${Math.round(ist.verim * 100)}` }, { metin: `${ist.geriSayisi} geri dönüş` }];
    if (O.rakip) ikinci.unshift(sn < O.rakip.sure ? { metin: 'hayaleti geçtin', sinif: 'beyaz' } : { metin: `hayalet önde (${M().sureYaz(O.rakip.sure)})` });
    if (O.ipuclu) ikinci.push({ metin: 'ipuçlu' });
    if (O.cozumGoruldu) ikinci.push({ metin: 'çözüm görüldü' });
    else if (kayit.onceki) ikinci.push({ metin: sn < kayit.onceki.sure ? `önceki en iyin ${M().sureYaz(kayit.onceki.sure)}` : `en iyin ${M().sureYaz(kayit.onceki.sure)}` });
    const satirlar = [[{ metin: 'çıktın', sinif: 'beyaz' }, { metin: `par ${M().sureYaz(O.par)} · ${M().farkYaz(fark)}` }, ...(kayit.ek || [])], ikinci];
    duyur(`Çıktın. Süre ${M().sureYaz(sn)}, par ${M().sureYaz(O.par)}. Verim yüzde ${Math.round(ist.verim * 100)}, ${ist.geriSayisi} geri dönüş.${O.ipuclu ? ' İpuçlu.' : ''} ${kayit.duyuru || ''}`);
    O.kilit = true;
    await LB.yolCiz.bitis();
    O.kilit = false;
    M().cember(renk());
    M().sonuc(satirlar);
    LB.modlar.sonrasiGoster(O);
  }

  // Yolu siler. Günün labirentinde süren koşunun kronometresi sıfırlanmaz; Serbest ve Bölümler'de sıfırlanır.
  function bastan() {
    if (O.kilit) return;
    const sureKalsin = O.baglam.mod === 'gunun' && O.sure.calisiyor && !O.d.bitti;
    P().bastan(O.d);
    O.d.olay.length = 0;
    LB.yolCiz.izleriSil();
    LB.yolCiz.baglan(O.d, O.lab, O.y, renk());
    if (sureKalsin) {
      O.ipucu = null; LB.yolCiz.ipucuSil(); if (O.cozumAcik) LB.yolCiz.cozumGoster(Sol().cozum(O.lab));
      if (O.rakip) LB.yolCiz.hayaletKur([{ iz: O.rakip.iz, renk: O.rakip.renk, alfa: O.rakip.alfa }], hayaletSaati);
      kayitGuncelle();
    }
    else sifirla();
    S().odakla(LB.maze.dunya(O.y, P().agizOrta(O.lab.grid, O.lab.giris)));
    S().katmanlariCiz();
  }

  // Görünmez mürekkep ve hafıza ayarı: hemen uygulanır (hafıza baştan)
  function uvSec(acik, hafiza) {
    O.ayar.uv = acik; O.ayar.uvHafiza = hafiza; ayarKaydet();
    if (S().katmanlar.get('uv-cam')) { LB.uv.ayarla(acik, hafiza); LB.uv.sifirla(); LB.uv.guncelle(LB.yolCiz.uc()); }
    if (acik && LB.ses) LB.ses.uv();
  }
  function renkSec(ad) { O.ayar.renk = ad; ayarKaydet(); LB.yolCiz.renkDegis(renk()); if (O.d.bitti) M().cember(renk()); }
  function ayarKaydet() { LB.depo.ayarYaz(O.ayar); }

  function kur() {
    O.ayar = LB.depo.ayar();
    S().kur($('ekran'));
    S().ustler.push(uvCiz, LB.yolCiz.rehberCiz, LB.yolCiz.hayaletCiz, LB.yolCiz.ustCiz);
    S().oncesi.push(kareOncesi);
    // giriş, o an etkin denetleyiciye gider (olağan oyun ya da Sonsuz)
    LB.aktif = O;
    LB.giris.kur({ cv: $('ekran'), defter: $('defter'), basla: (p) => LB.aktif.basla(p), surukle: (p) => LB.aktif.surukle(p), birak: () => LB.aktif.birak(), ok: (y) => LB.aktif.ok(y) });
    $('k-bastan').addEventListener('click', () => LB.aktif.bastan());
    $('k-ipucu').addEventListener('click', ipucu);
    $('k-cozum').addEventListener('click', cozum);
  }

  // Ölçüm: çözüm boyunca kare başına birkaç işaretçi noktası verip kare süresini ölçer (?dik=60x40 ile)
  function olcumDenemesi(noktaKare = 4) {
    return new Promise((coz) => {
      bastan();
      const g = O.lab.grid, yol = Sol().cozum(O.lab), pts = [];
      for (let i = 0; i < yol.length; i++) {
        const a = g.merkez(yol[i]), b = i + 1 < yol.length ? g.merkez(yol[i + 1]) : a;
        for (let k = 0; k < 4; k++) pts.push(LB.maze.dunya(O.y, [a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4]));
      }
      basla(LB.maze.dunya(O.y, P().agizOrta(g, O.lab.giris)));
      S().olcumSifirla();
      let i = 0;
      const adim = () => {
        for (let k = 0; k < noktaKare && i < pts.length; k++, i++) surukle(pts[i]);
        if (i < pts.length && !O.d.bitti) requestAnimationFrame(adim);
        else { birak(); const o = S().olcum; coz({ kare: o.n, ortMs: +(o.toplam / o.n).toFixed(2), enMs: +o.en.toFixed(2), p95Ms: +o.son.slice().sort((a, b) => a - b)[Math.floor(o.son.length * .95)].toFixed(2), bitti: O.d.bitti, nokta: O.d.iz.length }); }
      };
      requestAnimationFrame(adim);
    });
  }

  Object.assign(O, { uvSec, kur, yukle, ac, yerlestir, bastan, ipucu, cozum, renkSec, ayarKaydet, olcumDenemesi, gecen, ham, izBirakMi, duyur, rakipHazirla, sayfaCevir, basla, surukle, birak, ok });
  LB.oyun = O;
})();
