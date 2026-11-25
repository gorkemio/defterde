// draw.js — Sayı Bulma'ya özgü çizim: sayfa yerleşimi, başlık, tahmin satırları, giriş kutuları, rakam çizelgesi,
// kalan aday notu, karalama. Kalem altyapısı kit/kalem.js, malzeme kit/kirmizimavi.js, rakamlar kit/rakam.js.
// Oyun kurallarını bilmez: ne yazılacağını ui.js söyler. Her çizim { node, bitti, sure } döndürür.
// Koordinatlar CSS pikselidir (SVG viewBox = sayfa boyutu). Satır k'nın taban çizgisi: L.ust + k * L.s.
(function () {
  'use strict';

  const SB = (window.SB = window.SB || {});
  const Kit = window.Kit, KL = Kit.kalem, R = Kit.rakam;
  const { svgEl, metinSvg, renkDeger, rastgele, aralik } = KL;

  /* ---------- yerleşim (DOM'suz) ---------- */

  // vw, vh: kullanılabilir alan. o: { satir: ilk tahmin satırından sonra kullanılan satır sayısı (tahminler + giriş ya da
  // sonuç + açık notlar), ilkEk (tahminlerin üstüne ayrılan satır: gizli sayı), hane, sutun: 1|2, satirPx }
  function yerlesim(vw, vh, o = {}) {
    vw = Math.max(vw || 0, 280); vh = Math.max(vh || 0, 400);   // pencere bir an sıfır ölçülebilir (gizli panel, döndürme)
    const dar = vw < 600;
    const px = o.satirPx || { masaustu: 36, telefon: 32 };
    let s = dar ? px.telefon : px.masaustu, W;
    if (dar) {
      W = Math.min(vw - 8, Math.round(11.5 * s));
      s = Math.min(s, Math.floor(W / 11.4));                // 320 px gibi dar ekranda satır küçülür
    } else W = 15 * s;
    const hane = o.hane || 4;
    const L = { dar, s, W, hane, sutun: o.sutun || 1 };
    L.ust = Math.round(2.4 * s);                             // 0. satırın taban çizgisi (başlık)
    L.marjX = Math.round((dar ? 1.9 : 2.2) * s);
    L.ilk = 3 + (o.ilkEk || 0);                              // ilk tahmin satırı (gizli sayı yazılan oyunlarda bir aşağıda)
    L.hT = s * (dar ? .58 : .6);                             // tahmin rakamı yüksekliği
    L.hC = s * .52;                                          // cevap
    L.hN = s * .46;                                          // satır numarası
    L.x0 = L.marjX + .5 * s;                                 // tahminin solu
    L.xC = L.x0 + R.genislik('0'.repeat(hane), L.hT) + .8 * s;   // cevabın solu
    // Sütunlar: tek sütunda yukarıdaki ölçüler; iki sütunda (yarış, iki kişi) rakamlar küçülür, ikinci sütun sayfanın
    // ortasından başlar. noSag: satır numarasının sağ kenarı.
    L.sutunlar = [{ x0: L.x0, xC: L.xC, noSag: L.marjX - .22 * s, hT: L.hT, hC: L.hC, hN: L.hN }];
    if (L.sutun === 2) {
      // Sığmazsa (5 hane, dar ekran) rakamlar kademeli küçülür
      for (let f = 1; f >= .6; f -= .05) {
        const hT = s * (dar ? .5 : .56) * f, hC = s * (dar ? .45 : .5) * f, hN = s * (dar ? .4 : .44) * f, ara = s * (dar ? .35 : .7) * f;
        const gw = R.genislik('0'.repeat(hane), hT), cw = R.genislik('+0 -0', hC);
        const s0 = { x0: L.x0, xC: L.x0 + gw + ara, noSag: L.marjX - .22 * s, hT, hC, hN };
        const noSag1 = Math.max(W * .52, s0.xC + cw + .35 * s * f + R.genislik('10.', hN));
        const x01 = noSag1 + (dar ? .34 : .55) * s * f;
        L.sutunlar = [s0, { x0: x01, xC: x01 + gw + ara, noSag: noSag1, hT, hC, hN }];
        if (x01 + gw + ara + cw <= W - .3 * s) break;
      }
    }
    // Rakam çizelgesi: 1. satırda 0–9 yan yana. Geniş sayfada sağa yaslı (solunda mod notu); dar sayfada satırın
    // tamamını alır, mod notu 2. satıra iner.
    if (dar) {
      const x = L.x0 - .15 * s;
      L.cizelge = { k: 1, hucre: (W - .45 * s - x) / 10, h: s * .5, x };
      L.modK = 2;
    } else {
      const c = s * .8;
      L.cizelge = { k: 1, hucre: c, h: s * .5, x: W - .5 * s - 10 * c };
      L.modK = 1;
    }
    // Satırlar: başlık (0) + çizelge (1) + boş (2) + kullanılan + boş + kalan + boş + komutlar
    L.komutSatir = dar ? 3 : 2;
    const gerekli = L.ilk + (o.satir ?? 1) + 1 + 1 + 1 + L.komutSatir;
    L.satirSayisi = Math.max(dar ? 16 : 18, gerekli);         // telefonda kısa: komutlar tuş takımının üstünde kalsın
    L.kalanK = L.satirSayisi - L.komutSatir - 2;
    L.komutK = L.satirSayisi - L.komutSatir;
    L.H = Math.round(L.ust + (L.satirSayisi - 1) * s + .9 * s);
    L.alt = L.H - L.ust - (L.satirSayisi - 1) * s;
    return L;
  }
  const taban = (L, k) => L.ust + k * L.s;
  const sut = (L, c) => L.sutunlar[c || 0];

  /* ---------- sahne ---------- */

  const KATMANLAR = ['baslik', 'sutunAdlari', 'cizelgeOto', 'cizelge', 'cizelgeElle', 'gizliSayi', 'uyari', 'satirlar', 'giris', 'sayac', 'notlar', 'kalan', 'sonuc', 'karalama'];

  function sahneKur(svg, L) {
    svg.textContent = '';
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const K = KL.kalemYap(svg);
    const maske = Kit.kirmizimavi && Kit.kirmizimavi.doku ? Kit.kirmizimavi.doku(svg) : null;
    const murekkep = svgEl('g', { class: 'murekkep' }, svg);
    if (maske) murekkep.setAttribute('mask', maske);
    const k = {};
    for (const ad of KATMANLAR) k[ad] = svgEl('g', { class: ad }, murekkep);
    return { svg, K, k, L };
  }

  /* ---------- başlık ---------- */

  // Sol üstte başlık (mavi, altı kırmızı kalemle çizili), sağda tarih (kurşun), 1. satırın solunda mod notu (kurşun).
  function baslikYaz(S, o) {
    const { L, K } = S, g = S.k.baslik;
    g.textContent = '';
    const y0 = taban(L, 0), gec = o.gecikme || 0;
    const b = metinSvg(g, o.baslik, { x: L.x0, y: y0 - .14 * L.s, boyut: .82 * L.s, renk: 'mavi', hiza: 'start', tohum: ['baslik', o.baslik], gecikme: gec, adim: 55, anlik: o.anlik });
    const w = b.node.getComputedTextLength ? b.node.getComputedTextLength() : 4 * L.s;
    const alti = KL.altiCiz(K, g, L.x0, L.x0 + w, y0 + .06 * L.s, { tohum: ['baslik-alti', o.baslik], ek: { stroke: renkDeger('kirmizi'), strokeWidth: 2 }, gecikme: gec + b.sure, anlik: o.anlik, sureMs: [220, 260] });
    const t = metinSvg(g, o.tarih, { x: L.W - .55 * L.s, y: y0 - .16 * L.s, boyut: .44 * L.s, renk: 'kursun', hiza: 'end', tohum: ['tarih', o.tarih], gecikme: gec + 200, anlik: o.anlik });
    const m = metinSvg(g, o.alt, { x: L.x0, y: taban(L, L.modK) - .16 * L.s, boyut: .44 * L.s, renk: 'kursun', hiza: 'start', tohum: ['alt', o.alt], gecikme: gec + 350, anlik: o.anlik });
    // Rakam satırının ne olduğu (tuş takımı sanılmasın) ve cevabın anlamı: kısa kurşun/kırmızı notlar
    metinSvg(g, 'çizelge', { x: L.marjX - .2 * L.s, y: taban(L, L.cizelge.k) - .16 * L.s, boyut: .36 * L.s, renk: 'kursun', hiza: 'end', tohum: ['cizelge-et'], gecikme: gec + 400, anlik: o.anlik });
    if (o.anahtar !== false) {
      const a = metinSvg(g, L.dar ? '+ yerinde · − yeri yanlış' : '+ yerinde · − var ama başka yerde', { x: L.W - .55 * L.s, y: taban(L, 2) - .16 * L.s, boyut: .38 * L.s, renk: 'kirmizi', hiza: 'end', tohum: ['anahtar'], gecikme: gec + 500, anlik: o.anlik });
      // Telefonda mod notuyla aynı satırda: çakışırsa yazılmaz
      if (L.modK === 2 && a.node.getComputedTextLength && m.node.getComputedTextLength) {
        const aw = a.node.getComputedTextLength(), mw = m.node.getComputedTextLength();
        if (aw && mw && L.x0 + mw + .4 * L.s > L.W - .55 * L.s - aw) a.node.remove();
      }
    }
    return { bitti: Promise.all([b.bitti, alti.bitti, t.bitti, m.bitti]), sure: Math.max(b.sure + 260, t.sure + 200, m.sure + 350) };
  }

  /* ---------- tahmin satırı ---------- */

  // Cevap metni: "+1 −2"; hepsi doğruysa yalnız "+4".
  const cevapMetni = (arti, eksi, hane) => (arti === hane ? `+${arti}` : `+${arti} -${eksi}`);

  // i: kaçıncı tahmin (0'dan), satir: { tahmin: '1234', arti, eksi }. Önce satır numarası ve rakamlar (mavi uç),
  // sonra kalem çevrilir (120 ms) ve cevap kırmızı uçla yazılır. o: { gecikme, anlik, oyun (tohum), cevapsiz }
  function satirYaz(S, i, satir, o = {}) {
    const { L, K } = S, c = o.sutun || 0, Z = sut(L, c), y = taban(L, L.ilk + i), an = ['satir', o.oyun || 0, c, i];
    const g = svgEl('g', { class: 'satir', 'data-i': i, 'data-s': c }, S.k.satirlar);
    let gec = o.gecikme || 0;
    const no = String(i + 1) + '.';
    const nw = R.genislik(no, Z.hN);
    const n = R.yaz(K, g, no, { x: Z.noSag - nw, y, boyut: Z.hN, renk: 'mavi', tohum: [...an, 'no'], gecikme: gec, anlik: o.anlik, sure: 110 });
    gec += o.anlik ? 0 : n.sure * .7;
    // o.tahminNode: girişte zaten yazılmış rakamlar (girisAl) satıra taşınır, yeniden yazılmaz
    const t = o.tahminNode ? (g.appendChild(o.tahminNode), { bitti: Promise.resolve(), sure: 0 })
      : R.yaz(K, g, satir.tahmin, { x: Z.x0, y, boyut: Z.hT, renk: 'mavi', tohum: [...an, 'tahmin', satir.tahmin], gecikme: gec, anlik: o.anlik });
    const bit = [n.bitti, t.bitti];
    let sure = gec + t.sure - (o.gecikme || 0);
    if (!o.cevapsiz && satir.arti != null) {
      const cv = cevapYaz(S, g, i, satir, { gecikme: gec + t.sure + (o.anlik ? 0 : 120), anlik: o.anlik, oyun: o.oyun, sutun: c });
      bit.push(cv.bitti);
      sure += 120 + cv.sure;
    }
    return { node: g, bitti: Promise.all(bit), sure };
  }

  function cevapYaz(S, g, i, satir, o = {}) {
    const { L, K } = S, Z = sut(L, o.sutun), y = taban(L, L.ilk + i);
    const cg = svgEl('g', { class: 'cevap' }, g);
    return Object.assign(R.yaz(K, cg, cevapMetni(satir.arti, satir.eksi, L.hane), {
      x: Z.xC, y, boyut: Z.hC, renk: 'kirmizi', tohum: ['cevap', o.oyun || 0, o.sutun || 0, i, satir.arti, satir.eksi], gecikme: o.gecikme, anlik: o.anlik,
    }), { node: cg });
  }
  const satirGrubu = (S, i, c) => S.k.satirlar.querySelector(`.satir[data-i="${i}"][data-s="${c || 0}"]`);

  /* ---------- giriş satırı ---------- */

  // Kutuların yeri: j. kutunun solu ve genişliği (rakam kutunun ortasına yazılır)
  function kutuYeri(L, j, c) {
    const Z = sut(L, c), gw = R.genislik('0', Z.hT), adim = R.genislik('00', Z.hT) - gw;
    return { x: Z.x0 + j * adim, gw, adim, h: Z.hT };
  }
  function girisKatman(S, ad) {
    let g = S.k.giris.querySelector(`:scope > .${ad}`);
    if (!g) g = svgEl('g', { class: ad }, S.k.giris);
    return g;
  }

  // Sıradaki boş satırda hane kadar silik kurşun kutu. o: { i (satır), gecikme, anlik, oyun }
  function girisKutu(S, o) {
    const { L, K } = S, y = taban(L, L.ilk + o.i);
    const eski = S.k.giris.querySelector(':scope > .kutular');
    if (eski) eski.remove();
    const g = svgEl('g', { class: 'kutular', opacity: .62 }, S.k.giris);
    S.k.giris.insertBefore(g, S.k.giris.firstChild);
    const bit = [];
    for (let j = 0; j < L.hane; j++) {
      const { x, gw, adim, h } = kutuYeri(L, j, o.sutun), bw = adim * .84;
      bit.push(K.dikdortgen(g, [x + (gw - bw) / 2, y - h - .12 * L.s, bw, h + .22 * L.s],
        { stroke: renkDeger('kursun'), strokeWidth: 1.1, roughness: .7 }, ['kutu', o.oyun || 0, o.i, j],
        { anlik: o.anlik, gecikme: (o.gecikme || 0) + j * 60, sureMs: [90, 120], baski: false, yumusak: false }).bitti);
    }
    return { node: g, bitti: Promise.all(bit), sure: (L.hane - 1) * 60 + 120 };
  }

  // Girişe j. rakamı yazar (mavi). Silinen yere yeniden yazılırsa tohum değişsin diye o.sayac verilir.
  function girisRakam(S, o) {
    const { L, K } = S, y = taban(L, L.ilk + o.i), { x, gw, h: hT } = kutuYeri(L, o.j, o.sutun);
    const g = girisKatman(S, 'yazilan');
    const eski = g.querySelector(`[data-j="${o.j}"]`);
    if (eski) eski.remove();
    const h = svgEl('g', { 'data-j': o.j }, g);
    return R.ciz(K, h, o.ch, { x: x + (gw - R.genislik(o.ch, hT)) / 2, y, boyut: hT, renk: o.renk || 'mavi',
      tohum: ['giris', o.oyun || 0, o.i, o.j, o.ch, o.sayac || 0], gecikme: o.gecikme, anlik: o.anlik });
  }
  function girisSil(S, j, anlik) {
    const e = S.k.giris.querySelector(`:scope > .yazilan > [data-j="${j}"]`);
    return anlik ? (e && e.remove(), Promise.resolve()) : KL.soldur(e, 140);
  }
  // Giriş tamamlandı: yazılan rakamlar (grup) çıkarılıp döndürülür, kutular solar.
  function girisAl(S) {
    const g = S.k.giris.querySelector(':scope > .yazilan');
    const k = S.k.giris.querySelector(':scope > .kutular');
    if (k) KL.soldur(k, 260);
    if (g) { g.remove(); g.setAttribute('class', 'rakamlar'); }
    return g;
  }
  function girisTemizle(S) { S.k.giris.textContent = ''; }

  // Sıradaki kutunun altında yanıp sönen kısa mavi çizgi: "buraya yaz". j: kutu (hane'ye eşitse ya da null: gizlenir)
  function girisImlec(S, i, j, sutun) {
    const eski = S.k.giris.querySelector(':scope > .imlec');
    if (eski) eski.remove();
    const { L, K } = S;
    if (j == null || j >= L.hane) return;
    const { x, gw } = kutuYeri(L, j, sutun), y = taban(L, L.ilk + i) + .16 * L.s;
    const g = svgEl('g', { class: 'imlec' }, S.k.giris);
    K.cizgi(g, [x + gw * .1, y, x + gw * .9, y], { stroke: renkDeger('mavi'), strokeWidth: 2.2, roughness: .4 }, ['imlec', i, j], { anlik: true, baski: false, yumusak: false });
    if (KL.animasyonVar()) g.animate([{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: .1, offset: .7 }, { opacity: 1 }], { duration: 1100, iterations: Infinity });
  }

  // Bütün giriş satırı (yeniden çizim): kutular + yazılanlar. o: { i, yazilan, anlik, oyun }
  function girisCiz(S, o) {
    girisTemizle(S);
    const k = girisKutu(S, o);
    Array.from(o.yazilan || '').forEach((ch, j) => girisRakam(S, { i: o.i, j, ch, anlik: o.anlik, oyun: o.oyun, sutun: o.sutun, gecikme: (o.gecikme || 0) + j * 120 }));
    return k;
  }

  // İpucu: çözücünün önerisi giriş kutularına silik kurşun kalemle. Kabul edilince ui.js rakamları maviyle yeniden yazar.
  function ipucuGoster(S, i, dize, o = {}) {
    ipucuSil(S);
    const { L, K } = S, y = taban(L, L.ilk + i), g = girisKatman(S, 'ipucu');
    g.setAttribute('opacity', '.62');
    let gec = o.gecikme || 0;
    Array.from(dize).forEach((ch, j) => {
      const { x, gw } = kutuYeri(L, j);
      R.ciz(K, g, ch, { x: x + (gw - R.genislik(ch, L.hT)) / 2, y, boyut: L.hT, renk: 'kursun', kalinlik: 1.6,
        tohum: ['ipucu', i, j, ch], gecikme: gec, anlik: o.anlik, sure: 110 });
      gec += o.anlik ? 0 : 100;
    });
  }
  function ipucuSil(S) { const g = S.k.giris.querySelector(':scope > .ipucu'); if (g) g.remove(); }

  /* ---------- sonuç ---------- */

  // Bulununca: k. satıra sayı büyük mavi rakamlarla, yanına kırmızı tik; altına "6 tahmin · iyi" (kırmızı).
  // o: { sutun, boyut (yükseklik, varsayılan 1.2 satır), tik (false: tik yok, bulunamadı), ekle (öncekini silme), gecikme, anlik }
  function sonucYaz(S, k, dize, metin, o = {}) {
    const { L, K } = S, Z = sut(L, o.sutun), g = S.k.sonuc, y = taban(L, k), h = o.boyut || L.s * 1.2;
    if (!o.ekle) g.textContent = '';
    let gec = o.gecikme || 0;
    const a = R.yaz(K, g, dize, { x: Z.x0, y, boyut: h, renk: 'mavi', tohum: ['sonuc', o.oyun || 0, o.sutun || 0, dize], gecikme: gec, anlik: o.anlik, kalinlik: 3 });
    gec += o.anlik ? 0 : a.sure + 150;
    const bit = [a.bitti];
    if (o.tik !== false) {
      bit.push(R.ciz(K, g, 'tik', { x: Z.x0 + a.genislik + .4 * L.s, y: y - .05 * L.s, boyut: h * .95, renk: 'kirmizi', tohum: ['tik', o.oyun || 0, o.sutun || 0], gecikme: gec, anlik: o.anlik, sure: 220, kalinlik: 3 }).bitti);
      gec += o.anlik ? 0 : 260;
    }
    if (metin) {
      const m = metinSvg(g, metin, { x: Z.x0, y: taban(L, k + 1) - .14 * L.s, boyut: .5 * L.s, renk: 'kirmizi', hiza: 'start', tohum: ['sonuc-metin', metin], gecikme: gec, anlik: o.anlik });
      bit.push(m.bitti);
      gec += m.sure;
    }
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) };
  }

  // Oyun bitince "Yeni sayfa" sözcüğünün çevresine kırmızı kalemle halka; acik=false siler.
  function dugmeIsaretle(btn, acik, anlik = false) {
    const eski = btn.querySelector(':scope > svg.isaret');
    if (eski) eski.remove();
    if (!acik) return;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const svg = svgEl('svg', { class: 'isaret', 'aria-hidden': 'true', viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    btn.appendChild(svg);
    KL.kalemYap(svg).elips(svg, [w / 2, h * .55, w * 1.12, h * 1.05],
      { stroke: renkDeger('kirmizi'), strokeWidth: 1.7, roughness: 1.2 }, ['dugme-isaret', btn.id], { anlik, gecikme: anlik ? 0 : 400, sureMs: [320, 400] });
  }

  /* ---------- o bulsun: gizli sayı, düşünme notu, cevap sayaçları, çelişki ---------- */

  // Gizli sayı (k. satır): solda kurşun "sayım:" ya da "tutulan:", rakamlar mavi. karala: üstü kurşunla karalanır.
  // o.node: girişte yazılmış rakamlar (girisAl) — yeniden yazılmaz, buraya taşınır.
  // o.sutun: iki sütunlu oyunlarda her sütunun kendi gizli sayısı (yalnız o sütunun alt grubu silinir/yazılır).
  // o.etiket: null → etiket yok; o.soru: rakam yerine silik "????" (bilgisayarın sayısı).
  function gizliYaz(S, k, dize, o = {}) {
    const { L, K } = S, c = o.sutun || 0, Z = sut(L, c), y = taban(L, k);
    let g = S.k.gizliSayi.querySelector(`:scope > [data-s="${c}"]`);
    if (g) g.textContent = ''; else g = svgEl('g', { 'data-s': c }, S.k.gizliSayi);
    const et = o.etiket === null ? null : metinSvg(g, o.etiket || 'sayım:', { x: Z.noSag + .02 * L.s, y: y - .14 * L.s, boyut: .4 * L.s, renk: 'kursun', hiza: 'end', tohum: ['gizli-et', o.etiket || ''], anlik: true });
    if (o.soru) {
      const q = R.yaz(K, g, '?'.repeat(L.hane), { x: Z.x0, y, boyut: Z.hT * .8, renk: 'kursun', tohum: ['soru', c], anlik: o.anlik, gecikme: o.gecikme, kalinlik: 1.4 });
      return { bitti: q.bitti, sure: q.sure };
    }
    let r;
    if (o.node) { g.appendChild(o.node); r = { bitti: Promise.resolve(), sure: 0 }; }
    else r = R.yaz(K, g, dize, { x: Z.x0, y, boyut: Z.hT, renk: 'mavi', tohum: ['gizli', o.oyun || 0, c, dize], gecikme: o.gecikme, anlik: o.anlik });
    if (!o.karala) return { bitti: r.bitti, sure: r.sure, etiket: et };
    // Karalama: rakamların üstünden sıkı bir kurşun zikzak, üç geçiş
    const w = R.genislik('0'.repeat(dize.length), Z.hT), rr = rastgele('karala', o.oyun || 0, c);
    const bit = [r.bitti];
    let gec = (o.gecikme || 0) + (o.anlik ? 0 : r.sure + 150);
    for (let gecis = 0; gecis < 3; gecis++) {
      const pts = [], adet = Math.round(w / (L.s * (gecis === 2 ? .16 : .1)));
      for (let i = 0; i <= adet; i++) {
        pts.push([Z.x0 - .15 * L.s + (w + .3 * L.s) * i / adet + aralik(rr, -1.5, 1.5),
          y - (i % 2 ? Z.hT * [.05, .12, .3][gecis] : Z.hT * [1.02, .95, .75][gecis]) + aralik(rr, -1.5, 1.5)]);
      }
      bit.push(K.egri(g, pts, { stroke: renkDeger('kursun'), strokeWidth: 2.2, roughness: 1.1 }, ['karala', o.oyun || 0, c, gecis],
        { gecikme: gec, anlik: o.anlik, sureMs: [320, 400] }).bitti);
      gec += o.anlik ? 0 : 260;
    }
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) + 460 };
  }
  function gizliSil(S) { S.k.gizliSayi.textContent = ''; }

  // k. satıra not (kurşun ya da kırmızı). anahtar aynıysa eskisinin yerine yazılır. metin boşsa siler.
  function notSatir(S, anahtar, k, metin, o = {}) {
    const eski = S.k.notlar.querySelector(`[data-not="${anahtar}"]`);
    if (eski) eski.remove();
    if (!metin) return null;
    const { L } = S, g = svgEl('g', { 'data-not': anahtar }, S.k.notlar);
    return metinSvg(g, metin, { x: o.x ?? L.x0, y: taban(L, k) - .14 * L.s, boyut: (o.boyut || .48) * L.s, renk: o.renk || 'kursun',
      hiza: 'start', tohum: ['not', anahtar, metin], gecikme: o.gecikme, anlik: o.anlik });
  }
  function notlariSil(S) { S.k.notlar.textContent = ''; }

  // Cevap sayaçlarının yeri (i. satır): "+n" ve "−n" kutuları, "cevapla"nın solu
  function sayacYeri(L, i, c) {
    const Z = sut(L, c), y = taban(L, L.ilk + i), h = Z.hC, b = h / 14;
    const w = R.genislik('+0', h), x1 = Z.xC, x2 = Z.xC + R.genislik('+0 ', h) + R.ARALIK * b;
    return { y, h, arti: { x: x1, w }, eksi: { x: x2, w }, son: x2 + w };
  }
  // i. satırda kırmızı sayaçlar: her biri silik kurşun kutu içinde (dokunulacağı belli olsun). Değer değişince anında.
  function sayacCiz(S, i, arti, eksi, o = {}) {
    const { L, K } = S, g = S.k.sayac;
    g.textContent = '';
    const Y = sayacYeri(L, i, o.sutun), pad = .12 * L.s;
    const kutular = svgEl('g', { opacity: .45 }, g);
    for (const [ad, k] of [['arti', Y.arti], ['eksi', Y.eksi]]) {
      K.dikdortgen(kutular, [k.x - pad, Y.y - Y.h - pad * 1.2, k.w + 2 * pad, Y.h + pad * 2.2], { stroke: renkDeger('kursun'), strokeWidth: 1.1, roughness: .7 },
        ['sayac-kutu', i, ad], { anlik: true, baski: false, yumusak: false });
    }
    R.yaz(K, g, '+' + arti, { x: Y.arti.x, y: Y.y, boyut: Y.h, renk: 'kirmizi', tohum: ['sayac', i, 'a', arti], anlik: true });
    R.yaz(K, g, '-' + eksi, { x: Y.eksi.x, y: Y.y, boyut: Y.h, renk: 'kirmizi', tohum: ['sayac', i, 'e', eksi], anlik: true });
    if (o.olamaz) metinSvg(g, 'olamaz', { x: Y.son + .3 * L.s, y: Y.y + .45 * L.s, boyut: .34 * L.s, renk: 'kirmizi', hiza: 'start', tohum: ['olamaz'], anlik: true });
    return Y;
  }
  function sayacSil(S) { S.k.sayac.textContent = ''; }

  // i. satırın cevabını soldurur (düzeltilirken) ya da geri getirir; sil: kaldırır (yenisi yazılacak)
  function cevapDurum(S, i, durum, sutun) {
    const g = satirGrubu(S, i, sutun), c = g && g.querySelector(':scope > .cevap');
    if (!c) return;
    if (durum === 'sil') c.remove();
    else c.setAttribute('opacity', durum === 'soluk' ? '.18' : '1');
  }
  // Çelişkide şüpheli satırların cevabının altına kırmızı dalgalı çizgi. liste boşsa siler.
  function cevapAltiCiz(S, liste, o = {}) {
    const { L, K } = S, g = S.k.uyari;
    g.textContent = '';
    const Z = sut(L, o.sutun);
    liste.forEach((i, n) => {
      const y = taban(L, L.ilk + i) + .26 * L.s, w = R.genislik('+0 -0', Z.hC), r = rastgele('uyari', i);
      const pts = [0, .2, .4, .6, .8, 1].map((f, j) => [Z.xC - .1 * L.s + (w + .2 * L.s) * f, y + (j % 2 ? -.06 : .06) * L.s + aralik(r, -.5, .5)]);
      K.egri(g, pts, { stroke: renkDeger('kirmizi'), strokeWidth: 1.8, roughness: .8 }, ['uyari', i], { anlik: o.anlik, gecikme: (o.gecikme || 0) + n * 200, sureMs: [220, 260] });
    });
  }

  // İki sütunlu oyunda k. satıra sütun adları ("sen" / "o", "1. oyuncu" / "2. oyuncu"); sırası gelenin altı kırmızı çizili.
  function sutunAdlari(S, k, adlar, aktif, o = {}) {
    const { L, K } = S, g = S.k.sutunAdlari, y = taban(L, k);
    g.textContent = '';
    adlar.forEach((ad, c) => {
      const Z = sut(L, c);
      const m = metinSvg(g, ad, { x: Z.x0, y: y - .14 * L.s, boyut: .48 * L.s, renk: 'mavi', hiza: 'start', tohum: ['sutun-adi', ad], anlik: o.anlik, gecikme: o.gecikme });
      if (c === aktif) {
        const w = m.node.getComputedTextLength ? m.node.getComputedTextLength() : 2 * L.s;
        KL.altiCiz(K, g, Z.x0, Z.x0 + w, y + .02 * L.s, { tohum: ['sutun-alti', c, o.sayac || 0], ek: { stroke: renkDeger('kirmizi'), strokeWidth: 1.7 }, anlik: o.anlik, gecikme: o.gecikme, sureMs: [180, 220] });
      }
    });
  }

  /* ---------- rakam çizelgesi ---------- */

  const hucreX = (L, d) => L.cizelge.x + d * L.cizelge.hucre;
  const cizelgeTaban = (L) => taban(L, L.cizelge.k);

  function cizelgeCiz(S, o = {}) {
    const { L, K } = S, g = S.k.cizelge;
    g.textContent = '';
    const y = cizelgeTaban(L), c = L.cizelge, w = R.genislik('0', c.h);
    const bit = [];
    for (let d = 0; d < 10; d++) {
      const ch = String(d), x = hucreX(L, d) + (c.hucre - R.genislik(ch, c.h)) / 2;
      bit.push(R.ciz(K, g, ch, { x, y, boyut: c.h, renk: 'mavi', tohum: ['cizelge', d], gecikme: (o.gecikme || 0) + d * 70, anlik: o.anlik, sure: 130 }).bitti);
    }
    return { bitti: Promise.all(bit), sure: 9 * 70 + 130, genislik: w };
  }

  // Elle işaret: 'var' kırmızı daire · 'yok' kırmızı çarpı · 'soru' rakamın sağ üstünde kırmızı soru · null sil.
  // Otomatik işaret (oto: true): aynı biçim, silik kurşun, ince; ayrı katmanda, elle olanın ALTINDA.
  function cizelgeIsaret(S, d, durum, o = {}) {
    const { L, K } = S, c = L.cizelge, katman = o.oto ? S.k.cizelgeOto : S.k.cizelgeElle;
    const anahtar = durum === 'yer' ? d + 'y' : String(d);   // yer işareti dairenin yanında ayrı durur
    const eski = katman.querySelector(`[data-d="${anahtar}"]`);
    if (eski) eski.remove();
    if (!durum) return { bitti: Promise.resolve(), sure: 0 };
    const g = svgEl('g', { 'data-d': anahtar, class: durum }, katman);
    const y = cizelgeTaban(L), cx = hucreX(L, d) + c.hucre / 2, cy = y - c.h / 2;
    const r = rastgele('isaret', d, durum, o.sayac || 0);
    const ek = o.oto ? { stroke: renkDeger('kursun'), strokeWidth: 1.2, roughness: .6 } : { stroke: renkDeger('kirmizi'), strokeWidth: 1.9, roughness: .7 };
    const an = ['isaret', o.oto ? 'oto' : 'elle', d, durum, o.sayac || 0];
    const oo = { gecikme: o.gecikme, anlik: o.anlik, sureMs: [160, 200], baski: !o.oto };
    let s;
    if (durum === 'var') {
      const w = c.hucre * (o.oto ? 1.02 : .95), h = c.h * (o.oto ? 1.55 : 1.45);
      s = K.elips(g, [cx + aralik(r, -.6, .6), cy + aralik(r, -.6, .6), w, h], ek, an, oo);
    } else if (durum === 'yok') {
      const a = c.hucre * .44, b = c.h * .62;
      const s1 = K.cizgi(g, [cx - a, cy - b, cx + a, cy + b], ek, [...an, 1], oo);
      s = K.cizgi(g, [cx + a, cy - b, cx - a, cy + b], ek, [...an, 2], Object.assign({}, oo, { gecikme: (o.gecikme || 0) + (o.anlik ? 0 : s1.sure) }));
      s = { bitti: Promise.all([s1.bitti, s.bitti]), sure: s1.sure + s.sure };
    } else if (durum === 'soru') {
      s = R.ciz(K, g, '?', { x: cx + c.hucre * .26, y: cy - c.h * .05, boyut: c.h * .62, renk: o.oto ? 'kursun' : 'kirmizi', tohum: an, gecikme: o.gecikme, anlik: o.anlik, kalinlik: o.oto ? 1.2 : 1.7 });
    } else if (durum === 'yer') {                           // yalnız otomatik: yeri kesin rakamın altında küçük konum
      s = R.ciz(K, g, String(o.yer), { x: cx - R.genislik(String(o.yer), c.h * .5) / 2, y: y + c.h * .62, boyut: c.h * .5, renk: 'kursun', tohum: an, gecikme: o.gecikme, anlik: o.anlik, kalinlik: 1.1 });
    }
    return s;
  }

  // Otomatik çıkarımı silik işaretlere çevirir. cik: { var: [d], yok: [d], yer: { d: konum (1'den) } } | null (hepsini sil)
  function cizelgeOto(S, cik, o = {}) {
    S.k.cizelgeOto.textContent = '';
    if (!cik) return;
    for (const d of cik.var) cizelgeIsaret(S, d, 'var', { oto: true, anlik: o.anlik });
    for (const d of cik.yok) cizelgeIsaret(S, d, 'yok', { oto: true, anlik: o.anlik });
    for (const [d, p] of Object.entries(cik.yer || {})) cizelgeIsaret(S, Number(d), 'yer', { oto: true, anlik: o.anlik, yer: p });
  }

  /* ---------- kalan aday notu ---------- */

  // "kalan: 1155 441 33 9": son sayı dışındakilerin üstü kırmızı kalemle çizili. liste: kalan sayıları (eskiden yeniye).
  // o.yeni: yalnız son sayı kalemle yazılır, bir önceki çizilir (her cevaptan sonra).
  function kalanYaz(S, liste, o = {}) {
    const { L, K } = S, g = S.k.kalan;
    g.textContent = '';
    if (!liste || !liste.length) return { bitti: Promise.resolve(), sure: 0 };
    const y = taban(L, L.kalanK), h = L.s * .42, anlik = !!o.anlik;
    const et = metinSvg(g, 'kalan:', { x: L.x0, y: y - .12 * L.s, boyut: .46 * L.s, renk: 'kirmizi', hiza: 'start', tohum: ['kalan-et'], anlik: anlik || !!o.yeni });
    let x = L.x0 + (et.node.getComputedTextLength ? et.node.getComputedTextLength() : 1.6 * L.s) + .3 * L.s;
    // Satıra sığmayan en eski sayılar atlanır (en yeniler kalır)
    const bosluk = L.W - .5 * L.s - x;
    let bas = liste.length, w = 0;
    while (bas > 0 && w + R.genislik(String(liste[bas - 1]), h) + .35 * L.s <= bosluk) { bas--; w += R.genislik(String(liste[bas]), h) + .35 * L.s; }
    const ilk = Math.min(bas, liste.length - 1);
    const bit = [];
    let gec = (o.gecikme || 0) + (o.yeni && !anlik ? 200 : 0);   // yeni sayı, eskisinin üstü çizildikten sonra
    liste.forEach((n, i) => {
      if (i < ilk) return;
      const metin = String(n), son = i === liste.length - 1;
      const yazAnlik = anlik || (o.yeni && !son);
      const w = R.yaz(K, g, metin, { x, y, boyut: h, renk: 'kirmizi', tohum: ['kalan', i, metin], gecikme: gec, anlik: yazAnlik, sure: 120 });
      bit.push(w.bitti);
      if (!yazAnlik) gec += w.sure;
      if (!son) {
        const ciz = anlik || (o.yeni && i < liste.length - 2);
        const r = rastgele('ustu', i, metin);
        const c = K.cizgi(g, [x - .1 * L.s, y - h * .42 + aralik(r, -1, 1), x + w.genislik + .1 * L.s, y - h * .55 + aralik(r, -1, 1)],
          { stroke: renkDeger('kirmizi'), strokeWidth: 1.8, roughness: .8 }, ['ustu', i, metin], { anlik: ciz, gecikme: o.yeni ? (o.gecikme || 0) : gec, sureMs: [150, 180] });
        bit.push(c.bitti);
      }
      x += w.genislik + .35 * L.s;
    });
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) };
  }

  SB.draw = {
    yerlesim, taban, sahneKur, baslikYaz, satirYaz, cevapYaz, cevapMetni,
    girisKutu, girisRakam, girisSil, girisAl, girisTemizle, girisCiz, girisImlec, ipucuGoster, ipucuSil, kutuYeri,
    cizelgeCiz, cizelgeIsaret, cizelgeOto, kalanYaz, sonucYaz, dugmeIsaretle, hucreX,
    gizliYaz, gizliSil, notSatir, notlariSil, sayacYeri, sayacCiz, sayacSil, cevapDurum, cevapAltiCiz,
    sut, satirGrubu, sutunAdlari,
  };
})();
