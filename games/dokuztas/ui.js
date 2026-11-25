// ui.js — kontrolör: ölçü, font, sahne ve oyun akışı. Kurallar board.js'te (DOM'suz), bilgisayar ai.js'te,
// çizim draw.js ve kit/ altında; burada yalnız onları birbirine bağlarız.
//
// Sahne modeli: 18 taşın her birinin kalıcı kimliği var (k0–k8 koyu, b0–b8 beyaz; kimlik taşın şeklini belirler).
// model = { nokta[24]: kimlik|null, el: [[...], [...]] (tepside bekleyenler), alinan: [[...], [...]] (p'nin aldıkları) }.
// Her değişiklikten sonra taslariEsitle() taşları modeldeki yerlerine kaydırır; değirmen çizgileri durumdan türetilir.
(function () {
  'use strict';

  const DT = window.DT, Kit = window.Kit;
  const C = DT.config, D = DT.draw, Lay = DT.layout, BD = DT.board, KL = Kit.kalem;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const Ses = Kit.ses ? Kit.ses.kur({ anahtar: 'dt-sessiz' }) : { cal() {}, baslat() {}, sessiz: false, sessizYap() {}, durdur() {} };

  // jeton: süren akışın kimliği; yeni oyun / geri alma artırır, bekleyen adımlar jeton değişmişse sessizce çıkar.
  // kilit: animasyon ve rakip sırası boyunca dokunmayı engeller; ilk await'ten ÖNCE eşzamanlı kurulur.
  const O = {
    jeton: 0, l: null, S: null,
    durum: null, model: null, gecmis: [],
    kilit: true, secili: -1, bekleyen: null, surukle: null, tikYoksay: false,
    ayar: null, oyunAyar: null, ayarlarAcik: false,
    aiKontrol: null, ipucuSayisi: 0, ipucu: null, gosteri: null,
    cizilen: new Map(),            // 'k:sahip' → { node, noktalar } (çizili değirmenler)
    baslayan: 0, ilkBaslayan: 0, sonDurum: '', sonEvre: 0,
  };

  /* ---------- saklama (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const bellek = {};
  function depoOku(ad) { try { const s = localStorage.getItem(ad); return s ? JSON.parse(s) : bellek[ad]; } catch (e) { return bellek[ad]; } }
  function depoYaz(ad, v) { bellek[ad] = v; try { localStorage.setItem(ad, JSON.stringify(v)); } catch (e) { /* yoksay */ } }

  function ayarlariYukle() {
    O.ayar = { zorluk: C.zorluk, ikiKisi: C.ikiKisi, tasSeti: C.tasSeti, ucma: C.kurallar.ucma, notasyon: C.notasyon };
    const k = depoOku('dt-ayar');
    if (k && typeof k === 'object') {
      if (['kolay', 'orta', 'zor'].includes(k.zorluk)) O.ayar.zorluk = k.zorluk;
      if (['cakil', 'fasulye'].includes(k.tasSeti)) O.ayar.tasSeti = k.tasSeti;
      for (const ad of ['ikiKisi', 'ucma', 'notasyon']) if (typeof k[ad] === 'boolean') O.ayar[ad] = k[ad];
    }
    const b = depoOku('dt-baslayan');
    O.baslayan = b === 1 ? 1 : 0;
  }

  /* ---------- yardımcılar ---------- */

  const iki = () => !!(O.oyunAyar && O.oyunAyar.ikiKisi);
  const insanSirasi = () => !O.gosteri && !O.durum.bitti && (iki() || O.durum.sira === 0);
  const kurallar = () => Object.assign({}, C.kurallar, { ucma: O.oyunAyar.ucma });
  const adi = (p) => (iki() || O.gosteri ? (p === 0 ? 'koyu' : 'beyaz') : (p === 0 ? 'sen' : 'bilgisayar'));
  const Adi = (p) => { const a = adi(p); return a[0].toLocaleUpperCase('tr') + a.slice(1); };

  /* ---------- sahne modeli ---------- */

  function yeniModel() {
    return {
      nokta: Array(24).fill(null),
      el: [Array.from({ length: 9 }, (_, k) => 'k' + k), Array.from({ length: 9 }, (_, k) => 'b' + k)],
      alinan: [[], []],
    };
  }
  const modelKopya = (m) => ({ nokta: m.nokta.slice(), el: m.el.map(l => l.slice()), alinan: m.alinan.map(l => l.slice()) });

  // Hamlenin taşı koyma/oynatma kısmı (alma ayrı)
  function modelTasi(m, h, p) {
    if (h.kaynak < 0) m.nokta[h.hedef] = m.el[p].pop();
    else { m.nokta[h.hedef] = m.nokta[h.kaynak]; m.nokta[h.kaynak] = null; }
  }
  function modelAl(m, h, p) {
    for (const a of [h.al, h.al2]) if (a >= 0) { m.alinan[p].push(m.nokta[a]); m.nokta[a] = null; }
  }

  // Taşın modeldeki yeri: { x, y, olcek } (SVG birimi)
  function tasYeri(id) {
    const m = O.model, l = O.l;
    const i = m.nokta.indexOf(id);
    if (i >= 0) { const [x, y] = D.yer(l, i); return { x, y, olcek: 1 }; }
    for (let p = 0; p < 2; p++) {
      const k = m.el[p].indexOf(id);
      if (k >= 0) { const [x, y] = D.elYeri(l, p, k); return { x, y, olcek: l.tepsi.el[p].olcek }; }
      const a = m.alinan[p].indexOf(id);
      if (a >= 0) { const [x, y] = D.alinanYeri(l, p, a); return { x, y, olcek: l.tepsi.alinan[p].olcek }; }
    }
    return null;
  }

  const butunTaslar = () => [...Array.from({ length: 9 }, (_, k) => 'k' + k), ...Array.from({ length: 9 }, (_, k) => 'b' + k)];

  // Bütün taşları modeldeki yerlerine getirir (değişenler kayar). Dönen söz: hepsi oturdu.
  // (x, y) bir tahta noktasında mı (SVG birimi)
  function noktada(x, y) {
    for (let i = 0; i < 24; i++) { const [px, py] = D.yer(O.l, i); if (Math.abs(px - x) < 1 && Math.abs(py - y) < 4) return true; }
    return false;
  }

  // Ses: tepsiden tahtaya konan ya da alınıp yığına düşen taş "tas"; tahtada kayan taş "kayma"; tepsiye dönenler tek "kayma".
  function taslariEsitle(anlik) {
    const S = O.S, isler = [];
    let donen = 0;
    for (const id of butunTaslar()) {
      const y = tasYeri(id);
      let t = S.taslar.get(id);
      if (!t) { D.tasEkle(S, id, id[0] === 'k' ? 0 : 1, y.x, y.y, { olcek: y.olcek }); continue; }
      const degisti = Math.abs(t.x - y.x) > .5 || Math.abs(t.y - y.y) > .5 || Math.abs(t.olcek - y.olcek) > .01 || t.kalkik;
      if (!degisti) continue;
      if (anlik) { D.tasKonumla(t, y.x, y.y, { olcek: y.olcek, kalkik: false }); continue; }
      const tahtadan = noktada(t.x, t.y), tahtaya = O.model.nokta.includes(id);
      const yigina = O.model.alinan.some(l => l.includes(id));
      let varis = null;
      if (tahtaya && !tahtadan) varis = () => Ses.cal('tas');
      else if (yigina) varis = () => Ses.cal('tas', 0, 'yigin');
      else if (tahtaya && tahtadan) Ses.cal('kayma');
      else donen++;
      isler.push(D.tasKay(S, t, y.x, y.y, { olcek: y.olcek, varis }));
    }
    if (donen) Ses.cal('kayma');
    return Promise.all(isler);
  }

  // Değirmen çizgilerini verilen taş kümelerine eşitler: yeni kurulan çizilir, bozulan silgiyle silinir.
  function degirmenleriEsitle(d, anlik) {
    const S = O.S, istenen = new Map();
    for (const x of BD.kuruluDegirmenler(d)) istenen.set(x.k + ':' + x.sahip, x);
    const isler = [];
    for (const [ad, c] of O.cizilen) {
      if (istenen.has(ad)) continue;
      if (anlik) c.node.remove(); else { D.degirmenSil(S, c.node, c.noktalar); Ses.cal('kayma', 0, 'silgi'); }
      O.cizilen.delete(ad);
    }
    for (const [ad, x] of istenen) {
      if (O.cizilen.has(ad)) continue;
      if (!anlik) Ses.cal('grafit', 0, 250);
      const c = D.degirmenCiz(S, x.hat, { anlik });
      O.cizilen.set(ad, { node: c.node, noktalar: c.noktalar });
      isler.push(c.bitti);
    }
    return Promise.all(isler);
  }

  /* ---------- ölçü ve sahne ---------- */

  function olcuHesapla() {
    const { vw, vh } = KL.alan();
    const l = Lay.hesapla(vw, vh);
    const st = document.documentElement.style;
    st.setProperty('--sq', l.sq + 'px');
    st.setProperty('--W', l.W);
    st.setProperty('--H', l.H);
    st.setProperty('--marj-kare', l.marjX);
    for (const [ad, k] of [['k', l.komutlar]]) {
      st.setProperty(`--${ad}x`, k.x); st.setProperty(`--${ad}y`, k.y); st.setProperty(`--${ad}w`, k.w);
    }
    st.setProperty('--tx', l.tahta.x + 6);
    st.setProperty('--nx', l.mod === 'defter' ? l.tahta.x - .4 : .6);
    st.setProperty('--ny', l.tahta.y + .4);
    st.setProperty('--nw', l.mod === 'defter' ? 12.8 : 13.8);
    st.setProperty('--ty', l.tahta.y + 7.35);
    document.body.dataset.duzen = l.mod;
    const onceki = O.l;
    O.l = l;
    return { modDegisti: !onceki || onceki.mod !== l.mod || onceki.H !== l.H, sqDegisti: !onceki || onceki.sq !== l.sq };
  }

  function noktaDugmeleri() {
    const kap = $('#noktalar');
    kap.textContent = '';
    for (let i = 0; i < 24; i++) {
      const [gx, gy] = D.izgara(i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nokta';
      b.dataset.i = i;
      b.style.left = `calc(var(--sq) * ${O.l.tahta.x + 2 * gx})`;
      b.style.top = `calc(var(--sq) * ${O.l.tahta.y + 2 * gy})`;
      kap.appendChild(b);
    }
    noktaEtiketleri();
  }

  function noktaEtiketleri() {
    if (!O.durum) return;
    $$('#noktalar .nokta').forEach(b => {
      const i = +b.dataset.i, ad = BD.NOTASYON[i];
      const p = O.durum.tas[0] & (1 << i) ? 0 : O.durum.tas[1] & (1 << i) ? 1 : -1;
      const kim = p < 0 ? 'boş' : iki() || O.gosteri ? `${adi(p)} taş` : (p === 0 ? 'senin taşın' : 'bilgisayarın taşı');
      b.setAttribute('aria-label', `${ad}: ${kim}`);
      b.setAttribute('aria-pressed', String(O.secili === i));
    });
    imlecSiniflari();
  }

  // Fare imleci: oynatılabilir kendi taşında "tut", gidilebilir/konulabilir noktada kalem
  function imlecSiniflari() {
    const d = O.durum, insan = !O.kilit && insanSirasi() && !O.bekleyen;
    const l = insan ? yasal() : [];
    const kaynak = new Set(l.filter(m => m.kaynak >= 0).map(m => m.kaynak));
    const hedef = new Set(l.filter(m => m.kaynak < 0 || m.kaynak === O.secili).map(m => m.hedef));
    const aday = new Set(adaylar());
    $$('#noktalar .nokta').forEach(b => {
      const i = +b.dataset.i;
      b.classList.toggle('oynar', kaynak.has(i));
      b.classList.toggle('konur', hedef.has(i) || aday.has(i));
    });
  }

  // Sahneyi baştan kurar (ilk açılış, düzen değişimi, taş seti değişimi): kâğıt çizimleri + durumdan taşlar ve işaretler.
  // yeniSayfa: sayfa çevrildikten sonra (tahta önce, başlık ardından; daha kısa kademe)
  function sahneCiz(anlik, yeniSayfa = false) {
    const l = O.l;
    const S = O.S = D.sahneKur($('#kagit'), $('#nesneler'), l, 'defter');
    S.tasSeti = O.ayar.tasSeti;
    const g0 = anlik ? 0 : 1;
    D.yapimCiz(S);
    D.baslikCiz(S, 'DOKUZ TAŞ', { anlik, kalinlik: l.mod === 'defter' ? 2.4 : 2, gecikme: yeniSayfa ? 900 * g0 : 0 });
    D.tahtaCiz(S, { anlik, gecikme: (yeniSayfa ? 250 : 500) * g0, kosegen: C.kurallar.kosegen });
    D.noktalarCiz(S, { anlik, gecikme: (yeniSayfa ? 1300 : 1900) * g0 });
    D.notasyonCiz(S, O.ayar.notasyon);
    tepsiEtiketleri(anlik);
    O.sonDurum = ''; O.sonEvre = 0;
    O.cizilen.clear();
    noktaDugmeleri();
    if (!O.durum) return;
    taslariEsitle(true);
    if (O.bekleyen) {
      degirmenleriEsitle(O.bekleyen.ara, true);
      for (const a of adaylar()) D.adayCiz(S, a, { anlik: true });
    } else degirmenleriEsitle(O.durum, true);
    if (O.secili >= 0) { const s = O.secili; O.secili = -1; secimYap(s); }
    D.ipucuCetele(S, O.ipucuSayisi);
    if (O.durum.bitti && !O.gosteri) D.sonucYaz(S, sonucBasligi(), { anlik: true });
    evreGuncelle(true);
    durumGoster(true);
  }

  function tepsiEtiketleri(anlik) {
    D.tepsiCiz(O.S, [adi(0), adi(1)], { anlik });
  }

  /* ---------- durum göstergeleri ---------- */

  function durumMetni() {
    const d = O.durum;
    if (O.gosteri) return [O.gosteri.metin || 'kendi kendine oynuyor', 'ana'];
    if (d.bitti) return [bitisNedeni(), 'vurgu'];
    if (O.bekleyen) return ['Değirmen! Bir taş al', 'vurgu'];
    if (iki()) return [`Sıra: ${adi(d.sira)}`, 'ana'];
    return d.sira === 0 ? ['Sıra sende', 'ana'] : ['Bilgisayar düşünüyor', 'ana'];
  }

  function durumGoster(zorla) {
    const [t, renk] = durumMetni();
    if (t === O.sonDurum && !zorla) return;
    O.sonDurum = t;
    D.durumYaz(O.S, t, { renk });
    $('#duyuru').textContent = t;
  }

  function evreGuncelle(zorla) {
    const e = BD.evre(O.durum);
    if (e === O.sonEvre && !zorla) return;
    O.sonEvre = e;
    D.evreYaz(O.S, e, { anlik: !!zorla });
  }

  function kilitle(v) {
    O.kilit = v;
    if (v && O.S) D.onizlemeSil(O.S);
    $('#noktalar').classList.toggle('etkin', !v && insanSirasi());
    $('#geri-al').disabled = O.gecis || (!O.bekleyen && !O.gecmis.length);
    if (O.durum) imlecSiniflari();
  }

  /* ---------- seçim ve işaretler ---------- */

  const yasal = () => BD.hamleler(O.durum);

  function secimYap(i) {
    secimBirak();
    const id = O.model.nokta[i], t = id && O.S.taslar.get(id);
    if (!t) return;
    O.secili = i;
    D.tasKonumla(t, t.x, t.y, { kalkik: true });
    const hedefler = new Set(yasal().filter(m => m.kaynak === i).map(m => m.hedef));
    for (const h of hedefler) D.hedefCiz(O.S, h);
    noktaEtiketleri();
  }

  function secimBirak() {
    if (O.secili >= 0) {
      const id = O.model.nokta[O.secili], t = id && O.S.taslar.get(id);
      if (t && !t.hareketNo) D.tasKonumla(t, t.x, t.y, { kalkik: false });
      else if (t) { const y = tasYeri(id); D.tasKay(O.S, t, y.x, y.y, { otur: false }); }
    }
    O.secili = -1;
    D.isaretleriSil(O.S, 'hedef');
    noktaEtiketleri();
  }

  // Bekleyen alma: henüz seçilmemiş alınabilir taşlar
  function adaylar() {
    const b = O.bekleyen;
    if (!b) return [];
    const kume = new Set();
    for (const m of b.hamleler) {
      const al = [m.al, m.al2].filter(a => a >= 0);
      if (b.secilen.every(s => al.includes(s))) for (const a of al) if (!b.secilen.includes(a)) kume.add(a);
    }
    return [...kume];
  }

  function ipucuKaldir() {
    if (O.ipucu) { D.ipucuSil(O.S); O.ipucu = null; }
  }

  /* ---------- hamle ---------- */

  // Bir hamleyi sahnede oynar ve durumu ilerletir. gosterildi: insanın değirmen kuran hamlesinde taş zaten yerinde ve
  // değirmen çizgisi zaten çizili (yalnız alma kalır). false dönerse akış arada değişmiştir; çağıran çıkmalı.
  async function hamleOyna(h, j, gosterildi = false) {
    const once = O.durum, p = once.sira;
    const yeni = BD.uygula(once, h);
    O.durum = yeni;
    noktaEtiketleri();
    $('#duyuru').textContent = `${Adi(p)}: ${BD.hamleYazi(h)}`;
    if (!gosterildi) {
      modelTasi(O.model, h, p);
      await taslariEsitle();
      if (j !== O.jeton) return false;
      const ara = { tas: yeni.tas.slice(), kurallar: yeni.kurallar };
      for (const a of [h.al, h.al2]) if (a >= 0) ara.tas[1 - p] |= 1 << a;
      await degirmenleriEsitle(ara);
      if (j !== O.jeton) return false;
      if (h.al >= 0) {
        await KL.bekle(O.gosteri ? 500 : 280);
        if (j !== O.jeton) return false;
      }
    }
    if (h.al >= 0) {
      modelAl(O.model, h, p);
      await taslariEsitle();
      if (j !== O.jeton) return false;
    }
    degirmenleriEsitle(yeni);
    evreGuncelle();
    return true;
  }

  // Hamle bittikten sonra: oyun bittiyse sonuç; sıra bilgisayardaysa o oynasın; yoksa kilit açılır.
  async function sirayiIlerlet(j) {
    for (;;) {
      if (O.durum.bitti) { bitir(); return; }
      if (insanSirasi()) break;
      if (!(await rakipOyna(j))) return;
    }
    durumGoster();
    evreGuncelle();
    kilitle(false);
  }

  function hataYakala(e, j) {
    if (j !== O.jeton || (e && e.name === 'AbortError')) return;
    console.error(e);
    O.sonDurum = '';
    D.durumYaz(O.S, 'aksilik oldu · geri al', { renk: 'vurgu' });
    kilitle(false);
  }

  // İnsanın tam hamlesi (alma seçimi dahil) — geçmişe kaydedilir.
  async function insanHamlesi(h, j, gosterildi, onceModel) {
    O.gecmis.push({ durum: O.durum, model: onceModel || modelKopya(O.model) });
    O.bekleyen = null;
    D.isaretleriSil(O.S, 'aday');
    kilitle(true);
    try {
      if (!(await hamleOyna(h, j, gosterildi))) return;
      await sirayiIlerlet(j);
    } catch (e) { hataYakala(e, j); }
  }

  // Değirmen kuran insan hamlesi: taş yerine konur, çizgi çizilir, alınabilecek taşlar kırmızıyla işaretlenir.
  async function almayaGec(kaynak, hedef, liste, j) {
    const onceModel = modelKopya(O.model), p = O.durum.sira;
    kilitle(true);
    modelTasi(O.model, { kaynak, hedef }, p);
    await taslariEsitle();
    if (j !== O.jeton) return;
    const tas = O.durum.tas.slice();
    if (kaynak >= 0) tas[p] &= ~(1 << kaynak);
    tas[p] |= 1 << hedef;
    const ara = { tas, kurallar: O.durum.kurallar };
    O.bekleyen = { kaynak, hedef, hamleler: liste, secilen: [], onceModel, ara };
    await degirmenleriEsitle(ara);
    if (j !== O.jeton) return;
    for (const a of adaylar()) D.adayCiz(O.S, a);
    durumGoster();
    kilitle(false);
  }

  function bekleyeniIptal() {
    const b = O.bekleyen;
    if (!b) return;
    O.bekleyen = null;
    O.model = b.onceModel;
    D.isaretleriSil(O.S, 'aday');
    taslariEsitle();
    degirmenleriEsitle(O.durum);
    durumGoster();
    kilitle(false);
  }

  function noktaTik(i) {
    if (O.tikYoksay) return;
    D.onizlemeSil(O.S);
    if (O.gosteri) { gosteriDurdur(); return; }
    if (O.kilit || !insanSirasi()) return;
    ipucuKaldir();
    const j = O.jeton, d = O.durum, p = d.sira, l = yasal();
    if (O.bekleyen) {
      const b = O.bekleyen;
      if (!adaylar().includes(i)) return;
      b.secilen.push(i);
      const tam = b.hamleler.filter(m => { const al = [m.al, m.al2].filter(a => a >= 0); return al.length === b.secilen.length && b.secilen.every(s => al.includes(s)); });
      if (tam.length) { insanHamlesi(tam[0], j, true, b.onceModel); return; }
      D.isaretleriSil(O.S, 'aday');
      for (const a of adaylar()) D.adayCiz(O.S, a, { anlik: true });
      return;
    }
    if (BD.evre(d) === 1) {
      const liste = l.filter(m => m.hedef === i);
      if (!liste.length) return;
      if (liste[0].al < 0) insanHamlesi(liste[0], j);
      else almayaGec(-1, i, liste, j);
      return;
    }
    const kendi = d.tas[p] & (1 << i);
    if (kendi) {
      if (O.secili === i) { secimBirak(); return; }
      if (l.some(m => m.kaynak === i)) secimYap(i);
      return;
    }
    if (O.secili < 0) return;
    hareketEt(O.secili, i, j);
  }

  function hareketEt(kaynak, hedef, j) {
    const liste = yasal().filter(m => m.kaynak === kaynak && m.hedef === hedef);
    if (!liste.length) { secimBirak(); return false; }
    O.secili = -1;
    D.isaretleriSil(O.S, 'hedef');
    if (liste[0].al < 0) insanHamlesi(liste[0], j);
    else almayaGec(kaynak, hedef, liste, j);
    return true;
  }

  /* ---------- sürükle-bırak ---------- */

  function svgNoktasi(cx, cy) {
    const svg = $('#nesneler'), pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function surukleBasla(e) {
    const b = e.target.closest && e.target.closest('.nokta');
    if (!b || O.kilit || O.bekleyen || !insanSirasi() || BD.evre(O.durum) === 1) return;
    const i = +b.dataset.i, d = O.durum;
    if (!(d.tas[d.sira] & (1 << i)) || !yasal().some(m => m.kaynak === i)) return;
    O.surukle = { i, x0: e.clientX, y0: e.clientY, basladi: false, id: e.pointerId, b };
    try { b.setPointerCapture(e.pointerId); } catch (er) { /* yoksay */ }
  }

  function surukleHareket(e) {
    const s = O.surukle;
    if (!s || e.pointerId !== s.id) return;
    if (!s.basladi) {
      if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < 6) return;
      s.basladi = true;
      if (O.secili !== s.i) secimYap(s.i);
      const t = O.S.taslar.get(O.model.nokta[s.i]);
      O.S.n.tasinan.appendChild(t.g);
      t.hareketNo = (t.hareketNo || 0) + 1;
    }
    e.preventDefault();
    // Taş parmağın biraz üstünde gider: parmağın altında kaybolmaz
    const yukari = e.pointerType === 'mouse' ? 0 : 26;
    const p = svgNoktasi(e.clientX, e.clientY - yukari);
    const t = O.S.taslar.get(O.model.nokta[s.i]);
    D.tasKonumla(t, p.x, p.y, { kalkik: true });
  }

  function surukleBitir(e, iptal) {
    const s = O.surukle;
    if (!s || e.pointerId !== s.id) return;
    O.surukle = null;
    if (!s.basladi) return;
    O.tikYoksay = true;
    setTimeout(() => { O.tikYoksay = false; }, 0);
    const t = O.S.taslar.get(O.model.nokta[s.i]);
    let hedef = -1, en = O.l.sq ? 20 : 0;
    if (!iptal) {
      for (const m of yasal()) {
        if (m.kaynak !== s.i) continue;
        const [x, y] = D.yer(O.l, m.hedef), u = Math.hypot(x - t.x, y - t.y);
        if (u <= en) { en = u; hedef = m.hedef; }
      }
    }
    if (hedef >= 0) hareketEt(s.i, hedef, O.jeton);
    else {
      const [x, y] = D.yer(O.l, s.i);
      D.tasKay(O.S, t, x, y, { otur: false, sure: 180 }).then(() => { if (O.secili === s.i) D.tasKonumla(t, x, y, { kalkik: true }); });
    }
  }

  /* ---------- bilgisayar ---------- */

  // Bilgisayarın hamlesi: ai.js varsa onun seçimi, yoksa (Faz 3) almayı tercih eden rastgele hamle.
  async function rakipSec(d, zorluk, signal, butceMs) {
    if (DT.ai) return (await DT.ai.dusun(d, Object.assign({ zorluk }, C.ai[zorluk], { butceMs }), { signal })).hamle;
    const l = BD.hamleler(d), al = l.filter(m => m.al >= 0);
    const havuz = al.length ? al : l;
    return havuz[Math.floor(Math.random() * havuz.length)];
  }

  async function rakipOyna(j) {
    durumGoster();
    const zorluk = O.gosteri ? 'orta' : O.oyunAyar.zorluk;
    const butce = O.gosteri ? 300 : C.ai[zorluk].butceMs;
    const [a, b] = C.ai.enAzBekleMs, enAz = O.gosteri ? 1100 : a + Math.random() * (b - a);
    D.dusunmeCiz(O.S, { sureMs: Math.max(enAz, butce) });
    const t0 = performance.now();
    await KL.bekle(30);
    if (j !== O.jeton) return false;
    const kontrol = new AbortController();
    O.aiKontrol = kontrol;
    let h;
    try { h = await rakipSec(O.durum, zorluk, kontrol.signal, butce); }
    finally { if (O.aiKontrol === kontrol) O.aiKontrol = null; }
    if (j !== O.jeton) return false;
    await KL.bekle(Math.max(0, enAz - (performance.now() - t0)));
    if (j !== O.jeton) return false;
    D.dusunmeSil(O.S);
    if (O.gosteri) gosteriAcikla(h, O.durum);
    return hamleOyna(h, j);
  }

  /* ---------- oyun sonu ---------- */

  function sonucBasligi() {
    const k = O.durum.bitti.kazanan;
    if (k === null) return 'Berabere';
    if (iki() || O.gosteri) return k === 0 ? 'Koyu kazandı' : 'Beyaz kazandı';
    return k === 0 ? 'Kazandın' : 'Kaybettin';
  }

  const IYELIK = { sen: 'Senin', bilgisayar: 'Bilgisayarın', koyu: 'Koyunun', beyaz: 'Beyazın' };
  function bitisNedeni() {
    const b = O.durum.bitti, kaybeden = b.kazanan === null ? -1 : 1 - b.kazanan;
    const ben = kaybeden >= 0 && adi(kaybeden) === 'sen';
    if (b.neden === 'tekrar') return 'Aynı konum üç kez geldi';
    if (b.neden === 'elli') return `${C.kurallar.tassizHamle} hamledir taş alınmadı`;
    if (b.neden === 'tas') return ben ? 'İki taşın kaldı' : `${IYELIK[adi(kaybeden)]} iki taşı kaldı`;
    return ben ? 'Hamle yapamıyorsun' : `${Adi(kaybeden)} hamle yapamıyor`;
  }

  function bitir() {
    const d = O.durum, k = d.bitti.kazanan;
    D.dusunmeSil(O.S);
    D.sonucYaz(O.S, sonucBasligi(), { gecikme: 300 });
    if (O.gosteri) { $('#aciklama').textContent = `${sonucBasligi()}: ${bitisNedeni().toLocaleLowerCase('tr')}. Dokununca yeni oyun başlar.`; }
    durumGoster();
    $('#duyuru').textContent = `${sonucBasligi()}. ${bitisNedeni()}.`;
    if (!O.gosteri) {
      O.baslayan = k === null ? 1 - O.ilkBaslayan : 1 - k;   // kaybeden başlar; berabere: öteki
      depoYaz('dt-baslayan', O.baslayan);
      const t = $('#tekrar');
      t.hidden = false;
      setTimeout(() => KL.dugmeAltiCiz(t, 0, false, { stroke: KL.renkDeger('vurgu') }), 50);
    }
    kilitle(false);
  }

  /* ---------- geri alma ---------- */

  function geriAl() {
    if (O.gecis || O.gosteri) return;
    if (O.bekleyen) { bekleyeniIptal(); return; }
    if (!O.gecmis.length) return;
    if (O.aiKontrol) O.aiKontrol.abort();
    O.jeton++;
    const g = O.gecmis.pop();
    O.durum = g.durum;
    O.model = g.model;
    O.secili = -1;
    D.isaretleriSil(O.S);
    D.dusunmeSil(O.S);
    D.sonucSil(O.S);
    ipucuKaldir();
    $('#tekrar').hidden = true;
    taslariEsitle();
    degirmenleriEsitle(O.durum);
    noktaEtiketleri();
    evreGuncelle();
    durumGoster();
    kilitle(false);
    if (!insanSirasi() && !O.durum.bitti) { const j = O.jeton; kilitle(true); sirayiIlerlet(j).catch(e => hataYakala(e, j)); }
  }

  /* ---------- yeni oyun ---------- */

  function oyunAyariAl() {
    O.oyunAyar = { zorluk: O.ayar.zorluk, ikiKisi: O.ayar.ikiKisi, ucma: O.ayar.ucma };
  }

  // Tahta aynı sayfada kalır: taşlar tepsilere döner, değirmen çizgileri silinir, yeni oyun başlar.
  // Sayfa çevirme: mevcut sayfanın donmuş bir kopyası defterin cildi (sol kenar) etrafında dönerek kalkar; altındaki
  // gerçek sayfa o sırada temizlenip kalemle yeniden çizilir. Az hareket ayarında hiçbir şey yapılmaz.
  function sayfaCevir() {
    if (!KL.animasyonVar()) return Promise.resolve();
    const sayfa = $('#sayfa'), kopya = sayfa.cloneNode(true);
    kopya.removeAttribute('id');
    kopya.classList.add('cevrilen');
    kopya.setAttribute('aria-hidden', 'true');
    kopya.inert = true;
    // Kopyadaki kimlikleri kaldır (çift kimlik olmasın); SVG <defs> içindekiler kalır: çizgiler kendi gradyanlarına bağlı
    for (const e of kopya.querySelectorAll('[id]')) if (!e.closest('defs')) e.removeAttribute('id');
    for (const e of kopya.querySelectorAll('.cevrilen, .nokta')) e.remove();
    $('#defter').appendChild(kopya);
    Ses.cal('kayma', 0, 'sayfa');
    const a = kopya.animate([
      { transform: 'perspective(2200px) rotateY(0deg)', filter: 'brightness(1)', boxShadow: '14px 26px 44px -10px rgba(30,18,6,.55)' },
      { transform: 'perspective(2200px) rotateY(-38deg) translateZ(18px)', filter: 'brightness(.97)', boxShadow: '30px 34px 60px -10px rgba(30,18,6,.5)', offset: .45 },
      { transform: 'perspective(2200px) rotateY(-92deg) translateZ(30px)', filter: 'brightness(.82)', boxShadow: '40px 40px 70px -10px rgba(30,18,6,.2)' },
    ], { duration: 760, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    return a.finished.then(() => kopya.remove(), () => kopya.remove());
  }

  async function yeniOyun(o = {}) {
    if (O.aiKontrol) O.aiKontrol.abort();
    const j = ++O.jeton;
    const cevir = o.sayfa ? sayfaCevir() : null;
    if (!o.gosteri) O.gosteri = null;
    oyunAyariAl();
    const baslayan = o.gosteri ? 0 : O.baslayan;
    O.durum = BD.yeniOyun(kurallar(), baslayan);
    O.ilkBaslayan = baslayan;
    if (DT.ai && DT.ai.yeniOyun) DT.ai.yeniOyun();
    O.model = yeniModel();
    O.gecmis = []; O.bekleyen = null; O.secili = -1; O.ipucuSayisi = 0;
    O.ipucu = null;
    $('#tekrar').hidden = true;
    if (o.sayfa) {
      // yeni sayfa: başlık ve tahta kalemle baştan çizilir, taşlar tepsilerde bekler
      sahneCiz(!KL.animasyonVar(), true);
      yeniNotGuncelle();
      kilitle(true);
      await Promise.all([cevir, KL.bekle(KL.animasyonVar() ? 1500 : 0)]);
      if (j !== O.jeton) return;
      sirayiIlerlet(j).catch(e => hataYakala(e, j));
      return;
    }
    ipucuKaldir();
    D.isaretleriSil(O.S);
    D.dusunmeSil(O.S);
    D.sonucSil(O.S);
    D.ipucuCetele(O.S, 0);
    $('#tekrar').hidden = true;
    tepsiEtiketleri(true);
    yeniNotGuncelle();
    kilitle(true);
    noktaEtiketleri();
    durumGoster(true);
    evreGuncelle();
    await Promise.all([taslariEsitle(!!o.anlik), degirmenleriEsitle(O.durum, !!o.anlik)]);
    if (j !== O.jeton) return;
    sirayiIlerlet(j).catch(e => hataYakala(e, j));
  }

  /* ---------- ipucu ---------- */

  async function ipucuIste() {
    if (O.kilit || !insanSirasi() || O.bekleyen || O.gosteri) return;
    if (!DT.ai) return;
    if (O.ipucu) { ipucuKaldir(); return; }
    secimBirak();
    const j = O.jeton;
    kilitle(true);
    const kontrol = new AbortController();
    O.aiKontrol = kontrol;
    let r;
    try { r = await DT.ai.dusun(O.durum, Object.assign({ zorluk: C.ai.ipucu.zorluk }, C.ai[C.ai.ipucu.zorluk], { butceMs: C.ai.ipucu.butceMs }), { signal: kontrol.signal }); }
    catch (e) { if (O.aiKontrol === kontrol) O.aiKontrol = null; hataYakala(e, j); return; }
    if (O.aiKontrol === kontrol) O.aiKontrol = null;
    if (j !== O.jeton) return;
    O.ipucu = r.hamle;
    O.ipucuSayisi++;
    D.ipucuGoster(O.S, r.hamle);
    D.ipucuCetele(O.S, O.ipucuSayisi);
    $('#duyuru').textContent = 'İpucu: ' + BD.hamleYazi(r.hamle);
    kilitle(false);
  }

  /* ---------- nasıl oynanır, kendi kendine oynasın ---------- */

  // Türkçe ekler notasyonun okunuşuna göre: d7 → "d yedi" → d7'ye, d7'den, d7'deki
  const EK = {
    1: ['e', 'den', 'deki'], 2: ['ye', 'den', 'deki'], 3: ['e', 'ten', 'teki'], 4: ['e', 'ten', 'teki'],
    5: ['e', 'ten', 'teki'], 6: ['ya', 'dan', 'daki'], 7: ['ye', 'den', 'deki'],
  };
  const ekli = (i, k) => { const n = BD.NOTASYON[i]; return `${n}'${EK[n[1]][k]}`; };

  function gosteriAcikla(h, d) {
    const p = d.sira, kim = p === 0 ? 'Koyu' : 'Beyaz', rakip = p === 0 ? 'beyaz' : 'koyu';
    let t = h.kaynak < 0 ? `${kim} ${ekli(h.hedef, 0)} koydu.` : `${kim} ${ekli(h.kaynak, 1)} ${ekli(h.hedef, 0)} gitti.`;
    if (h.al >= 0) {
      const y = BD.uygula(d, h);
      const hatlar = BD.kuruluDegirmenler(y).filter(x => x.sahip === p && x.hat.includes(h.hedef)).map(x => x.hat.map(i => BD.NOTASYON[i]).join('-'));
      t = `${t.slice(0, -1)}, ${hatlar.join(' ve ')} değirmenini kurdu; ${ekli(h.al, 2)} ${rakip} taşı aldı.`;
    } else if (BD.evre(d, p) === 3) t = t.replace('gitti', 'uçtu');
    O.gosteri.metin = 'kendi kendine oynuyor · dokununca durur';
    const a = $('#aciklama');
    a.hidden = false;
    a.textContent = t;
  }

  function gosteriBaslat() {
    nasilAcKapa(false);
    ayarlariAcKapa(false);
    O.gosteri = { metin: 'kendi kendine oynuyor · dokununca durur' };
    document.body.classList.add('gosteri');
    $('#aciklama').hidden = false;
    $('#aciklama').textContent = 'İki bilgisayar orta zorlukta oynuyor. Değirmenler ve taş almalar burada yazılır.';
    yeniOyun({ gosteri: true, sayfa: true });
  }

  function gosteriDurdur() {
    if (!O.gosteri) return;
    O.gosteri = null;
    document.body.classList.remove('gosteri');
    $('#aciklama').hidden = true;
    yeniOyun({ sayfa: true });
  }

  /* ---------- ayarlar ---------- */

  const AYAR_DEGER = {
    zorluk: (v) => v, tasSeti: (v) => v,
    ikiKisi: (v) => v === 'evet', ucma: (v) => v === 'evet', notasyon: (v) => v === 'evet',
  };
  const ayarDegeri = (ad) => {
    const v = O.ayar[ad];
    return typeof v === 'boolean' ? (v ? 'evet' : 'hayir') : v;
  };

  function ayarlariCiz(anlik) {
    $$('#ayarlar .ayar').forEach(b => {
      const secili = ayarDegeri(b.dataset.ayar) === b.dataset.deger;
      b.setAttribute('aria-pressed', String(secili));
      const eski = b.querySelector(':scope > svg.cerceve');
      if (eski) eski.remove();
      if (secili && !$('#ayarlar').hidden) KL.dugmeAltiCiz(b, 0, anlik, { strokeWidth: 1.3 }, [-.5, 1.2]);
    });
  }

  function oyunBasladi() { return O.gecmis.length > 0 || O.durum.hamleNo > 0; }

  function yeniNotGuncelle() {
    const a = O.ayar, o = O.oyunAyar;
    const bekliyor = !!o && (a.zorluk !== o.zorluk || a.ikiKisi !== o.ikiKisi || a.ucma !== o.ucma);
    const not = $('#yeni-not');
    not.hidden = !bekliyor;
    not.textContent = bekliyor ? 'yeni oyunda geçerli' : '';
  }

  function ayarTik(b) {
    const ad = b.dataset.ayar, v = AYAR_DEGER[ad](b.dataset.deger);
    if (O.ayar[ad] === v) return;
    O.ayar[ad] = v;
    depoYaz('dt-ayar', O.ayar);
    ayarlariCiz(false);
    if (ad === 'notasyon') { D.notasyonCiz(O.S, v); return; }
    if (ad === 'tasSeti') { sahneCiz(true); return; }
    if (!oyunBasladi() && !O.gosteri) { yeniOyun({ anlik: true }); return; }
    yeniNotGuncelle();
  }

  // Ayarlar: "Nasıl oynanır" gibi tahtanın üstünde açılan not. Biri açılınca öteki kapanır.
  function ayarlariAcKapa(ac) {
    const acik = ac === undefined ? !O.ayarlarAcik : ac;
    if (acik) nasilAcKapa(false);
    O.ayarlarAcik = acik;
    $('#ayarlar').hidden = !acik;
    document.body.classList.toggle('ayarlar-acik', acik);
    $('#ayarlar-ac').setAttribute('aria-expanded', String(acik));
    if (acik) {
      D.onizlemeSil(O.S);
      ayarlariCiz(false);
      KL.dugmeAltiCiz($('#ayarlar-kapat'), 300, false);
    } else setTimeout(() => sozcukleriCiz(true), 0);
  }

  /* ---------- komut sözcükleri ---------- */

  function sozcukleriCiz(anlik) {
    $$('.sozcuk').forEach((b, i) => { if (!b.hidden) KL.dugmeAltiCiz(b, anlik ? 0 : 900 + i * 120, anlik); });
    ayarlariCiz(true);
    sesGuncelle(true);
  }

  // "Ses" sözcüğü: açıkken yalnız altı çizili; kapalıyken üstü de kalemle çizili
  function sesGuncelle(anlik = true) {
    const b = $('#ses');
    b.setAttribute('aria-pressed', String(!Ses.sessiz));
    b.setAttribute('aria-label', 'Ses');
    const svg = b.querySelector(':scope > svg.cerceve');
    if (!svg) return;
    const eski = svg.querySelector('.ustu');
    if (eski) eski.remove();
    if (!Ses.sessiz) return;
    const yazi = b.querySelector('.yazi'), bb = yazi.getBoundingClientRect(), kb = b.getBoundingClientRect();
    const olcek = kb.width ? b.offsetWidth / kb.width : 1;
    const x1 = (bb.left - kb.left) * olcek, x2 = x1 + bb.width * olcek, y = (bb.top - kb.top + bb.height * .55) * olcek;
    const g = KL.svgEl('g', { class: 'ustu' }, svg);
    KL.altiCiz(KL.kalemYap(svg), g, x1, x2, y, { tohum: ['ses-ustu'], anlik, ek: { strokeWidth: 1.4 } });
  }

  function sahneKur() {
    $$('.sozcuk .yazi').forEach(y => KL.harfle(y, null, { tohum: ['sozcuk', y.textContent], anlik: true }));
    $$('.sozcuk').forEach(b => b.addEventListener('click', () => KL.dugmeAltiVurgu(b)));
    $('#yeni-oyun').addEventListener('click', () => yeniOyun({ sayfa: true }));
    $('#tekrar').addEventListener('click', () => yeniOyun({ sayfa: true }));
    $('#geri-al').addEventListener('click', geriAl);
    $('#ipucu').addEventListener('click', ipucuIste);
    $('#nasil').addEventListener('click', () => nasilAcKapa());
    $('#nasil-kapat').addEventListener('click', () => nasilAcKapa(false));
    $('#gosteri').addEventListener('click', gosteriBaslat);
    $('#ses').addEventListener('click', () => { Ses.sessizYap(!Ses.sessiz); sesGuncelle(false); if (!Ses.sessiz) Ses.cal('tas'); });
    $('#ayarlar-ac').addEventListener('click', () => ayarlariAcKapa());
    $('#ayarlar-kapat').addEventListener('click', () => ayarlariAcKapa(false));
    $('#ayarlar').addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.ayar'); if (b) ayarTik(b); });
    const tahta = $('#noktalar');
    tahta.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.nokta'); if (b) noktaTik(+b.dataset.i); });
    tahta.addEventListener('pointerdown', surukleBasla);
    tahta.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest && e.target.closest('.nokta');
      const i = b ? +b.dataset.i : -1, d = O.durum;
      const uygun = i >= 0 && !O.kilit && !O.bekleyen && insanSirasi() && BD.evre(d) === 1 && !((d.tas[0] | d.tas[1]) & (1 << i));
      if (uygun) D.onizleme(O.S, i, d.sira); else D.onizlemeSil(O.S);
    });
    tahta.addEventListener('pointerleave', () => D.onizlemeSil(O.S));
    tahta.addEventListener('pointermove', surukleHareket);
    tahta.addEventListener('pointerup', (e) => surukleBitir(e, false));
    tahta.addEventListener('pointercancel', (e) => surukleBitir(e, true));
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    document.addEventListener('pointerdown', () => { if (O.gosteri) gosteriDurdur(); }, true);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); geriAl(); return; }
      if (e.key === 'Escape') {
        if (O.ayarlarAcik) ayarlariAcKapa(false);
        else if (!$('#nasil-not').hidden) nasilAcKapa(false);
        else if (O.gosteri) gosteriDurdur();
        else if (O.bekleyen) bekleyeniIptal();
        else secimBirak();
      }
    });
    $('#ayarlar').hidden = !O.ayarlarAcik;
    $('#ayarlar-ac').setAttribute('aria-expanded', String(O.ayarlarAcik));
    sesGuncelle();
  }

  function nasilAcKapa(ac) {
    const n = $('#nasil-not');
    const acik = ac === undefined ? n.hidden : ac;
    if (acik && O.ayarlarAcik) ayarlariAcKapa(false);
    n.hidden = !acik;
    document.body.classList.toggle('nasil-acik', acik);
    $('#nasil').setAttribute('aria-expanded', String(acik));
    if (!acik) setTimeout(() => sozcukleriCiz(true), 0);
    if (acik) $$('.sozcuk', n).forEach((b, i) => KL.dugmeAltiCiz(b, 200 + i * 150, false));
  }

  /* ---------- boyut ---------- */

  let bekleyen = 0;
  function yenidenBoyutla() {
    cancelAnimationFrame(bekleyen);
    bekleyen = requestAnimationFrame(() => {
      const d = olcuHesapla();
      if (d.modDegisti) sahneCiz(true);
      if (d.modDegisti || d.sqDegisti) sozcukleriCiz(true);
    });
  }

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    Kit.malzeme.sec('kursunkalem', { cizim: C.cizim, renk: C.renk });
    ayarlariYukle();
    oyunAyariAl();
    olcuHesapla();
    const fontHazir = await KL.fontBekle();
    sahneKur();
    O.durum = BD.yeniOyun(kurallar(), O.baslayan);
    O.ilkBaslayan = O.baslayan;
    O.model = yeniModel();
    sahneCiz(false);
    sozcukleriCiz(false);
    if (!fontHazir) KL.fontGelince(() => { sahneCiz(true); sozcukleriCiz(true); });
    window.addEventListener('resize', yenidenBoyutla);
    window.addEventListener('orientationchange', yenidenBoyutla);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', yenidenBoyutla);
    DT.durum = O;                                          // konsoldan denemek için: DT.durum
    const j = ++O.jeton;
    kilitle(true);
    await KL.bekle(KL.animasyonVar() ? 2300 : 0);          // tahta çizilirken oynanmaz
    if (j !== O.jeton) return;
    sirayiIlerlet(j).catch(e => hataYakala(e, j));
  }

  DT.ui = { O };
  basla();
})();
