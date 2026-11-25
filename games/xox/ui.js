// ui.js — kontrolör: ölçü, font, sahne, hamle akışı, sıra, geri alma, yeni oyun, iki kişilik mod, ayar notları, klavye.
// Kurallar board.js'te, desen puanlama eval.js'te, bilgisayar ai.js'te (üçü de DOM'suz).
(function () {
  'use strict';

  const Kit = window.Kit, KL = Kit.kalem, DK = Kit.dolmakalem;
  const XOX = window.XOX, C = XOX.config, D = XOX.draw, B = XOX.board, E = XOX.eval, AI = XOX.ai, Ses = Kit.ses;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));

  const MUREKKEP_ADI = { mavisiyah: 'mavi-siyah', kirmizi: 'kırmızı', yesil: 'yeşil', mor: 'mor' };

  /* ---------- ayarlar (localStorage, bellek yedeği) ---------- */

  const AYAR_ANAHTAR = 'xox-ayar';
  let bellek = null;
  function ayarOku() {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(AYAR_ANAHTAR) || 'null'); } catch (e) { v = bellek; }
    return Object.assign({
      rakip: C.rakip === 'ikiKisi' ? 'ikiKisi' : 'bilgisayar',
      zorluk: C.zorluk,
      sayfa: C.sinirsiz ? 'sinirsiz' : 'sabit',
      seri: String(C.seri || 1),
      ikiDokunus: C.ikiDokunus == null ? (dokunmatik() ? 'evet' : 'hayir') : (C.ikiDokunus ? 'evet' : 'hayir'),
      murekkepler: ['mavisiyah', 'kirmizi'],
      tehditler: C.tehditler == null ? null : !!C.tehditler,     // null: kolayda açık, diğerlerinde kapalı
    }, v || {});
  }
  function ayarYaz() {
    bellek = U.ayar;
    try { localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(U.ayar)); } catch (e) { /* yoksay */ }
  }

  // Animasyon bekleyişi: arka plandaki sekmede animasyon zaman çizelgesi durabilir; oyun akışı en çok ms bekler
  const enCok = (p, ms) => Promise.race([p, KL.bekle(ms)]);

  const dokunmatik = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  /* ---------- durum ---------- */

  const U = {
    jeton: 0, oyunId: 0, l: null, T: null,
    ayar: null,            // kalıcı ayarlar (notlarda görünen)
    oyun: null,            // bu oyunun dondurulmuş ayarları: { rakip, zorluk, sayfa, murekkepler, boyut }
    durum: null,           // board durumu
    gecmis: [],            // geri alma noktaları: hamle sayısı (insan hamlesinden önce)
    dugum: [],             // hamle sırası → sembol <g>
    sahip: { 1: null, 2: null },     // sembol → oyuncu: 'ben' | 'bilgisayar' | 'a' | 'b'
    benX: true,            // bilgisayara karşı: bu oyunda X ben miyim (her oyunda değişir)
    aX: true,              // iki kişi: bu oyunda X 1. oyuncu mu (kaybeden X alır)
    kilit: false, iptal: null, taze: null, secili: null, imlec: null, lekeSirasi: 0, ipucuIptal: null,
    seri: null, seriSayildi: null,          // { hedef, skor: { oyuncu: galibiyet }, bitti, rakip }
    izle: false, terimler: new Set(),       // nasıl oynanır → izle: iki bilgisayar oynar
    analizSonuc: null, analizIptal: null,
  };

  // Tehdit işaretleri açık mı: kullanıcı seçtiyse o, yoksa bilgisayara karşı kolayda açık
  const tehditAcik = () => U.izle ? true : U.ayar.tehditler != null ? U.ayar.tehditler : (U.oyun && U.oyun.rakip === 'bilgisayar' && U.oyun.zorluk === 'kolay');

  const oyuncuMurekkebi = (o) => {
    if (o === 'ben') return C.murekkep.ben;
    if (o === 'bilgisayar') return C.murekkep.bilgisayar;
    if (o === 'izleX') return 'mavisiyah';
    if (o === 'izleO') return 'kirmizi';
    return U.oyun.murekkepler[o === 'a' ? 0 : 1];
  };
  const sembolMurekkebi = (s) => oyuncuMurekkebi(U.sahip[s]);
  const siradaki = () => U.sahip[U.durum.sira];
  const bilgisayarMi = (o) => o === 'bilgisayar' || o === 'izleX' || o === 'izleO';
  const insanSirasi = () => !U.durum.bitti && !bilgisayarMi(siradaki());

  // İzle modunda terimlerin kenar notları (ilk göründüklerinde bir kez)
  const TERIM = {
    acikUc: ['açık üç', 'iki ucu boş üçlü; kapatılmazsa açık dört olur'],
    dort: ['dört', 'bir hamlede beş; hemen kapatılmalı'],
    catal: ['çatal', 'iki tehdit birden; biri kapatılınca öbürü kazanır'],
  };

  /* ---------- ölçü ---------- */

  // İki düzen. defter: eğik sayfa, her şey sığar (21 × 24 kare). dar: sayfa ekranı doldurur, tahta kendi kutusunda kayar.
  // Kare dokunmatikte en az 34 px, fareyle en az 28 px, en çok 44 px.
  function olcuHesapla() {
    const { vw, vh } = KL.alan();
    // sayfa geometrisi: sabit tahtada tahtanın kendisi, sınırsızda 15 × 15'lik pencere (içi kayar)
    const sinirsiz = !!U.oyun && U.oyun.boyut === 0;
    const n = sinirsiz ? 15 : (U.oyun ? U.oyun.boyut : C.boyut), dok = dokunmatik(), enAz = dok ? 34 : 28;
    const alan = U.alan || { r0: 0, c0: 0, satir: n, sutun: n };
    const W = 4 + 1 + n + 1, H = 3 + n + 6;
    // defterin üst ve alt boşluğu 1.2'şer kare (kagit.css)
    const sqDefter = Math.min(44, Math.floor(Math.min((vw - 32) / W, (vh - 24) / (H + 2.4))));
    let l;
    if (sqDefter >= enAz) {
      l = { duzen: 'defter', sq: sqDefter, W, H, tx: 5, ty: 3, gw: n, gh: n, marj: 4 };
    } else {
      // komutlar (iki satır) tahtayla birlikte görünsün; ayar notları için sayfa aşağı kayabilir
      const sq = enAz;
      const Wd = Math.max(8, Math.floor(vw / sq));
      const ty = 2, gh = Math.max(6, Math.min(n, Math.floor(vh / sq) - ty - 3));
      l = { duzen: 'dar', sq, W: Wd, H: ty + gh + 3, tx: 1, ty, gw: Math.min(n, Wd - 1), gh, marj: 1 };
    }
    l.n = n; l.dok = dok;
    const st = document.documentElement.style;
    st.setProperty('--sq', l.sq + 'px');
    const v = { 'sayfa-w': l.W, 'sayfa-h': l.H, 'tahta-x': l.tx, 'tahta-y': l.ty, 'gor-w': l.gw, 'gor-h': l.gh, sutun: alan.sutun, satir: alan.satir };
    for (const k in v) st.setProperty('--' + k, v[k]);
    document.body.dataset.duzen = l.duzen;
    document.body.dataset.sinirsiz = String(sinirsiz);
    const once = U.l;
    U.l = l;
    if (!once || once.gw !== l.gw || once.gh !== l.gh || once.n !== l.n) tahtayiOrtala();
    return !once || once.duzen !== l.duzen || once.sq !== l.sq || once.W !== l.W || once.gh !== l.gh;
  }

  // Kayan tahta kutusunda (dar düzen, sınırsız sayfa) görünen alanı taşların (yoksa sayfanın) ortasına getir
  function tahtayiOrtala() {
    const kap = $('#tahta-kap'), l = U.l, a = U.alan;
    if (!a) return;
    const s = U.durum && U.durum.sinir;
    const rm = s ? (s.r1 + s.r2) / 2 : a.r0 + (a.satir - 1) / 2, cm = s ? (s.c1 + s.c2) / 2 : a.c0 + (a.sutun - 1) / 2;
    kap.scrollLeft = Math.max(0, (cm - a.c0 + .5) * l.sq - kap.clientWidth / 2);
    kap.scrollTop = Math.max(0, (rm - a.r0 + .5) * l.sq - kap.clientHeight / 2);
  }
  // Yeni sembol görünür alanın dışındaysa oraya kaydır (kayan kutuda)
  function goruneGetir(r, c) {
    if (!U.l || (U.l.duzen !== 'dar' && U.oyun.boyut !== 0)) return;
    const kap = $('#tahta-kap'), sq = U.l.sq;
    const x = (c - U.alan.c0) * sq, y = (r - U.alan.r0) * sq;
    const sol = kap.scrollLeft, ust = kap.scrollTop, w = kap.clientWidth, h = kap.clientHeight;
    let nx = sol, ny = ust;
    if (x < sol + sq * .5) nx = x - sq * 1.5; else if (x + sq > sol + w - sq * .5) nx = x + sq * 2.5 - w;
    if (y < ust + sq * .5) ny = y - sq * 1.5; else if (y + sq > ust + h - sq * .5) ny = y + sq * 2.5 - h;
    if (nx !== sol || ny !== ust) kap.scrollTo({ left: nx, top: ny, behavior: KL.animasyonVar() ? 'smooth' : 'auto' });
  }

  /* ---------- sözcükler, ayar notları, lekeler ---------- */

  function sozcukleriCiz(anlik) {
    $$('.sozcuk').forEach((b, i) => {
      if (b.hidden || b.offsetParent === null) return;
      altCiz(b, anlik ? 0 : 500 + i * 110, anlik);
    });
  }
  // Mürekkeple (komutlar) ya da kurşun kalemle (analiz, nasıl oynanır içi) altı çizili sözcük
  function altCiz(b, gecikme, anlik) {
    if (b.classList.contains('kursun-sozcuk')) {
      KL.dugmeAltiCiz(b, gecikme, anlik, { strokeWidth: 1.3, stroke: KL.renkDeger('kursun') }, [1, 3], { murekkep: false });
    } else KL.dugmeAltiCiz(b, gecikme, anlik, { strokeWidth: 1.6 }, [1, 3]);
    if (b.getAttribute('aria-pressed') === 'false') ustunuCiz(b);
  }
  // Kapalı ayar sözcüğü (Tehditler, Ses): üstü kurşun kalemle ince çizili
  function ustunuCiz(b) {
    const svg = b.querySelector(':scope > svg.cerceve'), yazi = b.querySelector('.yazi');
    if (!svg || !yazi) return;
    const bb = yazi.getBoundingClientRect(), kb = b.getBoundingClientRect(), o = kb.width ? b.offsetWidth / kb.width : 1;
    const x1 = (bb.left - kb.left) * o - 2, x2 = x1 + bb.width * o + 4, y = (bb.top - kb.top + bb.height * .55) * o;
    KL.kalemYap(svg).cizgi(svg, [x1, y + 1, x2, y - 1], { stroke: KL.renkDeger('kursun'), strokeWidth: 1.2, roughness: .8 },
      ['ustu', b.id], { murekkep: false, anlik: true });
  }
  function sozcukYenile(b) { if (!b.hidden && b.offsetParent !== null) altCiz(b, 0, true); }
  function goster(sec, acik) { const b = $(sec); b.hidden = !acik; if (acik) sozcukYenile(b); }

  function ayarlariCiz() {
    $$('.ayar-grup[data-dokunmatik]').forEach(p => { p.hidden = !U.l.dok; });
    $$('.ayar-grup[data-rakip]').forEach(p => { p.hidden = p.dataset.rakip !== U.ayar.rakip; });
    $$('.ayar').forEach(b => {
      const secili = String(U.ayar[b.dataset.ayar]) === b.dataset.deger;
      b.setAttribute('aria-pressed', String(secili));
      D.ayarDairesi(b, secili);
    });
    lekeleriCiz();
    bekleyenGoster();
  }

  // Oyunun dondurulmuş ayarlarından farklı bir ayar varsa "Yeni oyun" altı noktalı + kısa not
  function bekleyenVar() {
    const a = U.ayar, o = U.oyun;
    return a.rakip !== o.rakip || (a.rakip === 'bilgisayar' && a.zorluk !== o.zorluk) || a.sayfa !== o.sayfa ||
      (a.rakip === 'ikiKisi' && a.murekkepler.join() !== o.murekkepler.join());
  }
  function bekleyenGoster() {
    const var_ = !!U.oyun && bekleyenVar();
    $('#yeni').dataset.bekliyor = String(var_);
    $('#ayar-not').textContent = var_ ? 'yeni oyunda geçerli olur' : '';
  }

  function lekeleriKur() {
    const kap = $('#lekeler');
    kap.textContent = '';
    for (const m of C.murekkepler) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'leke'; b.dataset.murekkep = m;
      const svg = KL.svgEl('svg', { 'aria-hidden': 'true' }, b);
      const no = document.createElement('span');
      no.className = 'leke-no'; no.setAttribute('aria-hidden', 'true');
      b.appendChild(no);
      kap.appendChild(b);
      D.lekeCiz(svg, m, true);
      b.addEventListener('click', () => lekeSec(m));
    }
  }
  function lekeleriCiz() {
    const [a, b] = U.ayar.murekkepler;
    $$('.leke').forEach(e => {
      const m = e.dataset.murekkep, no = m === a ? '1' : m === b ? '2' : '';
      e.querySelector('.leke-no').textContent = no;
      e.setAttribute('aria-pressed', String(!!no));
      e.setAttribute('aria-label', `${MUREKKEP_ADI[m]} mürekkep${no ? ', ' + no + '. oyuncu' : ''}`);
    });
  }
  // Leke seçimi: sırayla 1. ve 2. oyuncunun mürekkebi değişir; iki oyuncu aynı mürekkebi alamaz.
  function lekeSec(m) {
    const mk = U.ayar.murekkepler.slice();
    const i = mk.indexOf(m);
    if (i >= 0) U.lekeSirasi = 1 - i;             // zaten seçili: sıradaki seçim diğer oyuncunun
    else { mk[U.lekeSirasi] = m; U.lekeSirasi = 1 - U.lekeSirasi; }
    U.ayar.murekkepler = mk;
    ayarDegisti();
  }

  function ayarDegisti() {
    ayarYaz();
    // boş sayfada hemen uygulanır; oyun sürüyorsa yeni oyunda
    if (U.durum && U.durum.hamleler.length === 0 && !U.kilit) { yeniOyun({ ayniSira: true }); return; }
    ayarlariCiz();
  }

  /* ---------- tahta ve hücreler ---------- */

  // a: görünen alan { r0, c0, satir, sutun } (dünya koordinatı; sınırsızda negatif olabilir)
  function hucreleriKur(a, imleciKoru) {
    const kap = $('#hucreler');
    kap.textContent = '';
    const parca = document.createDocumentFragment();
    for (let r = a.r0; r < a.r0 + a.satir; r++) for (let c = a.c0; c < a.c0 + a.sutun; c++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hucre';
      b.dataset.r = r; b.dataset.c = c;
      b.style.left = `calc(var(--sq) * ${c - a.c0})`;
      b.style.top = `calc(var(--sq) * ${r - a.r0})`;
      b.tabIndex = -1;
      parca.appendChild(b);
    }
    kap.appendChild(parca);
    if (!imleciKoru || !U.imlec) U.imlec = [a.r0 + Math.floor(a.satir / 2), a.c0 + Math.floor(a.sutun / 2)];
    hucreButonu(...U.imlec).tabIndex = 0;
  }
  const alanIcinde = (r, c) => r >= U.alan.r0 && c >= U.alan.c0 && r < U.alan.r0 + U.alan.satir && c < U.alan.c0 + U.alan.sutun;

  // Sınırsız sayfa: taşlar kenara yaklaşınca yeni kareler açılır; sola / yukarı büyüme kadar kaydırılır (görüntü yerinde kalır)
  function alanBuyut() {
    if (U.durum.ayar.boyut) return;
    const a = U.alan, y = B.gorunurAlan(U.durum, a);
    if (y.r0 === a.r0 && y.c0 === a.c0 && y.satir === a.satir && y.sutun === a.sutun) return;
    const kap = $('#tahta-kap'), sq = U.l.sq;
    const dx = (a.c0 - y.c0) * sq, dy = (a.r0 - y.r0) * sq;
    U.alan = y;
    U.T.alan = y;
    D.viewBoxAyarla(U.T.svg, y);
    const st = document.documentElement.style;
    st.setProperty('--sutun', y.sutun);
    st.setProperty('--satir', y.satir);
    hucreleriKur(y, true);
    kap.scrollLeft += dx;
    kap.scrollTop += dy;
  }
  const hucreButonu = (r, c) => $(`.hucre[data-r="${r}"][data-c="${c}"]`);

  function hucreEtiketi(r, c) {
    const s = B.tas(U.durum, r, c), ad = B.hucreAdi(r, c);
    if (!s) return `${ad}: boş`;
    return `${ad}: ${B.SEMBOL[s]}, ${MUREKKEP_ADI[sembolMurekkebi(s)]}`;
  }
  function etiketleriGuncelle() {
    const kapali = !insanSirasi();
    $$('.hucre').forEach(b => {
      const r = +b.dataset.r, c = +b.dataset.c;
      b.setAttribute('aria-label', hucreEtiketi(r, c));
      b.setAttribute('aria-disabled', String(kapali || !!B.tas(U.durum, r, c)));
    });
  }

  function duyur(t) { $('#duyuru').textContent = t; }

  /* ---------- marj notları ---------- */

  function marjGuncelle() {
    const dus = $('#dusunuyor'), not = $('#marj-not');
    dus.hidden = !(U.durum && !U.durum.bitti && bilgisayarMi(siradaki()) && U.iptal);
    dus.style.color = U.izle && U.durum ? `var(--murekkep-${sembolMurekkebi(U.durum.sira)})` : '';
    if (U.analizIptal) { not.hidden = false; not.textContent = 'bakıyorum'; }
    else if (U.oyun.rakip === 'ikiKisi' && !U.izle && U.durum && !U.durum.bitti) {
      not.hidden = false;
      not.textContent = `sıra\n${MUREKKEP_ADI[sembolMurekkebi(U.durum.sira)]}`;
    } else { not.hidden = true; not.textContent = ''; }
    // kalem imleci sıradakinin mürekkebi
    const m = U.durum && !U.durum.bitti && !bilgisayarMi(siradaki()) ? sembolMurekkebi(U.durum.sira) : C.murekkep.ben;
    document.documentElement.style.setProperty('--kalem-imlec', `var(--imlec-dolma-${m})`);
    seriNotu();
  }

  /* ---------- seri: ilk 3 galibiyet ---------- */

  function seriSifirla() { U.seri = { hedef: +U.ayar.seri || 1, skor: {}, bitti: false, rakip: U.ayar.rakip }; U.seriSayildi = null; }
  function seriNotu() {
    const n = $('#seri-not'), S = U.seri;
    if (!S || S.hedef <= 1 || U.izle) { n.hidden = true; return; }
    n.hidden = false;
    n.style.color = '';
    const [a, b] = U.oyun.rakip === 'bilgisayar' ? ['ben', 'bilgisayar'] : ['a', 'b'];
    const ad = (o) => o === 'ben' ? 'sen' : o === 'bilgisayar' ? 'bilgisayar' : MUREKKEP_ADI[oyuncuMurekkebi(o)];
    if (S.bitti) {
      const k = (S.skor[a] || 0) >= S.hedef ? a : b;
      n.textContent = k === 'ben' ? 'seriyi\nsen aldın' : `seriyi\n${ad(k)} aldı`;
      n.style.color = `var(--murekkep-${oyuncuMurekkebi(k)})`;
    } else {
      // iki satır: skor büyük, kimin skoru küçük (marj dar)
      n.textContent = `seri ${S.skor[a] || 0} – ${S.skor[b] || 0}`;
      const alt = document.createElement('span');
      alt.className = 'marj-alt';
      alt.textContent = `${ad(a)} · ${ad(b)}`;
      n.appendChild(alt);
    }
  }
  function seriSay(kim, artis) {
    if (!U.seri || U.seri.hedef <= 1 || U.izle) return;
    U.seri.skor[kim] = (U.seri.skor[kim] || 0) + artis;
    U.seri.bitti = U.seri.skor[kim] >= U.seri.hedef;
    U.seriSayildi = artis > 0 ? kim : null;
    seriNotu();
  }

  /* ---------- izle: terimlerin kenar notları ---------- */

  function terimKontrol(onceki, h) {
    const s = h.sembol;
    const Pk = E.pencereKur(onceki), c = E.catallar(Pk, E.hucre(Pk, h.r, h.c), s);
    if (!U.terimler.has('catal') && (c.dortUc || c.ucUc || c.dortDort)) return terimYaz('catal', h);
    const say = E.sayim(E.pencereKur(U.durum), s);
    if (!U.terimler.has('dort') && say.dort + say.acikDort > 0) return terimYaz('dort', h);
    if (!U.terimler.has('acikUc') && say.acikUc > 0) return terimYaz('acikUc', h);
  }
  function terimYaz(k, h) {
    U.terimler.add(k);
    const [ad, aciklama] = TERIM[k];
    const p = document.createElement('p');
    p.className = 'terim';
    const b = document.createElement('b');
    b.textContent = ad;
    p.append(b, aciklama);
    $('#terimler').appendChild(p);
    D.okCiz(U.T, h.r, h.c, ['terim', k, U.oyunId]);
    if (U.l.duzen === 'dar') $('#aciklama').textContent = `${ad}: ${aciklama}`;
    duyur(`${ad}: ${aciklama}`);
  }

  /* ---------- nasıl oynanır ---------- */

  function nasilAc(acik) {
    $('#alt').dataset.nasil = String(acik);
    $('#nasil-not').hidden = !acik;
    if (acik) { sozcukYenile($('#izle')); sozcukYenile($('#nasil-kapat')); }
  }

  /* ---------- oyun sonu analizi ---------- */

  async function analizYap() {
    const d = U.durum;
    if (!d.bitti || d.kazanan === 'berabere' || U.analizIptal || U.analizSonuc) return;
    const j = U.jeton, iptal = new AbortController();
    U.analizIptal = iptal;
    $('#analiz').disabled = true;
    marjGuncelle();
    duyur('bakıyorum');
    let a = null;
    try { a = await AI.analizAsync(d.ayar, d.hamleler, { signal: iptal.signal, butceMs: 250 }); }
    catch (e) { if (e.name !== 'AbortError') throw e; }
    finally { if (U.analizIptal === iptal) U.analizIptal = null; $('#analiz').disabled = false; }
    if (j !== U.jeton) return;
    marjGuncelle();
    if (!a) { $('#aciklama').textContent = 'bir şey bulamadım'; return; }
    U.analizSonuc = a;
    for (let i = a.hamleNo + 1; i < U.dugum.length; i++) if (U.dugum[i]) U.dugum[i].setAttribute('opacity', .15);
    U.T.kazanma.setAttribute('opacity', .15);
    D.analizCiz(U.T, a, a.kaybeden, U.oyunId);
    const ad = B.hucreAdi(a.oynanan[0], a.oynanan[1]);
    const metin = `${a.hamleNo + 1}. hamle, ${ad}: ${a.aciklama}` + (a.enIyi ? ` (${B.hucreAdi(a.enIyi[0], a.enIyi[1])})` : '');
    $('#aciklama').textContent = metin;
    duyur(metin);
    goster('#analiz', false);
    goster('#analiz-kapat', true);
  }
  function analizKapat() {
    if (U.analizIptal) { U.analizIptal.abort(); U.analizIptal = null; }
    if (U.analizSonuc && U.T) {
      for (let i = U.analizSonuc.hamleNo + 1; i < U.dugum.length; i++) if (U.dugum[i]) U.dugum[i].removeAttribute('opacity');
      U.T.kazanma.removeAttribute('opacity');
      D.katmanSil(U.T, 'analiz');
    }
    U.analizSonuc = null;
    $('#aciklama').textContent = '';
    goster('#analiz-kapat', false);
  }

  /* ---------- önizleme (fare, iki dokunuşun ilki, klavye imleci) ---------- */

  function onizlemeGoster(r, c) {
    D.katmanSil(U.T, 'onizleme');
    if (r == null || !insanSirasi() || U.kilit || B.tas(U.durum, r, c)) return;
    D.taslak(U.T, r, c, B.SEMBOL[U.durum.sira], U.oyunId, .35);
  }
  function onizlemeSil() { D.katmanSil(U.T, 'onizleme'); U.secili = null; }

  /* ---------- tehdit işaretleri ve ipucu (kurşun kalem) ---------- */

  function tehditCiz() {
    D.katmanSil(U.T, 'tehdit');
    if (!U.durum || U.durum.bitti || U.kilit) return;
    if (!tehditAcik() || (!U.izle && !insanSirasi())) return;
    const t = E.tehditler(U.durum, U.durum.sira);
    for (const [r, c] of t.noktalar) D.tehditNokta(U.T, r, c);
    if (t.halka) D.tehditHalka(U.T, t.halka[0], t.halka[1]);
  }
  function ipucuSil() {
    if (U.ipucuIptal) { U.ipucuIptal.abort(); U.ipucuIptal = null; }
    D.katmanSil(U.T, 'ipucu');
  }
  async function ipucu() {
    if (C.yarisma || !insanSirasi() || U.kilit || U.ipucuIptal) return;
    const j = U.jeton, n = U.durum.hamleler.length;
    D.katmanSil(U.T, 'ipucu');
    const iptal = new AbortController();
    U.ipucuIptal = iptal;
    duyur('ipucu aranıyor');
    try {
      const h = await AI.secAsync(U.durum, { zorluk: 'zor', butceMs: C.ai.ipucuMs }, { signal: iptal.signal });
      if (j !== U.jeton || n !== U.durum.hamleler.length || !h) return;
      D.taslak(U.T, h.r, h.c, B.SEMBOL[U.durum.sira], U.oyunId, .45, U.T.ipucu);
      duyur(`ipucu: ${B.hucreAdi(h.r, h.c)}`);
    } catch (e) { if (e.name !== 'AbortError') throw e; }
    finally { if (U.ipucuIptal === iptal) U.ipucuIptal = null; }
  }

  /* ---------- yazma ---------- */

  async function sembolCiz(h, anlik) {
    if (U.taze) DK.kurut(U.taze, { sureMs: 300 });
    const s = D.sembolYaz(U.T, h.r, h.c, B.SEMBOL[h.sembol], U.oyunId, { murekkep: sembolMurekkebi(h.sembol), taze: !anlik, anlik });
    if (!anlik) {                                                     // kalem ucu: X'te iki kısa, O'da tek uzun
      const ilk = U.durum.hamleler.length === 1 ? 90 : 0;
      if (h.sembol === B.X) { Ses.cal('uc', ilk, { sureMs: 120 }); Ses.cal('uc', ilk + (s.arada || 160), { sureMs: 120 }); }
      else Ses.cal('uc', ilk, { sureMs: 180 });
    }
    U.dugum[U.durum.hamleler.length - 1] = s.node;
    U.taze = s.node;
    goruneGetir(h.r, h.c);
    await enCok(s.bitti, 1200);
  }

  // İnsanın hamlesi (fare, dokunma, klavye)
  async function insanYazar(r, c) {
    if (U.kilit || !insanSirasi() || !B.gecerliMi(U.durum, r, c)) return;
    U.gecmis.push(U.durum.hamleler.length);
    await hamleYap(r, c);
  }

  async function hamleYap(r, c) {
    const j = U.jeton;
    U.kilit = true;
    onizlemeSil();
    ipucuSil();
    D.katmanSil(U.T, 'tehdit');
    const kim = siradaki(), onceki = U.durum;
    U.durum = B.oyna(U.durum, r, c);
    const h = U.durum.hamleler[U.durum.hamleler.length - 1];
    if (U.durum.hamleler.length === 1) Ses.cal('kapak');            // kalemin kapağı açılır
    alanBuyut();
    komutlariGuncelle();
    duyur(`${kimAdi(kim)} ${B.hucreAdi(r, c)} karesine ${B.SEMBOL[h.sembol]} yazdı`);
    await sembolCiz(h);
    if (j !== U.jeton) return;
    if (U.izle) terimKontrol(onceki, h);
    U.kilit = false;
    if (U.durum.bitti) { await oyunSonu(); return; }
    siraIlerle();
  }

  function kimAdi(o) {
    if (o === 'ben') return 'sen';
    if (o === 'bilgisayar') return 'bilgisayar';
    if (o === 'izleX' || o === 'izleO') return `${MUREKKEP_ADI[oyuncuMurekkebi(o)]} bilgisayar`;
    return MUREKKEP_ADI[oyuncuMurekkebi(o)];
  }

  function siraIlerle() {
    marjGuncelle();
    etiketleriGuncelle();
    komutlariGuncelle();
    tehditCiz();
    if (U.durum.bitti) return;
    if (bilgisayarMi(siradaki())) { bilgisayarOyna(); return; }
    duyur(U.oyun.rakip === 'ikiKisi' ? `sıra ${MUREKKEP_ADI[sembolMurekkebi(U.durum.sira)]} mürekkepte` : 'sıra sende');
  }

  /* ---------- bilgisayar ---------- */

  // Arama dilimli (ai.secAsync): arayüz donmaz; düşünürken geri alınabilir (iptal). En az enAzDusunmeMs düşünür.
  async function bilgisayarOyna() {
    const j = U.jeton;
    const iptal = new AbortController();
    U.iptal = iptal;
    U.kilit = false;                        // düşünürken geri alınabilir
    marjGuncelle();
    etiketleriGuncelle();
    komutlariGuncelle();
    duyur('bilgisayar düşünüyor');
    const t0 = performance.now();
    let h;
    try {
      const zorluk = U.izle ? 'orta' : U.oyun.zorluk;
      const ayar = { zorluk, tohum: U.oyunId * 1009 + U.durum.hamleler.length };
      if (zorluk === 'orta') ayar.butceMs = C.ai.ortaMs;
      if (zorluk === 'zor') ayar.butceMs = C.ai.zorMs;
      h = await AI.secAsync(U.durum, ayar, { signal: iptal.signal });
    } catch (e) {
      if (e.name === 'AbortError') return;
      throw e;
    }
    if (XOX.ui && XOX.ui.olcum) XOX.ui.olcum.push(h);                  // geliştirme: hamle başına süre / düğüm
    await KL.bekle(Math.max(0, C.ai.enAzDusunmeMs - (performance.now() - t0)));
    if (iptal.signal.aborted || j !== U.jeton) return;
    U.iptal = null;
    marjGuncelle();
    await hamleYap(h.r, h.c);
  }

  /* ---------- oyun sonu ---------- */

  async function oyunSonu() {
    const j = U.jeton, d = U.durum;
    U.kilit = true;
    marjGuncelle();
    etiketleriGuncelle();
    komutlariGuncelle();
    if (d.kazanan === 'berabere') {
      $('#not').textContent = 'doldu';
      duyur('sayfa doldu: berabere');
    } else {
      const kim = U.sahip[d.kazanan];
      duyur(kim === 'ben' ? 'kazandın: beş' : kim === 'bilgisayar' ? 'bilgisayar kazandı: beş' : `${kimAdi(kim)} kazandı: beş`);
      seriSay(kim, 1);
      Ses.cal('cizgi', 120);
      const n = d.ayar.boyut, bos = (r, c) => (!n || (r >= 0 && c >= 0 && r < n && c < n)) && !B.tas(d, r, c);
      await enCok(D.kazanmaCiz(U.T, d.besli, sembolMurekkebi(d.kazanan), U.oyunId, { gecikme: 120, bos }).bitti, 1800);
    }
    if (j !== U.jeton) return;
    U.kilit = false;
    komutlariGuncelle();
    // kaybeden insansa: "nerede kaybettim?"
    const kaybeden = d.kazanan === 'berabere' ? null : U.sahip[3 - d.kazanan];
    goster('#analiz', !!kaybeden && !U.izle && !bilgisayarMi(kaybeden));
  }

  /* ---------- geri alma ---------- */

  function geriAlinabilir() {
    if (!U.durum || !U.durum.hamleler.length || C.yarisma || !C.geriAl) return false;
    if (U.kilit) return false;
    return U.gecmis.length > 0;
  }

  // Bilgisayara karşı: son hamlem ve sonrasındaki bilgisayar hamlesi birlikte. İki kişi: tek hamle.
  // Mürekkep silinmez: geri alınan semboller karalanır, solar ve sayfada kalır.
  async function geriAl() {
    if (!geriAlinabilir()) return;
    if (U.iptal) { U.iptal.abort(); U.iptal = null; }
    const j = ++U.jeton;
    U.kilit = true;
    onizlemeSil();
    ipucuSil();
    D.katmanSil(U.T, 'tehdit');
    analizKapat();
    goster('#analiz', false);
    const hedef = U.gecmis.pop();
    const kazanmaVardi = U.durum.bitti && U.durum.kazanan !== 'berabere';
    if (kazanmaVardi && U.seriSayildi) seriSay(U.seriSayildi, -1);
    if (U.durum.bitti) $('#not').textContent = '';
    const isler = [];
    if (kazanmaVardi) isler.push(D.kazanmaSoldur(U.T));
    while (U.durum.hamleler.length > hedef) {
      const i = U.durum.hamleler.length - 1, h = U.durum.hamleler[i];
      const node = U.dugum[i];
      U.dugum.length = i;
      U.durum = B.geriAl(U.durum);
      if (node) isler.push(D.karala(U.T, node, h.r, h.c, sembolMurekkebi(h.sembol), `${U.oyunId}-${i}-${U.T.iptal.childElementCount}`).bitti);
    }
    U.taze = null;
    duyur('geri alındı');
    await enCok(Promise.all(isler), 1500);
    if (j !== U.jeton) return;
    U.kilit = false;
    siraIlerle();
  }

  /* ---------- yeni oyun ---------- */

  // o: { ayniSira } (boş sayfada ayar değişti: kim X değişmez) · { izle } (iki bilgisayar oynar, tehditler ve terim notları)
  async function yeniOyun(o = {}) {
    if (U.iptal) { U.iptal.abort(); U.iptal = null; }
    analizKapat();
    if (U.T) ipucuSil();
    const j = ++U.jeton;
    const onceki = U.durum;
    U.kilit = true;
    // eski sayfa hafifçe solar (sayfa çevrilir)
    const svg = $('#tahta');
    if (onceki && onceki.hamleler.length) Ses.cal('sayfa');
    if (onceki && onceki.hamleler.length && KL.animasyonVar()) {
      const a = svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      await enCok(a.finished.catch(() => {}), 500);
      if (j !== U.jeton) return;
      a.cancel();
    }
    // kim X: bilgisayara karşı her oyunda değişir; iki kişide kaybeden X alır, berabere ise değişir
    const a = U.ayar, izliyordu = U.izle;
    U.izle = !!o.izle;
    if (U.oyun && a.rakip !== U.oyun.rakip) { U.benX = true; U.aX = true; }
    else if (onceki && !o.ayniSira && !izliyordu && !U.izle && onceki.hamleler.length) {
      if (U.oyun.rakip === 'bilgisayar') U.benX = !U.benX;
      else if (onceki.bitti && onceki.kazanan !== 'berabere') U.aX = U.sahip[onceki.kazanan] !== 'a';
      else U.aX = !U.aX;
    }
    const boyut = a.sayfa === 'sinirsiz' ? 0 : C.boyut;
    U.oyun = { rakip: a.rakip, zorluk: a.zorluk, sayfa: a.sayfa, murekkepler: a.murekkepler.slice(), boyut };
    U.oyunId++;
    AI.ttTemizle();
    U.durum = B.yeniOyun({ boyut, tamBes: C.tamBes, hamleSiniri: C.hamleSiniri });
    U.alan = B.gorunurAlan(U.durum);
    U.gecmis = []; U.dugum = []; U.taze = null; U.secili = null;
    U.sahip = U.izle ? { 1: 'izleX', 2: 'izleO' }
      : a.rakip === 'bilgisayar'
        ? (U.benX ? { 1: 'ben', 2: 'bilgisayar' } : { 1: 'bilgisayar', 2: 'ben' })
        : (U.aX ? { 1: 'a', 2: 'b' } : { 1: 'b', 2: 'a' });
    if (!U.izle && (!U.seri || U.seri.bitti || U.seri.hedef !== (+a.seri || 1) || U.seri.rakip !== a.rakip)) seriSifirla();
    U.seriSayildi = null;
    U.terimler = new Set();
    $('#terimler').textContent = '';
    $('#not').textContent = '';
    $('#aciklama').textContent = '';
    goster('#analiz', false);
    goster('#izle-dur', U.izle);
    if (olcuHesapla()) sozcukleriCiz(true);
    U.T = D.tahtaKur(svg, U.alan);
    if (boyut) D.koseIsaretleri(U.T, boyut, U.oyunId, !!onceki);
    hucreleriKur(U.alan);
    tahtayiOrtala();
    ayarlariCiz();
    tehditSozcugu();
    U.kilit = false;
    siraIlerle();
  }

  /* ---------- komutlar ---------- */

  function komutlariGuncelle() {
    const g = $('#geri');
    g.disabled = !(geriAlinabilir() || (!!U.iptal && U.gecmis.length > 0));
    if (C.yarisma) { g.hidden = true; $('#ipucu').hidden = true; }
    $('#ipucu').disabled = !U.durum || !insanSirasi() || U.kilit;
  }
  function tehditSozcugu() {
    const b = $('#tehditler'), acik = String(!!tehditAcik());
    if (b.getAttribute('aria-pressed') !== acik) { b.setAttribute('aria-pressed', acik); if (U.l) sozcukYenile(b); }
  }

  /* ---------- olaylar ---------- */

  function olaylariBagla() {
    const kap = $('#hucreler');
    let sonIsaretci = 'mouse';
    kap.addEventListener('pointerdown', (e) => { sonIsaretci = e.pointerType || 'mouse'; }, { passive: true });
    kap.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = e.target.closest('.hucre');
      if (!b) return;
      const r = +b.dataset.r, c = +b.dataset.c;
      if (U.secili && U.secili[0] === r && U.secili[1] === c) return;
      U.secili = [r, c];
      onizlemeGoster(r, c);
    });
    kap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') onizlemeSil(); });
    kap.addEventListener('click', (e) => {
      const b = e.target.closest('.hucre');
      if (!b) return;
      const r = +b.dataset.r, c = +b.dataset.c;
      if (B.tas(U.durum, r, c) || !insanSirasi() || U.kilit) return;          // dolu kare: hiçbir şey
      const klavye = e.detail === 0;
      const ikiDokunus = U.ayar.ikiDokunus === 'evet' && !klavye && sonIsaretci !== 'mouse';
      if (ikiDokunus && !(U.secili && U.secili[0] === r && U.secili[1] === c)) {
        U.secili = [r, c];
        onizlemeGoster(r, c);
        duyur(`${B.hucreAdi(r, c)} taslak: yazmak için yeniden dokun`);
        return;
      }
      insanYazar(r, c);
    });
    // klavye: oklar kurşun imleci gezdirir (önizleme), Enter / boşluk yazar
    kap.addEventListener('keydown', (e) => {
      const yon = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!yon) return;
      e.preventDefault();
      const r = U.imlec[0] + yon[0], c = U.imlec[1] + yon[1];
      if (alanIcinde(r, c)) imleceGit(r, c);
    });
    kap.addEventListener('focusin', (e) => {
      const b = e.target.closest('.hucre');
      if (!b) return;
      const r = +b.dataset.r, c = +b.dataset.c;
      U.imlec = [r, c];
      if (b.matches(':focus-visible')) { KL.odakCiz(b, 'kutu'); onizlemeGoster(r, c); U.secili = [r, c]; }
    });
    kap.addEventListener('focusout', (e) => { const b = e.target.closest('.hucre'); if (b) KL.odakSil(b); });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); geriAl(); }
    });

    $('#yeni').addEventListener('click', () => { KL.dugmeAltiVurgu($('#yeni')); yeniOyun(); });
    $('#geri').addEventListener('click', () => { KL.dugmeAltiVurgu($('#geri')); geriAl(); });
    $('#tehditler').addEventListener('click', () => {
      U.ayar.tehditler = !tehditAcik();
      ayarYaz();
      tehditSozcugu();
      tehditCiz();
    });
    $('#ipucu').addEventListener('click', () => { KL.dugmeAltiVurgu($('#ipucu')); ipucu(); });
    $('#ses').addEventListener('click', () => {
      Ses.baslat();
      Ses.sessizYap(!Ses.sessiz);
      $('#ses').setAttribute('aria-pressed', String(!Ses.sessiz));
      sozcukYenile($('#ses'));
      duyur(Ses.sessiz ? 'ses kapalı' : 'ses açık');
    });
    // tarayıcılar ilk dokunuştan önce ses çaldırmaz
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    $('#analiz').addEventListener('click', () => analizYap());
    $('#analiz-kapat').addEventListener('click', () => { analizKapat(); goster('#analiz', true); });
    $('#nasil').addEventListener('click', () => { KL.dugmeAltiVurgu($('#nasil')); nasilAc($('#nasil-not').hidden); });
    $('#nasil-kapat').addEventListener('click', () => nasilAc(false));
    $('#izle').addEventListener('click', () => { nasilAc(false); yeniOyun({ izle: true }); });
    $('#izle-dur').addEventListener('click', () => yeniOyun());
    $$('.sozcuk').forEach(b => b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !b.disabled) KL.dugmeAltiVurgu(b); }));
    $$('.ayar').forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      U.ayar[b.dataset.ayar] = b.dataset.deger;
      ayarDegisti();
    }));

    let bekleyen = 0;
    const boyut = () => {
      cancelAnimationFrame(bekleyen);
      bekleyen = requestAnimationFrame(() => { if (olcuHesapla()) { sozcukleriCiz(true); ayarlariCiz(); } });
    };
    window.addEventListener('resize', boyut);
    window.addEventListener('orientationchange', boyut);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', boyut);
  }

  function imleceGit(r, c) {
    const eski = hucreButonu(...U.imlec);
    if (eski) eski.tabIndex = -1;
    U.imlec = [r, c];
    const b = hucreButonu(r, c);
    b.tabIndex = 0;
    b.focus({ preventScroll: true });
    goruneGetir(r, c);
  }

  /* ---------- başlangıç ---------- */

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    Kit.malzeme.sec('dolmakalem', { cizim: C.cizim, renk: C.renk });
    Ses.kur({ anahtar: 'xox-sessiz' });
    $('#ses').setAttribute('aria-pressed', String(!Ses.sessiz));
    U.ayar = ayarOku();
    olcuHesapla();
    await Promise.all([KL.fontBekle(), KL.fontBekle('Marck Script', "5'li XOX beş doldu")]);
    $$('.sozcuk .yazi').forEach(y => KL.harfle(y, null, { tohum: ['sozcuk', y.textContent], anlik: true }));
    $('#dusunuyor').textContent = 'düşünüyor';
    lekeleriKur();
    olaylariBagla();
    sozcukleriCiz(false);
    await yeniOyun();
    XOX.ui = { U, yeniOyun, geriAl, insanYazar, olcuHesapla };      // konsoldan ve testlerden denemek için
  }

  basla();
})();
