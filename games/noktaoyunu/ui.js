// ui.js — kontrolör: ölçü, font, sahne ve oyun akışı. Kurallar board.js'te (DOM'suz), zincirler chains.js'te,
// bilgisayar ai.js'te (Faz 4; yoksa yer tutucu), çizim draw.js ve kit/ altında; burada yalnız onları birbirine bağlarız.
//
// jeton: süren akışın kimliği; yeni sayfa / geri alma artırır, bekleyen adımlar jeton değişmişse sessizce çıkar.
// kilit: animasyon ve bilgisayar sırası boyunca dokunmayı engeller; ilk await'ten ÖNCE eşzamanlı kurulur.
(function () {
  'use strict';

  const NK = window.NK, Kit = window.Kit;
  const C = NK.config, D = NK.draw, Lay = NK.layout, BD = NK.board, CH = NK.chains, KL = Kit.kalem, KB = Kit.kuruboya;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const Ses = Kit.ses ? Kit.ses.kur({ anahtar: 'nk-sessiz' }) : { cal() {}, baslat() {}, sessiz: false, sessizYap() {}, durdur() {} };
  const BOYUTLAR = C.boyutlar;

  const O = {
    jeton: 0, oyunId: 0, l: null, S: null,
    durum: null, gecmis: [], kayit: [], kilit: true, gecis: false, gosteri: null,
    ayar: null, oyunAyar: null, aiKontrol: null,
    ipucu: -1, imlec: -1, onizleme: -1, sonDurum: '', baslayan: 0, notAcik: null, bas: null,
  };

  /* ---------- saklama (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const bellek = {};
  function depoOku(ad) { try { const s = localStorage.getItem(ad); return s ? JSON.parse(s) : bellek[ad]; } catch (e) { return bellek[ad]; } }
  function depoYaz(ad, v) { bellek[ad] = v; try { localStorage.setItem(ad, JSON.stringify(v)); } catch (e) { /* yoksay */ } }

  const harfGecerli = (h) => typeof h === 'string' && /^[A-ZÇĞİÖŞÜ]$/.test(h);

  function ayarlariYukle() {
    const a = { mod: C.mod, zorluk: C.zorluk, boyut: C.boyut, harf: C.basHarf.slice(), ikiHarf: C.ikiKisiHarf.slice(),
      palet: C.palet, tehlike: C.tehlike, zincirler: C.zincirler };
    const k = depoOku('nk-ayar');
    if (k && typeof k === 'object') {
      if (['bilgisayar', 'ikiKisi', 'bulmaca'].includes(k.mod)) a.mod = k.mod;
      if (['kolay', 'orta', 'zor'].includes(k.zorluk)) a.zorluk = k.zorluk;
      if (BOYUTLAR[k.boyut]) a.boyut = k.boyut;
      if (KB.PALET[k.palet]) a.palet = k.palet;
      for (const ad of ['harf', 'ikiHarf']) if (Array.isArray(k[ad]) && k[ad].length === 2 && k[ad].every(harfGecerli) && k[ad][0] !== k[ad][1]) a[ad] = k[ad];
      if (k.tehlike === null || typeof k.tehlike === 'boolean') a.tehlike = k.tehlike;
      if (typeof k.zincirler === 'boolean') a.zincirler = k.zincirler;
    }
    O.ayar = a;
    const b = depoOku('nk-bulmaca');
    O.bulmaca = { no: 0, cozulen: [] };
    if (b && Number.isInteger(b.no) && b.no >= 0 && b.no < bulmacaListesi().length) O.bulmaca.no = b.no;
    if (b && Array.isArray(b.cozulen)) O.bulmaca.cozulen = b.cozulen.filter(Number.isInteger);
  }
  const bulmacaListesi = () => NK.bulmacalar || [];
  const bulmacaSakla = () => depoYaz('nk-bulmaca', O.bulmaca);
  const ayarSakla = () => depoYaz('nk-ayar', O.ayar);

  /* ---------- yardımcılar ---------- */

  const iki = () => O.oyunAyar.mod === 'ikiKisi';
  const gosteri = () => O.oyunAyar.mod === 'gosteri';           // "izle": iki bilgisayar
  const bulmaca = () => O.oyunAyar.mod === 'bulmaca';           // "bu konumda kazan": rakip zor bilgisayar
  const harfler = () => (iki() ? O.oyunAyar.ikiHarf : O.oyunAyar.harf);
  const insanSirasi = () => !O.durum.bitti && !gosteri() && (iki() || O.durum.sira === 0);
  const tehlikeAcik = () => (O.ayar.tehlike ?? (!iki() && O.oyunAyar.zorluk === 'kolay'));
  const etiket = (p) => (gosteri() ? `${p + 1}. bilgisayar` : iki() ? `${p + 1}. oyuncu` : p === 0 ? 'sen' : 'bilgisayar');
  const kim = (p) => (iki() || gosteri() ? harfler()[p] : p === 0 ? 'Sen' : 'Bilgisayar');
  const duyur = (t) => { $('#duyuru').textContent = t; };
  const oyunBasladi = () => O.kayit.length > 0;

  /* ---------- ölçü ve sahne ---------- */

  function olcuHesapla() {
    const { vw, vh } = KL.alan();
    const [m, n] = O.oyunAyar.mn;
    const l = Lay.hesapla(vw, vh, m, n);
    const st = document.documentElement.style;
    const ata = (ad, v) => st.setProperty(ad, String(v));
    ata('--sq', l.sq + 'px'); ata('--W', l.W); ata('--H', l.H);
    ata('--tx', l.tahta.x); ata('--ty', l.tahta.y); ata('--tw', l.tahta.w); ata('--th', l.tahta.h);
    ata('--kx', l.komutlar.x); ata('--ky', l.komutlar.y); ata('--kw', l.komutlar.w);
    ata('--nx', l.not.x); ata('--ny', l.not.y); ata('--nw', l.not.w);
    document.body.dataset.duzen = l.mod;
    document.body.classList.toggle('kaydir', l.kaydir);
    const onceki = O.l;
    O.l = l;
    return !onceki || onceki.mod !== l.mod || onceki.sq !== l.sq || onceki.W !== l.W || onceki.H !== l.H;
  }

  // Sahneyi durumdan baştan kurar (ilk açılış, yeni sayfa, boyut değişimi). Var olan çizgi ve kutular anında çizilir.
  function sahneCiz(anlik, yeniSayfa = false) {
    const d = O.durum, h = harfler();
    const S = O.S = D.sahneKur($('#kagit'), O.l, O.oyunId, d.G);
    const g0 = anlik ? 0 : 1;
    D.baslikYaz(S, 'Nokta Oyunu', { anlik, gecikme: (yeniSayfa ? 450 : 0) * g0 });
    D.noktalarCiz(S, d.m, d.n);
    for (let e = 0; e < d.G.E; e++) if (d.cizgi[e]) D.cizgiE(S, e, { anlik: true });
    if (d.son) D.sonCizgi(S, S.cizgi.get(d.son.e));
    for (let k = 0; k < d.G.K; k++) if (d.sahip[k] >= 0) D.kutuK(S, k, d.sahip[k], h[d.sahip[k]], { anlik: true });
    [0, 1].forEach(p => {
      D.oyuncuYaz(S, p, h[p], etiket(p), { anlik, gecikme: (yeniSayfa ? 650 : 250) * g0 + p * 150 * g0 });
      D.puanYaz(S, p, d.puan[p], { anlik: true });
    });
    if (d.son && d.son.alinan.length && !d.bitti) D.birDaha(S, d.son.sira, { anlik: true });
    O.sonDurum = '';
    isaretleriGuncelle();
    durumGoster(true);
    if (d.bitti) sonucGoster(true);
    if (O.imlec >= 0 && $('#tahta-alan').matches(':focus-visible')) D.imlecCiz(S, O.imlec);
  }

  // Sahneyi durumla eşitle (geri alma): fazla çizgi ve kutular solarak silinir, puanlar yeniden yazılır.
  function esitle() {
    const d = O.durum, S = O.S, h = harfler();
    for (const e of Array.from(S.cizgi.keys())) if (!d.cizgi[e]) D.cizgiSil(S, e);
    for (let e = 0; e < d.G.E; e++) if (d.cizgi[e] && !S.cizgi.has(e)) D.cizgiE(S, e, { anlik: true });
    for (const k of Array.from(S.kutu.keys())) if (d.sahip[k] < 0) D.kutuSil(S, k);
    for (let k = 0; k < d.G.K; k++) if (d.sahip[k] >= 0 && !S.kutu.has(k)) D.kutuK(S, k, d.sahip[k], h[d.sahip[k]], { anlik: true });
    D.sonCizgi(S, d.son ? S.cizgi.get(d.son.e) : null);
    [0, 1].forEach(p => { if (S.puan[p] !== d.puan[p]) D.puanYaz(S, p, d.puan[p], { anlik: true }); });
    D.birDahaSil(S);
    if (d.son && d.son.alinan.length && !d.bitti) D.birDaha(S, d.son.sira, { anlik: true });
    D.sonucSil(S);
    D.kayipSil(S);
    D.dusunmeSil(S, true);
    ipucuKaldir();
    yeniSayfaVurgu(false);
    isaretleriGuncelle();
    durumGoster();
  }

  // Tehlike tikleri (insanın sırasında), zincir çevreleri, sıra işareti
  function isaretleriGuncelle() {
    const d = O.durum, S = O.S;
    D.tehlikeCiz(S, tehlikeAcik() && insanSirasi() ? BD.tehlikeli(d) : []);
    const izleZincir = O.gosteri && O.gosteri.zincirGoster;
    if ((O.ayar.zincirler || izleZincir) && !d.bitti) D.zincirlerCiz(S, CH.parcala(d).parcalar, { enAz: izleZincir && !O.ayar.zincirler ? 3 : 1 });
    else D.zincirlerCiz(S, []);
    D.siraGoster(S, d.bitti ? -1 : d.sira);
  }

  function durumMetni() {
    const d = O.durum;
    if (d.bitti) return 'oyun bitti';
    if (iki() || gosteri()) return `sıra: ${harfler()[d.sira]}`;
    if (bulmaca() && d.sira === 0) { const b = bulmacaListesi()[O.bulmaca.no]; return `bulmaca ${O.bulmaca.no + 1}/${bulmacaListesi().length} · ${b.zorluk}: kazan`; }
    return d.sira === 0 ? 'sıra sende' : 'bilgisayar düşünüyor';
  }

  function durumGoster(zorla) {
    const t = durumMetni();
    if (t === O.sonDurum && !zorla) return;
    O.sonDurum = t;
    D.durumYaz(O.S, t, {});
  }

  function kilitle(v) {
    O.kilit = v;
    if (v && O.S) { D.onizlemeSil(O.S); O.onizleme = -1; }
    $('#tahta-alan').classList.toggle('etkin', !v && insanSirasi());
    $('#geri-al').disabled = O.gecis || !O.gecmis.length;
  }

  /* ---------- en yakın çizgi (dokunma ve fare) ---------- */

  // İstemci koordinatından en yakın çizgi. Eşik ve ayrım ekran pikseli: noktaya iki çizgi neredeyse eşit uzaksa
  // (köşe) hiçbiri seçilmez; en yakın çizgi zaten çekiliyse de hiçbiri (komşusu yanlışlıkla çekilmesin).
  function enYakin(cx, cy) {
    const svg = $('#kagit'), m = svg.getScreenCTM();
    if (!m) return { e: -1, neden: 'yok' };
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(m.inverse()), olcek = Math.hypot(m.a, m.b);
    const G = O.durum.G;
    let en = Infinity, ikinci = Infinity, e0 = -1;
    for (let e = 0; e < G.E; e++) {
      const [[r1, c1], [r2, c2]] = G.KENAR_UC[e];
      const [x1, y1] = D.yer(O.l, r1, c1), [x2, y2] = D.yer(O.l, r2, c2);
      const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy)));
      const u = Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
      if (u < en) { ikinci = en; en = u; e0 = e; } else if (u < ikinci) ikinci = u;
    }
    en *= olcek; ikinci *= olcek;
    if (en > C.dokunma.esikPx) return { e: -1, neden: 'uzak' };
    if (ikinci - en < C.dokunma.ayrimPx) return { e: -1, neden: 'belirsiz' };
    if (O.durum.cizgi[e0]) return { e: -1, neden: 'cekili', cekili: e0 };
    return { e: e0 };
  }

  /* ---------- hamle ---------- */

  // Bir çizgiyi sahnede oynar ve durumu ilerletir: kalemle çizgi, kapanan kutular karalanır ve harflenir, puan.
  // false dönerse akış arada değişmiştir (yeni sayfa / geri alma); çağıran çıkmalı.
  async function hamleOyna(e, j) {
    const S = O.S, once = O.durum, p = once.sira, h = harfler();
    const yeni = BD.uygula(once, e);
    O.durum = yeni;
    O.kayit.push({ durum: once, e });                          // oyun sonu analizi için bütün hamleler
    D.birDahaSil(S);
    D.onizlemeSil(S); O.onizleme = -1;
    ipucuKaldir();
    D.tehlikeCiz(S, []);
    const c = D.cizgiE(S, e, { sureMs: [120, 160] });
    D.sonCizgi(S, c.node);
    Ses.cal('grafit', 0, 140);
    const alinan = yeni.son.alinan;
    duyur(`${kim(p)}: ${yeni.G.kenarAdi(e)}${alinan.length ? `, ${alinan.length} kutu` : ''}`);
    await KL.bekle(c.sure + 30);
    if (j !== O.jeton) return false;
    if (alinan.length) {
      const isler = [];
      let gec = 0;
      for (const k of alinan) {
        const s = D.kutuK(S, k, p, h[p], { gecikme: gec });
        Ses.cal('karalama', gec, 250);
        Ses.cal('cizik', gec + 290);
        isler.push(s.bitti);
        gec += s.sure * .85;
      }
      isler.push(D.puanYaz(S, p, yeni.puan[p], { yeni: true, gecikme: gec * .5 }).bitti);
      await Promise.all(isler);
      if (j !== O.jeton) return false;
      if (!yeni.bitti) D.birDaha(S, p);
    }
    isaretleriGuncelle();
    durumGoster();
    return true;
  }

  // Hamleden sonra: oyun bittiyse sonuç; sıra bilgisayardaysa o oynasın; yoksa kilit açılır.
  async function sirayiIlerlet(j) {
    for (;;) {
      if (O.durum.bitti) { bitir(); return; }
      if (insanSirasi()) break;
      if (!(await rakipOyna(j))) return;
    }
    durumGoster();
    isaretleriGuncelle();
    kilitle(false);
  }

  function hataYakala(e, j) {
    if (j !== O.jeton || (e && e.name === 'AbortError')) return;
    console.error(e);
    O.sonDurum = '';
    D.durumYaz(O.S, 'aksilik oldu · geri al', { renk: 'vurgu' });
    kilitle(false);
  }

  async function insanHamlesi(e) {
    if (O.kilit || O.gecis || !insanSirasi() || O.durum.cizgi[e]) return;
    const j = O.jeton;
    O.gecmis.push({ durum: BD.kopya(O.durum), n: O.kayit.length });
    kilitle(true);
    try {
      if (!(await hamleOyna(e, j))) return;
      await sirayiIlerlet(j);
    } catch (er) { hataYakala(er, j); }
  }

  /* ---------- bilgisayar ---------- */

  // ai.js'in seçimi (dilimli, iptal edilebilir); ai.js yüklenemediyse yer tutucu: kapatabiliyorsa kapatır, yoksa
  // rastgele güvenli, yoksa rastgele. butceMs: zor modun arama bütçesi (ipucu daha kısa).
  async function rakipKarar(d, signal, zorluk = O.oyunAyar.zorluk, butceMs = C.ai.zor.butceMs, rng) {
    if (NK.ai) return NK.ai.secAsync(d, { zorluk, butceMs, derinlik: C.ai.zor.derinlik, rng }, { signal });
    const al = BD.alinabilir(d);
    if (al.length) return { e: al[0], neden: 'al' };
    const g = BD.guvenli(d), l = g.length ? g : BD.hamleler(d);
    return { e: l[Math.floor(Math.random() * l.length)], neden: 'guvenli' };
  }
  const rakipSec = async (...a) => (await rakipKarar(...a)).e;

  async function rakipOyna(j) {
    durumGoster();
    const d = O.durum, zincirde = !!(d.son && d.son.alinan.length && d.son.sira === d.sira);
    const [a, b] = gosteri() ? C.izle.bekleMs : C.ai.enAzBekleMs, enAz = zincirde ? C.ai.zincirAraMs : a + Math.random() * (b - a);
    if (!zincirde) D.dusunmeCiz(O.S, { sureMs: enAz });
    const t0 = performance.now(), kontrol = new AbortController();
    O.aiKontrol = kontrol;
    let karar;
    try { karar = await rakipKarar(d, kontrol.signal, gosteri() ? 'orta' : O.oyunAyar.zorluk, C.ai.zor.butceMs, O.gosteri ? O.gosteri.rng : undefined); }
    finally { if (O.aiKontrol === kontrol) O.aiKontrol = null; }
    if (j !== O.jeton) return false;
    await KL.bekle(Math.max(0, enAz - (performance.now() - t0)));
    if (j !== O.jeton) return false;
    D.dusunmeSil(O.S);
    if (!(await hamleOyna(karar.e, j))) return false;
    if (O.gosteri) return gosteriDurak(karar, j);
    return true;
  }

  /* ---------- oyun sonu ---------- */

  function sonucGoster(anlik) {
    const d = O.durum, k = BD.kazanan(d), h = harfler();
    if (bulmaca()) {
      const metin = k === 0 ? 'Çözdün' : 'Olmadı';
      D.sonucYaz(O.S, metin, `${d.puan[0]}\u00a0–\u00a0${d.puan[1]}`, { renk: k === 0 ? 0 : '#7d7068', anlik, gecikme: anlik ? 0 : 250 });
      return metin;
    }
    const metin = iki() || gosteri() ? (k === 'berabere' ? 'Berabere' : `${h[k]} kazandı`) : k === 0 ? 'Kazandın' : k === 1 ? 'Kaybettin' : 'Berabere';
    D.sonucYaz(O.S, metin, `${d.puan[0]}\u00a0–\u00a0${d.puan[1]}`, { renk: k === 'berabere' ? '#7d7068' : k, anlik, gecikme: anlik ? 0 : 250 });
    return metin;
  }

  function bitir() {
    const d = O.durum;
    D.dusunmeSil(O.S);
    D.birDahaSil(O.S);
    const metin = sonucGoster(false);
    isaretleriGuncelle();
    durumGoster();
    duyur(`${metin}. ${d.puan[0]} – ${d.puan[1]}.`);
    if (O.gosteri) aciklamaYaz(`${metin}, ${d.puan[0]} – ${d.puan[1]}. Dokununca yeni sayfa başlar.`, false);
    else if (bulmaca()) bulmacaBitti(d.puan[0] > d.puan[1]);
    else yeniSayfaVurgu(true);
    kilitle(false);
    analizEt(O.jeton);
  }

  // Oyun sonu analizi (chains.analizUretec, dilimli): uzun zincir sayısı notu ve kaybedenin kaybettiği çizgi
  async function analizEt(j) {
    const g = CH.analizUretec(O.kayit.slice(), O.durum, { sinir: 22, butceMs: 120 });
    let a;
    for (;;) {
      const dilim = performance.now() + 12;
      do a = g.next(); while (!a.done && performance.now() < dilim);
      if (a.done) break;
      await KL.bekle(0);
      if (j !== O.jeton) return;
    }
    if (j !== O.jeton || !O.durum.bitti) return;
    const r = a.value, notlar = [];
    if (r.uzunZincir !== null) notlar.push(`${r.uzunZincir} uzun zincir (${r.uzunZincir % 2 ? 'tek' : 'çift'})`);
    O.sonDurum = '';
    D.durumYaz(O.S, ['oyun bitti', ...notlar].join(' · '), {});
    if (r.hamle) {
      const ad = kim(r.kaybeden);
      const metin = gosteri() || iki() ? `${ad} burada kaybetti` : r.kaybeden === 0 ? 'burada kaçtı' : 'bilgisayar burada kaybetti';
      D.kayipIsaretle(O.S, r.hamle.e, metin);
      duyur(`Analiz: ${notlar.join(', ')}. ${ad}, ${O.durum.G.kenarAdi(r.hamle.e)} çizgisiyle kaybetti.`);
    } else if (notlar.length) duyur('Analiz: ' + notlar.join(', '));
  }

  function yeniSayfaVurgu(acik) {
    const b = $('#yeni-sayfa');
    if (acik) KL.dugmeAltiCiz(b, 700, false, { strokeWidth: 2.6 });
    else if (b.dataset.vurgulu) KL.dugmeAltiCiz(b, 0, true);
    if (acik) b.dataset.vurgulu = '1'; else delete b.dataset.vurgulu;
  }

  // Bulmaca bitti: çözüldüyse kaydedilir; "sonraki bulmaca" her zaman, "tekrar" çözülmediyse öne çıkar
  function bulmacaBitti(cozdu) {
    const no = O.bulmaca.no;
    if (cozdu && !O.bulmaca.cozulen.includes(no)) O.bulmaca.cozulen.push(no);
    bulmacaSakla();
    $('#sonraki').hidden = false;
    $('#tekrar').hidden = cozdu;
    sozcukleriCiz(true);
    duyur(cozdu ? `Bulmaca ${no + 1} çözüldü.` : `Bulmaca ${no + 1} çözülemedi. Tekrar dene.`);
  }

  function bulmacaSonraki() {
    O.bulmaca.no = (O.bulmaca.no + 1) % bulmacaListesi().length;
    bulmacaSakla();
    yeniSayfa({ ayniBaslayan: true });
  }

  /* ---------- geri alma ---------- */

  // İki kişide son çizgi; bilgisayara karşı son çizgim ve ardından gelen bilgisayar çizgileri (düşünüyorsa hesap iptal).
  function geriAl() {
    if (O.gecis || O.gosteri || !O.gecmis.length) return;
    if (O.aiKontrol) O.aiKontrol.abort();
    O.jeton++;
    const g = O.gecmis.pop();
    O.durum = g.durum;
    O.kayit.length = g.n;
    $$('.bulmaca-komut').forEach(b => { b.hidden = true; });
    esitle();
    sozcukleriCiz(true);
    kilitle(false);
    duyur('Geri alındı. ' + durumMetni());
    if (!insanSirasi() && !O.durum.bitti) { const j = O.jeton; kilitle(true); sirayiIlerlet(j).catch(e => hataYakala(e, j)); }
  }

  /* ---------- yeni sayfa ---------- */

  // Sayfa çevirme: mevcut sayfanın donmuş kopyası defterin cildi (sol kenar) etrafında dönerek kalkar; altındaki gerçek
  // sayfa o sırada temizlenip kalemle yeniden çizilir. Az hareket ayarında hiçbir şey yapılmaz. (dokuztas kalıbı)
  function sayfaCevir() {
    if (!KL.animasyonVar()) return Promise.resolve();
    const sayfa = $('#sayfa'), kopya = sayfa.cloneNode(true);
    kopya.removeAttribute('id');
    kopya.classList.add('cevrilen');
    kopya.setAttribute('aria-hidden', 'true');
    kopya.inert = true;
    for (const e of kopya.querySelectorAll('[id]')) if (!e.closest('defs')) e.removeAttribute('id');
    for (const e of kopya.querySelectorAll('.not, .tahta-alan')) e.remove();
    $('#defter').appendChild(kopya);
    Ses.cal('kayma', 0, 'sayfa');
    const a = kopya.animate([
      { transform: 'perspective(2200px) rotateY(0deg)', filter: 'brightness(1)' },
      { transform: 'perspective(2200px) rotateY(-38deg) translateZ(18px)', filter: 'brightness(.97)', offset: .45 },
      { transform: 'perspective(2200px) rotateY(-92deg) translateZ(30px)', filter: 'brightness(.82)' },
    ], { duration: 760, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
    return a.finished.then(() => kopya.remove(), () => kopya.remove());
  }

  function yeniOyunKur(ayniBaslayan, izle) {
    const bl = !izle && O.ayar.mod === 'bulmaca' && bulmacaListesi()[O.bulmaca.no];
    O.oyunAyar = izle
      ? { mod: 'gosteri', zorluk: 'orta', boyut: '5x5', harf: ['A', 'B'], ikiHarf: ['A', 'B'], palet: O.ayar.palet }
      : bl ? { mod: 'bulmaca', zorluk: 'zor', boyut: `${bl.m}x${bl.n}`, harf: O.ayar.harf.slice(), ikiHarf: O.ayar.ikiHarf.slice(), palet: O.ayar.palet }
      : { mod: O.ayar.mod === 'bulmaca' ? 'bilgisayar' : O.ayar.mod, zorluk: O.ayar.zorluk, boyut: O.ayar.boyut, harf: O.ayar.harf.slice(), ikiHarf: O.ayar.ikiHarf.slice(), palet: O.ayar.palet };
    O.oyunAyar.mn = bl ? [bl.m, bl.n] : BOYUTLAR[O.oyunAyar.boyut];
    KB.palet(O.oyunAyar.palet);
    if (!ayniBaslayan && !izle && !bl) { O.baslayan = 1 - O.baslayan; depoYaz('nk-baslayan', O.baslayan); }
    const [m, n] = O.oyunAyar.mn;
    O.durum = bl ? BD.kur({ m, n, bos: bl.bos, sira: 0, baslayan: 0 }) : BD.yeniOyun({ m, n, baslayan: izle ? 0 : O.baslayan });
    $$('.bulmaca-komut').forEach(b => { b.hidden = true; });
    O.gecmis = [];
    O.kayit = [];
    O.oyunId++;
    O.ipucu = -1; O.imlec = -1; O.onizleme = -1;
    yeniNotGuncelle();
  }

  // o: { cevir (sayfa çevrilsin, varsayılan true), anlik, ayniBaslayan (ayar değişiminde yeniden kurulurken) }
  async function yeniSayfa(o = {}) {
    if (O.aiKontrol) O.aiKontrol.abort();
    const j = ++O.jeton;
    const cevir = o.cevir !== false;
    O.gecis = cevir;
    kilitle(true);
    const donus = cevir ? sayfaCevir() : null;
    yeniOyunKur(o.ayniBaslayan, o.izle);
    const degisti = olcuHesapla();
    const anlik = o.anlik || !KL.animasyonVar();
    sahneCiz(anlik, true);
    sozcukleriCiz(true);
    yeniSayfaVurgu(false);
    duyur(`Yeni sayfa. ${durumMetni()}.`);
    await Promise.all([donus, KL.bekle(anlik ? 0 : 900)]);
    if (j !== O.jeton) return;
    O.gecis = false;
    kilitle(true);
    sirayiIlerlet(j).catch(e => hataYakala(e, j));
  }

  /* ---------- izle: iki bilgisayar oynar, ilk "bir daha", ilk uzun zincir ve ilk "ikisi hariç"te durup açıklar ---------- */

  // Harfin okunuşuna göre ek: A, I, O, U kalın ünlüyle okunur (a, ı, o, u → 'ya, 'da); diğerleri ince (be, ce, … i, ö, ü → 'ye, 'de)
  const ek = (h, tur) => { const kalin = 'AIOU'.includes(h); return h + "'" + (tur === 'e' ? (kalin ? 'ya' : 'ye') : (kalin ? 'da' : 'de')); };

  function aciklamaYaz(metin, devamli) {
    const a = $('#aciklama');
    a.hidden = false;
    $('#aciklama-metin').innerHTML = metin;
    const d = $('#devam');
    d.hidden = !devamli;
    $$('#aciklama .sozcuk').forEach((b, i) => { if (!b.hidden) KL.dugmeAltiCiz(b, 150 + i * 120, false); });
  }

  function gosteriBaslat() {
    notAcKapa('nasil-not', false);
    notAcKapa('ayarlar', false);
    const tl = C.izle.tohumlar, tohum = tl[(O.izleNo = ((O.izleNo ?? -1) + 1)) % tl.length];
    O.gosteri = { duraklar: new Set(), zincirGoster: false, devam: null, rng: NK.ai ? NK.ai.rngYap(tohum) : Math.random };
    document.body.classList.add('gosteri');
    aciklamaYaz('İki bilgisayar oynuyor. Önemli anlarda durup burada açıklarım; dokununca izleme biter.', false);
    yeniSayfa({ izle: true });
  }

  function gosteriDurdur() {
    if (!O.gosteri) return;
    O.gosteri = null;
    document.body.classList.remove('gosteri');
    $('#aciklama').hidden = true;
    yeniSayfa({ ayniBaslayan: true });
    setTimeout(() => sozcukleriCiz(true), 0);
  }

  // Hamleden sonra: izlenecek bir an mı? Öyleyse not yazılır ve "devam"a basılana dek beklenir.
  async function gosteriDurak(karar, j) {
    const G = O.gosteri, d = O.durum, h = harfler();
    if (!G || d.bitti) return true;
    let metin = null;
    const ad = h[d.son.sira], rakip = h[1 - d.son.sira];
    if ((karar.neden === 'ikisiHaric' || karar.neden === 'dorduHaric') && !G.duraklar.has('ikisi')) {
      G.duraklar.add('ikisi');
      const n = karar.neden === 'ikisiHaric' ? 'iki' : 'dört';
      metin = `<span class="vurgu">${n === 'iki' ? 'İkisi' : 'Dördü'} hariç!</span> ${ad} son ${n} kutuyu almadı, ${ek(rakip, 'e')} bıraktı. Karşılığında sıradaki zinciri açmak ${ek(rakip, 'e')} kaldı: kontrol ${ek(ad, 'de')}.`;
    } else if (d.son.alinan.length && d.son.sira === d.sira && !G.duraklar.has('birDaha')) {
      G.duraklar.add('birDaha');
      metin = `${ad} kutunun dördüncü kenarını çekti: kutu onun, <span class="vurgu">bir daha</span> oynar.`;
    } else if (!G.duraklar.has('zincir')) {
      const z = CH.parcala(d).parcalar.find(p => p.uzun && !p.acik);
      if (z) {
        G.duraklar.add('zincir');
        G.zincirGoster = true;
        isaretleriGuncelle();
        metin = `Bu bir <span class="vurgu">zincir</span>: ${z.uzunluk} kutu. İlk çizgisini çeken bütün kutuları rakibine verir; uzun zincirleri kimin açacağı oyunu belirler.`;
      }
    }
    if (!metin) return true;
    kilitle(true);
    aciklamaYaz(metin, true);
    duyur($('#aciklama-metin').textContent);
    await new Promise(coz => { G.devam = coz; });
    if (j !== O.jeton || !O.gosteri) return false;
    aciklamaYaz('İki bilgisayar oynuyor. Dokununca izleme biter.', false);
    return true;
  }

  /* ---------- ipucu ---------- */

  function ipucuKaldir() { if (O.ipucu >= 0 && O.S) { D.ipucuSil(O.S); O.ipucu = -1; } }

  async function ipucuIste() {
    if (O.kilit || O.gecis || !insanSirasi()) return;
    if (O.ipucu >= 0) { ipucuKaldir(); return; }
    const j = O.jeton;
    kilitle(true);
    let e;
    const kontrol = new AbortController();
    O.aiKontrol = kontrol;
    try { e = await rakipSec(O.durum, kontrol.signal, 'zor', C.ai.ipucu.butceMs); }
    catch (er) { if (O.aiKontrol === kontrol) O.aiKontrol = null; hataYakala(er, j); return; }
    if (O.aiKontrol === kontrol) O.aiKontrol = null;
    if (j !== O.jeton) return;
    O.ipucu = e;
    D.ipucuGoster(O.S, e);
    duyur('İpucu: ' + O.durum.G.kenarAdi(e));
    kilitle(false);
  }

  /* ---------- ayarlar notu ---------- */

  const ayarDegeri = (ad) => O.ayar[ad];

  function ayarlariCiz(anlik) {
    const acik = !$('#ayarlar').hidden;
    $$('#ayarlar .ayar').forEach(b => {
      const secili = ayarDegeri(b.dataset.ayar) === b.dataset.deger;
      b.setAttribute('aria-pressed', String(secili));
      const eski = b.querySelector(':scope > svg.cerceve');
      if (eski) eski.remove();
      if (secili && acik) KL.dugmeAltiCiz(b, 0, anlik, { strokeWidth: 1.3 }, [-.5, 1.2]);
    });
    $$('#ayarlar [data-mod]').forEach(g => { g.dataset.gizli = String(!g.dataset.mod.split(' ').includes(O.ayar.mod)); });
    const L = bulmacaListesi(), b = L[O.bulmaca.no];
    if (b) $('#bulmaca-bilgi').textContent = `sıradaki: ${O.bulmaca.no + 1}/${L.length} (${b.zorluk}) · çözülen: ${O.bulmaca.cozulen.length}`;
    const ikiMod = O.ayar.mod === 'ikiKisi', harf = ikiMod ? O.ayar.ikiHarf : O.ayar.harf;
    [0, 1].forEach(p => {
      $('#harf-ad-' + p).textContent = ikiMod ? `${p + 1}. oyuncu` : p === 0 ? 'sen' : 'bilgisayar';
      const g = $('#harf-' + p);
      g.value = harf[p];
      g.setAttribute('aria-label', `${$('#harf-ad-' + p).textContent} için baş harf`);
      if (acik) KL.dugmeAltiCiz(g.parentNode, 0, true, { strokeWidth: 1.1 }, [-.5, 1]);
    });
    document.documentElement.style.setProperty('--kuruboya-1', KB.PALET[O.ayar.palet][0]);
    document.documentElement.style.setProperty('--kuruboya-2', KB.PALET[O.ayar.palet][1]);
  }

  function yeniNotGuncelle() {
    const a = O.ayar, o = O.oyunAyar;
    const ikiA = a.mod === 'ikiKisi';
    const bulmacaA = a.mod === 'bulmaca' && o && o.mod === 'bulmaca';
    const bekliyor = !!o && (a.mod !== o.mod || (!bulmacaA && a.boyut !== o.boyut) || a.palet !== o.palet || (a.mod === 'bilgisayar' && a.zorluk !== o.zorluk)
      || (ikiA ? a.ikiHarf.join() !== o.ikiHarf.join() : a.harf.join() !== o.harf.join()));
    const not = $('#yeni-not');
    not.hidden = !bekliyor;
    not.textContent = bekliyor ? 'yeni sayfada geçerli' : '';
  }

  // Ayar değişti: oyun başlamadıysa hemen (sayfa çevirmeden), başladıysa "yeni sayfada"
  function ayarUygula() {
    ayarSakla();
    ayarlariCiz(false);
    anahtarlariGuncelle();
    if (!oyunBasladi()) yeniSayfa({ cevir: false, anlik: true, ayniBaslayan: true });
    else yeniNotGuncelle();
  }

  function ayarTik(b) {
    const ad = b.dataset.ayar, v = b.dataset.deger;
    if (O.ayar[ad] === v) return;
    O.ayar[ad] = v;
    ayarUygula();
  }

  function harfGirdi(g, p) {
    const ikiMod = O.ayar.mod === 'ikiKisi', liste = ikiMod ? O.ayar.ikiHarf : O.ayar.harf;
    const v = (g.value || '').toLocaleUpperCase('tr').replace(/[^A-ZÇĞİÖŞÜ]/g, '').slice(-1);
    if (!harfGecerli(v) || v === liste[1 - p]) { g.value = liste[p]; return; }
    g.value = v;
    if (v === liste[p]) return;
    liste[p] = v;
    ayarUygula();
  }

  function notAcKapa(id, ac) {
    const n = $('#' + id), acik = ac === undefined ? n.hidden : ac;
    if (acik && O.notAcik && O.notAcik !== id) notAcKapa(O.notAcik, false);
    n.hidden = !acik;
    O.notAcik = acik ? id : (O.notAcik === id ? null : O.notAcik);
    document.body.classList.toggle('not-acik', !!O.notAcik);
    const dugme = { 'nasil-not': '#nasil', ayarlar: '#ayarlar-ac' }[id];
    $(dugme).setAttribute('aria-expanded', String(acik));
    if (acik) {
      if (O.S) { D.onizlemeSil(O.S); O.onizleme = -1; }
      $$('.sozcuk', n).forEach((b, i) => KL.dugmeAltiCiz(b, 200 + i * 150, false));
      if (id === 'ayarlar') ayarlariCiz(false);
    } else setTimeout(() => { sozcukleriCiz(true); $(dugme).focus({ preventScroll: true }); }, 0);
  }

  /* ---------- komut sözcükleri ---------- */

  function sozcukleriCiz(anlik) {
    $$('.komutlar .sozcuk').forEach((b, i) => KL.dugmeAltiCiz(b, anlik ? 0 : 900 + i * 110, anlik));
    if (O.notAcik) $$('#' + O.notAcik + ' .sozcuk').forEach(b => KL.dugmeAltiCiz(b, 0, true));
    if ($('#yeni-sayfa').dataset.vurgulu) KL.dugmeAltiCiz($('#yeni-sayfa'), 0, true, { strokeWidth: 2.6 });
    anahtarlariGuncelle();
  }

  // Açık/kapalı sözcükler: açıkken yalnız altı çizili; kapalıyken üstü de kalemle çizili (dokuztas "Ses" kalıbı)
  function ustuCiz(b, kapali) {
    const svg = b.querySelector(':scope > svg.cerceve');
    if (!svg) return;
    const eski = svg.querySelector('.ustu');
    if (eski) eski.remove();
    if (!kapali) return;
    const yazi = b.querySelector('.yazi'), bb = yazi.getBoundingClientRect(), kb = b.getBoundingClientRect();
    const olcek = kb.width ? b.offsetWidth / kb.width : 1;
    const x1 = (bb.left - kb.left) * olcek, x2 = x1 + bb.width * olcek, y = (bb.top - kb.top + bb.height * .55) * olcek;
    const g = KL.svgEl('g', { class: 'ustu' }, svg);
    KL.altiCiz(KL.kalemYap(svg), g, x1, x2, y, { tohum: ['ustu', b.id], anlik: true, ek: { strokeWidth: 1.4 } });
  }

  function anahtarlariGuncelle() {
    const durumlar = { tehlike: tehlikeAcik(), zincirler: O.ayar.zincirler, ses: !Ses.sessiz };
    for (const [id, acik] of Object.entries(durumlar)) {
      const b = $('#' + id);
      b.setAttribute('aria-pressed', String(acik));
      ustuCiz(b, !acik);
    }
  }

  /* ---------- klavye: tahtada imleç ---------- */

  function ortasi(e) {
    const [[r1, c1], [r2, c2]] = O.durum.G.KENAR_UC[e];
    return [(c1 + c2) / 2, (r1 + r2) / 2];
  }

  // Ok yönünde en yakın çizgi (yön ekseninde uzaklık + dik eksende iki kat ceza)
  function imlecKaydir(yon) {
    const G = O.durum.G;
    if (O.imlec < 0) { O.imlec = Math.min(...BD.hamleler(O.durum).concat([0])); return; }
    const [x0, y0] = ortasi(O.imlec), [ux, uy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[yon];
    let en = Infinity, sec = O.imlec;
    for (let e = 0; e < G.E; e++) {
      if (e === O.imlec) continue;
      const [x, y] = ortasi(e), ileri = (x - x0) * ux + (y - y0) * uy, yan = Math.abs((x - x0) * uy - (y - y0) * ux);
      if (ileri <= .01) continue;
      const puan = ileri + 2 * yan;
      if (puan < en) { en = puan; sec = e; }
    }
    O.imlec = sec;
  }

  function imlecGoster() {
    if (O.imlec < 0) return;
    D.imlecCiz(O.S, O.imlec);
    const e = O.imlec;
    duyur(`${O.durum.G.kenarAdi(e)} çizgisi, ${O.durum.cizgi[e] ? 'çekili' : BD.tehlikeli(O.durum).includes(e) ? 'boş, rakibe kutu verir' : 'boş'}`);
  }

  /* ---------- olaylar ---------- */

  function olaylariKur() {
    $$('.sozcuk .yazi').forEach(y => KL.harfle(y, null, { tohum: ['sozcuk', y.textContent], anlik: true }));
    $$('.sozcuk').forEach(b => b.addEventListener('click', () => KL.dugmeAltiVurgu(b)));
    $('#yeni-sayfa').addEventListener('click', () => yeniSayfa({ ayniBaslayan: bulmaca() }));
    $('#sonraki').addEventListener('click', bulmacaSonraki);
    $('#tekrar').addEventListener('click', () => yeniSayfa({ ayniBaslayan: true }));
    $('#geri-al').addEventListener('click', geriAl);
    $('#ipucu').addEventListener('click', ipucuIste);
    $('#tehlike').addEventListener('click', () => { O.ayar.tehlike = !tehlikeAcik(); ayarSakla(); anahtarlariGuncelle(); isaretleriGuncelle(); });
    $('#zincirler').addEventListener('click', () => { O.ayar.zincirler = !O.ayar.zincirler; ayarSakla(); anahtarlariGuncelle(); isaretleriGuncelle(); });
    $('#ses').addEventListener('click', () => { Ses.sessizYap(!Ses.sessiz); anahtarlariGuncelle(); if (!Ses.sessiz) Ses.cal('grafit', 0, 140); });
    $('#nasil').addEventListener('click', () => notAcKapa('nasil-not'));
    $('#nasil-kapat').addEventListener('click', () => notAcKapa('nasil-not', false));
    $('#izle').addEventListener('click', gosteriBaslat);
    $('#devam').addEventListener('click', () => { const G = O.gosteri; if (G && G.devam) { const c = G.devam; G.devam = null; c(); } });
    $('#izle-bitir').addEventListener('click', gosteriDurdur);
    document.addEventListener('pointerdown', (e) => {
      if (O.gosteri && !(e.target.closest && e.target.closest('#aciklama button'))) { e.preventDefault(); gosteriDurdur(); }
    }, true);
    $('#ayarlar-ac').addEventListener('click', () => notAcKapa('ayarlar'));
    $('#ayarlar-kapat').addEventListener('click', () => notAcKapa('ayarlar', false));
    $('#ayarlar').addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.ayar'); if (b) ayarTik(b); });
    [0, 1].forEach(p => {
      const g = $('#harf-' + p);
      g.addEventListener('input', () => harfGirdi(g, p));
      g.addEventListener('focus', () => g.select());
    });

    const alan = $('#tahta-alan');
    alan.addEventListener('pointerdown', (e) => { O.bas = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    alan.addEventListener('pointerup', (e) => {
      const b = O.bas;
      O.bas = null;
      if (!b || b.id !== e.pointerId || Math.hypot(e.clientX - b.x, e.clientY - b.y) > 12) return;
      if (O.kilit || O.gecis || !insanSirasi()) return;
      const r = enYakin(e.clientX, e.clientY);
      if (r.e >= 0) insanHamlesi(r.e);
      else if (r.neden === 'belirsiz' && e.pointerType !== 'mouse' && navigator.vibrate) navigator.vibrate(15);
    });
    alan.addEventListener('pointercancel', () => { O.bas = null; });
    alan.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = O.kilit || O.gecis || !insanSirasi() ? { e: -1 } : enYakin(e.clientX, e.clientY);
      if (r.e === O.onizleme) return;
      O.onizleme = r.e;
      D.onizleme(O.S, r.e);
    });
    alan.addEventListener('pointerleave', () => { O.onizleme = -1; D.onizlemeSil(O.S); });
    alan.addEventListener('focus', () => { if (!alan.matches(':focus-visible')) return; if (O.imlec < 0) imlecKaydir('ArrowRight'); imlecGoster(); });
    alan.addEventListener('blur', () => D.imlecSil(O.S));
    alan.addEventListener('keydown', (e) => {
      if (e.key.startsWith('Arrow')) { e.preventDefault(); imlecKaydir(e.key); imlecGoster(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && O.imlec >= 0) {
        e.preventDefault();
        if (!O.durum.cizgi[O.imlec]) insanHamlesi(O.imlec);
      }
    });

    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); geriAl(); return; }
      if (e.key === 'Escape' && O.gosteri) { gosteriDurdur(); return; }
      if (e.key === 'Escape' && O.notAcik) notAcKapa(O.notAcik, false);
    });
  }

  /* ---------- boyut ---------- */

  let bekleyen = 0;
  function yenidenBoyutla() {
    cancelAnimationFrame(bekleyen);
    bekleyen = requestAnimationFrame(() => {
      if (olcuHesapla()) { sahneCiz(true); sozcukleriCiz(true); if (O.notAcik === 'ayarlar') ayarlariCiz(true); }
    });
  }

  // Ekran görüntüleri için (docs/karsilastirma.html): index.html#ornek tohumlu iki orta bilgisayarla oyunun ortasına gelir
  function ornekKonum() {
    if (!NK.ai) return;
    const r = NK.ai.rngYap(4), [m, n] = BOYUTLAR[O.oyunAyar.boyut];
    O.durum = BD.yeniOyun({ m, n, baslayan: 0 });
    for (let i = 0; i < 30 && !O.durum.bitti; i++) {
      const e = NK.ai.sec(O.durum, { zorluk: 'orta', rng: r }).e;
      O.kayit.push({ durum: O.durum, e });
      O.durum = BD.uygula(O.durum, e);
    }
    if (O.durum.sira !== 0) { const e = NK.ai.sec(O.durum, { zorluk: 'orta', rng: r }).e; O.durum = BD.uygula(O.durum, e); }
  }

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    Kit.malzeme.sec('kursunkalem', { cizim: C.cizim, renk: C.renk });
    KB.kur({ palet: C.palet });
    D.ayarla(C.animasyon);
    ayarlariYukle();
    O.baslayan = depoOku('nk-baslayan') === 0 ? 0 : 1;      // yeniOyunKur çevirir: ilk oyunda sen başlarsın
    const ornek = location.hash === '#ornek';
    yeniOyunKur(ornek);                                    // örnek konum başlayanı değiştirmez ve kaydetmez
    if (ornek) ornekKonum();
    olcuHesapla();
    const fontHazir = await KL.fontBekle();
    olaylariKur();
    sahneCiz(false, false);
    sozcukleriCiz(false);
    if (!fontHazir) KL.fontGelince(() => { sahneCiz(true); sozcukleriCiz(true); });
    window.addEventListener('resize', yenidenBoyutla);
    window.addEventListener('orientationchange', yenidenBoyutla);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', yenidenBoyutla);
    NK.durum = O;                                         // konsoldan denemek için: NK.durum
    const j = ++O.jeton;
    kilitle(true);
    await KL.bekle(KL.animasyonVar() ? 900 : 0);
    if (j !== O.jeton) return;
    sirayiIlerlet(j).catch(e => hataYakala(e, j));
  }

  NK.ui = { O, enYakin, insanHamlesi, geriAl, yeniSayfa };
  basla();
})();
