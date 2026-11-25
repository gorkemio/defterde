// main.js — kontrolör: ölçü, font, sahne ve oyun akışı.
// Oyun kuralları game.js'te, çizim draw.js'te; burada yalnız ikisini birbirine bağlarız.
(function () {
  'use strict';

  const AB = window.AB;
  const C = AB.config, G = AB.game, D = AB.draw;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const bekle = (ms) => new Promise(r => setTimeout(r, ms));
  const rastgeleTohum = () => (Math.random() * 4294967296) >>> 0;
  const Ses = AB.ses || { cal() {}, baslat() {}, sessiz: false, sessizYap() {} };   // ses.js yoksa sessiz çalış

  let klavyeYerlestirme = null;
  const devamEdenler = new Set();
  function bekleyenleriUyandir() {
    for (const coz of devamEdenler) coz();
    devamEdenler.clear();
  }
  async function devamBekle(j) {
    while (O.duraklat && j === O.jeton) await new Promise(coz => devamEdenler.add(coz));
    return j === O.jeton;
  }
  function gorunumDegisti(l) {
    suruklemeIptal();
    klavyeYerlestirme?.iptal();
    const once = O.duraklat;
    O.duraklat = l.duraklat;
    O.kompakt = l.mod !== 'defter';
    etkinGuncelle();
    if (O.duraklat) duyur('Oyun bekletildi. Cihazı yana çevir veya tam ekranı dene.');
    else {
      bekleyenleriUyandir();
      if (once) duyur(O.sonDuyuru || 'Oyun devam ediyor.');
    }
  }

  // true: font hazır (ya da hiç gelmeyecek); false: 2,5 sn içinde gelmedi, yedek fontla başlıyoruz.
  const FONT = '26px "Patrick Hand"';
  function fontBekle() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(true);
    const yukle = document.fonts.load(FONT, 'AİŞĞÇÖÜıüöç0123456789').then(() => true, () => true);
    return Promise.race([yukle, new Promise(r => setTimeout(() => r(false), 2500))]);
  }

  function roughYok() {
    const p = document.createElement('p');
    p.className = 'uyari';
    p.textContent = 'Kalemim hazırlanamadı. Sayfayı yenileyip tekrar dene.';
    document.body.prepend(p);
  }

  /* ---------- oyun durumu ---------- */

  // jeton: oyunun kimliği. "Yeni sayfa" basılınca artar; eski oyunun bekleyen adımları jeton
  // değişmişse sessizce çıkar (yeni tahtaya yazamaz).
  const O = {
    jeton: 0, no: 0,
    tahta: {},                 // game.js tahtaları: { ben, rakip }
    cizim: {},                 // draw.js tahtaları: { ben, rakip }
    sira: 'ben', atis: { ben: 0, rakip: 0 },
    bitti: false, basladi: false, kilit: true, gecis: false,
    hazir: false, secili: null, duraklat: false, kompakt: false, dokunmatik: false, sonDuyuru: '',
    dizilebilir: false, surukle: null,     // dizilim aşaması: ilk atışa kadar gemiler taşınabilir
  };

  function onayModu() { return O.kompakt && (O.dokunmatik || window.matchMedia('(pointer: coarse)').matches); }
  function duyur(metin) { $('#duyuru').textContent = metin; }
  function etkinGuncelle() {
    const etkin = O.hazir && O.sira === 'ben' && !O.kilit && !O.bitti && !O.duraklat;
    $('#tahta-rakip').classList.toggle('etkin', etkin);
    $('#tahta-rakip').setAttribute('aria-disabled', String(!etkin));
    $('#oyun').dataset.primary = O.hazir ? 'rakip' : 'ben';
    $('#hazir').hidden = O.basladi || O.bitti || C.ilkBaslayan === 'rakip';
    $('#hazir').disabled = O.kilit || O.duraklat;
    const hazirYazi = O.hazir ? 'Düzenle' : 'Hazırım';
    if ($('#hazir').dataset.metin !== hazirYazi) {
      $('#hazir').dataset.metin = hazirYazi;
      if (O.cizim.ben) D.harfle($('#hazir .yazi'), hazirYazi, { anlik: true });
      else $('#hazir .yazi').textContent = hazirYazi;
    }
    $('#yeniden-diz').hidden = O.hazir || O.basladi || C.ilkBaslayan === 'rakip';
    $('#yeniden-diz').disabled = O.kilit || O.duraklat;
    $('#atis-paneli').hidden = !O.hazir || O.bitti || !onayModu();
    $('#ates-et').disabled = !etkin || !O.secili;
    $('#hedef-bilgi').textContent = O.secili ? G.hucreAdi(O.secili.s, O.secili.k) : 'Hücre seç';
    if (O.cizim.rakip) {
      const tab = O.cizim.rakip.hucre.find(h => h.getAttribute('tabindex') === '0') || O.cizim.rakip.hucre[0];
      for (const h of O.cizim.rakip.hucre) h.setAttribute('tabindex', O.hazir && h === tab ? '0' : '-1');
    }
    $$('.kompakt-durum').forEach(e => { e.textContent = O.secili ? `${G.hucreAdi(O.secili.s, O.secili.k)} seçili` : (O.hazir ? O.metin || 'Hazırlanıyor…' : 'Gemilerini yerleştir'); });
  }
  function kilitle(v) { O.kilit = v; etkinGuncelle(); }
  function durum(metin, renk = 'mavi', gecikme = 0, mesaj = metin) {
    O.metin = metin; O.sonDuyuru = mesaj;
    D.durumYaz($('#ust-rakip'), metin, renk, gecikme);
    if (!O.duraklat) duyur(mesaj);
    etkinGuncelle();
  }
  function secimiSil() {
    O.secili = null;
    if (O.cizim.rakip) D.hucreOdakSil(O.cizim.rakip, 'hedef-secim');
  }
  function hazirDegistir() {
    if (O.basladi || O.kilit || O.bitti || O.duraklat) return;
    secimiSil();
    O.hazir = !O.hazir;
    if (O.hazir) yerlestirmeKapat(); else yerlestirmeAc();
    if (O.hazir) durum('SIRA SENDE');
    else durum('HAZIRLIK', 'mavi', 0, YERLESTIRME_MESAJI);
  }
  function kendiHucreleriniGuncelle() { AB.placement.bilgiYaz(O); }

  // Sayaç: etiket bir kez yazılır; atışta yalnız o oyuncunun sayısı yeniden yazılır.
  function sayacYaz(kim) {
    D.harfle($(`#sayac-${kim} .sayi`), String(O.atis[kim]), { tohum: ['sayac', kim, O.atis[kim]], adim: 40 });
  }

  /* ---------- dizilim aşaması: gemileri sürükle, dokununca döndür ---------- */

  const HUCRE = D.HUCRE;
  const IPUCU = 'gemileri sürükle · dokun: döndür';
  const YERLESTIRME_MESAJI = 'Gemilerini yerleştir. Hazır olduğunda Hazırım düğmesine bas.';

  function yerlestirmeAc() {
    if (C.ilkBaslayan === 'rakip') return;                  // rakip hemen atıyorsa dizmeye vakit yok
    O.dizilebilir = true;
    kendiHucreleriniGuncelle();
    const T = O.cizim.ben;
    D.tutamaklariKur(T, O.tahta.ben.gemiler);
    D.altYaziYaz($('#ust-ben'), IPUCU, { vurgulu: true });
  }

  function yerlestirmeKapat() {
    if (!O.dizilebilir) return;
    suruklemeIptal();
    klavyeYerlestirme?.iptal();
    O.dizilebilir = false;
    D.tutamaklariKaldir(O.cizim.ben);
    D.altYaziYaz($('#ust-ben'), 'senin donanman');
  }

  // Parmağın/farenin tuttuğu gemi hücresi (döndürürken yerinde kalır)
  function tutulanHucre(gemi, p) {
    const i = gemi.yatay
      ? Math.floor(p.x / HUCRE) - (gemi.hucreler[0].k + 1)
      : Math.floor(p.y / HUCRE) - (gemi.hucreler[0].s + 1);
    return Math.max(0, Math.min(gemi.uzunluk - 1, i));
  }

  function suruklemeBasla(e) {
    if (!O.dizilebilir || O.duraklat || O.kilit || O.surukle || (e.button !== undefined && e.button > 0)) return;
    const th = e.target.closest ? e.target.closest('.tutamak') : null;
    if (!th) return;
    e.preventDefault();
    klavyeYerlestirme?.iptal();
    const T = O.cizim.ben;
    const gemi = O.tahta.ben.gemiler[+th.dataset.gemi];
    const bas = D.noktaTahtada(T, e);
    O.surukle = { gemi, bas, i: tutulanHucre(gemi, bas), id: e.pointerId, clientX: e.clientX, clientY: e.clientY, tasindi: false, hedef: null, th };
    try { th.setPointerCapture(e.pointerId); } catch (err) { /* yoksay */ }
    T.svg.addEventListener('pointermove', suruklemeHareket);
    T.svg.addEventListener('pointerup', suruklemeBitir);
    T.svg.addEventListener('pointercancel', suruklemeIptal);
    T.svg.addEventListener('lostpointercapture', suruklemeIptal);
    T.svg.classList.add('suruklenen');
  }

  function suruklemeHareket(e) {
    const d = O.surukle;
    if (!d || e.pointerId !== d.id) return;
    const T = O.cizim.ben, g = d.gemi;
    const p = D.noktaTahtada(T, e);
    const dx = p.x - d.bas.x, dy = p.y - d.bas.y;
    if (!d.tasindi && Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) < 6) return;       // küçük titremeler tıklama sayılır
    d.tasindi = true;
    D.gemiSurukle(T, g, dx, dy);
    const s = g.hucreler[0].s + Math.round(dy / HUCRE), k = g.hucreler[0].k + Math.round(dx / HUCRE);
    if (!d.hedef || d.hedef.s !== s || d.hedef.k !== k) {
      const gecerli = G.tasinabilir(O.tahta.ben, g.id, s, k, g.yatay);
      d.hedef = { s, k, gecerli };
      D.hedefGoster(T, g, s, k, g.yatay, gecerli);
    }
  }

  function suruklemeTemizle() {
    const d = O.surukle;
    if (!d) return;
    const T = O.cizim.ben;
    T.svg.removeEventListener('pointermove', suruklemeHareket);
    T.svg.removeEventListener('pointerup', suruklemeBitir);
    T.svg.removeEventListener('pointercancel', suruklemeIptal);
    T.svg.removeEventListener('lostpointercapture', suruklemeIptal);
    T.svg.classList.remove('suruklenen');
    try { d.th.releasePointerCapture(d.id); } catch (err) { /* yoksay */ }
    D.hedefSil(T);
    O.surukle = null;
  }

  function suruklemeIptal() {
    const d = O.surukle;
    if (!d) return;
    const T = O.cizim.ben, g = d.gemi;
    suruklemeTemizle();
    D.gemiGeriDon(T, g);
  }

  function suruklemeBitir(e) {
    const d = O.surukle;
    if (!d || e.pointerId !== d.id) return;
    const T = O.cizim.ben, t = O.tahta.ben, g = d.gemi;
    suruklemeTemizle();
    if (!d.tasindi) { gemiyiDondur(g, d.i); return; }                     // sürüklemeden bırakıldı: dokunma
    if (d.hedef && d.hedef.gecerli && G.gemiTasi(t, g.id, d.hedef.s, d.hedef.k, g.yatay)) {
      D.gemiYerlestir(T, g);
      Ses.cal('kalem');
      D.tutamaklariKur(T, t.gemiler);
      kendiHucreleriniGuncelle();
      duyur('Gemi yerleştirildi.');
    } else {
      D.gemiGeriDon(T, g);
      duyur('Gemi buraya yerleştirilemez. Eski konumuna döndü.');
    }
  }

  // Tutulan hücre yerinde kalacak şekilde döndürür; sığmazsa ilk hücre sabit denenir; olmazsa titrer.
  function gemiyiDondur(g, i) {
    if (g.uzunluk === 1 || !O.dizilebilir) return;
    const T = O.cizim.ben, t = O.tahta.ben;
    const yatay = !g.yatay, f = g.hucreler[0], p = g.hucreler[i];
    const adaylar = [yatay ? [p.s, p.k - i] : [p.s - i, p.k], [f.s, f.k]];
    for (const [s, k] of adaylar) {
      if (G.gemiTasi(t, g.id, s, k, yatay)) {
        D.gemiYerlestir(T, g);
        Ses.cal('kalem');
        D.tutamaklariKur(T, t.gemiler);
        kendiHucreleriniGuncelle();
        duyur('Gemi döndürüldü.');
        return;
      }
    }
    duyur('Gemi burada döndürülemez. Başka bir yere taşı.');
    D.gemiTitret(T, g);
    D.hedefGoster(T, g, adaylar[0][0], adaylar[0][1], yatay, false);        // neden olmadığını kırmızı tarama gösterir
    setTimeout(() => D.hedefSil(T), 550);
  }

  /* ---------- oyun kurma ---------- */

  function benimGemileriniCiz(gecikme) {
    const cizimler = O.tahta.ben.gemiler.map((g, i) =>
      D.gemiCiz(O.cizim.ben, g, 'normal', { gecikme: gecikme + i * 220 }));
    return { bitti: Promise.all(cizimler.map(c => c.bitti)) };
  }

  function oyunKur() {
    const j = ++O.jeton;
    bekleyenleriUyandir();
    O.no++;
    yerlestirmeKapat();
    D.karalamaDurdur($('#ust-rakip'));
    const r = G.rng(rastgeleTohum());
    O.tahta = { ben: G.yeniTahta(C, r), rakip: G.yeniTahta(C, r) };
    O.atis = { ben: 0, rakip: 0 };
    secimiSil();
    O.hazir = C.ilkBaslayan === 'rakip';
    O.bitti = false; O.basladi = false; O.sira = C.ilkBaslayan === 'rakip' ? 'rakip' : 'ben';
    kilitle(true);

    O.cizim = {
      ben: D.tahtaKur($('#tahta-ben'), 'ben' + O.no, { klavye: true }),
      rakip: D.tahtaKur($('#tahta-rakip'), 'rakip' + O.no, { klavye: true }),
    };
    kendiHucreleriniGuncelle();
    etkinGuncelle();
    const vurgu = $('#yeni-sayfa .vurgu');
    if (vurgu) vurgu.textContent = '';
    sayacYaz('ben');
    sayacYaz('rakip');
    $('#ust-rakip .durum')?.remove();

    // Önce ızgaralar ve etiketler çizilir, sonra benim gemilerim.
    const g1 = D.izgaraCiz(O.cizim.ben, 0);
    D.etiketYaz(O.cizim.ben, g1.sure * .55);
    const g2 = D.izgaraCiz(O.cizim.rakip, 380);
    D.etiketYaz(O.cizim.rakip, 380 + g2.sure * .55);
    const gemiler = benimGemileriniCiz(g1.sure * .8);

    Promise.all([g1.bitti, g2.bitti, gemiler.bitti]).then(() => {
      if (j !== O.jeton) return;
      if (O.sira === 'rakip') { aiSirasi(j); return; }
      durum('HAZIRLIK', 'mavi', 0, YERLESTIRME_MESAJI);
      kilitle(false);
      yerlestirmeAc();
    });
  }

  async function yenidenDiz() {
    if (O.hazir || O.basladi || O.kilit || O.duraklat || O.tahta.ben.atis.some(Boolean)) return;   // ilk atıştan sonra ya da çizim sürerken değil
    kilitle(true);
    yerlestirmeKapat();
    const j = O.jeton;
    O.tahta.ben = G.yeniTahta(C, G.rng(rastgeleTohum()));
    await D.gemileriSil(O.cizim.ben);
    if (j !== O.jeton) return;
    await benimGemileriniCiz(0).bitti;
    if (j !== O.jeton) return;
    kilitle(false);
    yerlestirmeAc();
  }

  // "Yeni sayfa": eski tahtalar yırtılıp atılır gibi gider, sonra yeni sayfa baştan çizilir.
  async function yeniSayfa() {
    if (O.gecis) return;
    O.gecis = true;
    const eski = ++O.jeton;
    bekleyenleriUyandir();                                 // süren atış/AI adımları durur
    kilitle(true);
    yerlestirmeKapat();
    D.karalamaDurdur($('#ust-rakip'));
    let anims = [];
    if (D.animasyonVar() && O.cizim.ben) {
      anims = $$('.tahta').map((t, i) => t.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translate(-6%, -5%) rotate(-4deg)', opacity: 0 }],
        { duration: 380, delay: i * 90, easing: 'ease-in', fill: 'forwards' }));
      await Promise.all(anims.map(a => a.finished.catch(() => {})));
    }
    O.gecis = false;
    if (eski !== O.jeton) return;
    oyunKur();
    anims.forEach(a => a.cancel());
  }

  /* ---------- atış akışı ---------- */

  // Rakibin atışı benim tahtamda; telefonda o tahta ekranın altında kalabildiği için hücre adı da yazılır.
  // (Türkçe ek uyumuyla uğraşmamak için iki nokta: "RAKİP C7: ISKA")
  const MESAJ = {
    ben:   { iska: 'ISKA', isabet: 'İSABET!', batti: 'BATTI!' },
    rakip: { iska: 'ISKA', isabet: 'İSABET!', batti: 'BATIRDI!' },
  };
  const DURUM_METNI = { iska: 'ıska', isabet: 'isabet', batti: 'isabet, gemi battı' };

  function atisMesaji(atan, sonuc, s, k) {
    const ad = G.hucreAdi(s, k);
    const yazi = atan === 'ben' ? MESAJ.ben[sonuc] : `RAKİP ${ad}: ${MESAJ.rakip[sonuc]}`;
    return { yazi, duyuru: atan === 'ben' ? `${ad}: ${yazi}` : yazi };
  }

  // İlk atış (kimden gelirse gelsin): dizilim biter, "Yeniden diz" kaybolur.
  function oyunBasladi() {
    if (O.basladi) return;
    O.basladi = true;
    yerlestirmeKapat();
    $('#yeniden-diz').hidden = true;
  }

  // Bir atışın sonucunu çizer; bitince biraz bekler ki oyuncu ne olduğunu görsün.
  async function sonucuCiz(hedef, atan, s, k, sonuc, j) {
    const T = O.cizim[hedef];
    const ink = atan === 'ben' ? 'mavi' : 'kirmizi';
    D.hucreAtildi(T, s, k, DURUM_METNI[sonuc.sonuc]);
    const m = atisMesaji(atan, sonuc.sonuc, s, k);
    durum(m.yazi, ink, 0, m.duyuru);
    Ses.cal('kalem');
    if (sonuc.sonuc === 'iska') {
      Ses.cal('plop', 150);
    } else {
      Ses.cal('kalem', 200);
      Ses.cal('pat', 400);                                  // X bitince "pat"
      if (sonuc.sonuc === 'batti') Ses.cal('bati', hedef === 'rakip' ? 800 : 500);
    }

    if (sonuc.sonuc === 'iska') {
      await D.iskaCiz(T, s, k, ink).bitti;
    } else {
      await D.isabetCiz(T, s, k, ink).bitti;
      if (!await devamBekle(j)) return;
      const gemi = sonuc.gemi;
      const batti = sonuc.sonuc === 'batti';
      if (hedef === 'ben') D.yuzCiz(T, gemi, batti ? 'batik' : 'saskin');       // benim gemim şaşırır / batar
      if (batti) {
        if (hedef === 'rakip') D.gemiCiz(T, gemi, 'batik', { renk: 'mavi' });     // rakip gemisi batınca ortaya çıkar
        const gec = hedef === 'rakip' ? 500 : 0;
        const dalga = D.batikCiz(T, gemi, ink, { gecikme: gec });
        D.batiYazisi(T, gemi, ink, { gecikme: gec + 200 });
        sonuc.otoIska.forEach((h, i) => {
          D.hucreAtildi(T, h.s, h.k, 'ıska (gemi çevresi)');
          D.iskaCiz(T, h.s, h.k, 'kursun', { otomatik: true, gecikme: 200 + i * 40 });
        });
        await dalga.bitti;
      }
    }
    if (hedef === 'ben' && j === O.jeton) kendiHucreleriniGuncelle();
    if (await devamBekle(j)) await bekle(350);
  }

  async function oyuncuAtar(s, k) {
    if (!O.hazir || O.duraklat || O.kilit || O.bitti || O.sira !== 'ben') return;
    const t = O.tahta.rakip;
    if (t.atis[s * t.n + k] !== 0) return;
    secimiSil();
    kilitle(true);                                          // ilk await'ten önce: çift dokunmayı engeller
    const j = O.jeton;
    oyunBasladi();                                          // ilk atıştan sonra gemiler sabit

    const sonuc = G.atesEt(t, s, k);
    O.atis.ben++;
    sayacYaz('ben');
    await sonucuCiz('rakip', 'ben', s, k, sonuc, j);
    if (!await devamBekle(j)) return;

    if (G.hepsiBatti(t)) { bitir('ben'); return; }
    const vurdu = sonuc.sonuc === 'isabet' || sonuc.sonuc === 'batti';
    if (vurdu && C.isabetteTekrar) {
      durum('SIRA SENDE');
      kilitle(false);
    } else {
      aiSirasi(j);
    }
  }

  async function aiSirasi(j) {
    O.sira = 'rakip';
    kilitle(true);
    for (;;) {
      if (!await devamBekle(j)) return;
      durum('RAKİP DÜŞÜNÜYOR…', 'kursun');
      D.karalamaBaslat($('#ust-rakip'), () => Ses.cal('kalem'));                   // rakip sayfasında kalem karalaması
      const [a, b] = C.ai.dusunmeMs;
      await bekle(a + Math.random() * (b - a));
      if (j !== O.jeton) return;
      D.karalamaDurdur($('#ust-rakip'));
      if (!await devamBekle(j)) return;

      const t = O.tahta.ben;
      oyunBasladi();                                        // rakip önce başlarsa da dizilim burada biter
      const { s, k } = AB.ai.sec(G.gorunum(t), { parite: C.ai.parite });
      const sonuc = G.atesEt(t, s, k);
      O.atis.rakip++;
      sayacYaz('rakip');
      D.sonAtisIsaretle(O.cizim.ben, s, k);                 // nereye attığı görülsün
      await sonucuCiz('ben', 'rakip', s, k, sonuc, j);
      if (!await devamBekle(j)) return;

      if (G.hepsiBatti(t)) { bitir('rakip'); return; }
      const vurdu = sonuc.sonuc === 'isabet' || sonuc.sonuc === 'batti';
      if (!(vurdu && C.isabetteTekrar)) break;
    }
    O.sira = 'ben';
    durum('SIRA SENDE');
    kilitle(false);
  }

  function bitir(kazanan) {
    O.bitti = true;
    kilitle(true);
    const T = O.cizim.rakip;
    if (kazanan === 'rakip') {                              // batmayan rakip gemileri kurşun kalemle gösterilir
      O.tahta.rakip.gemiler.filter(g => !g.batti)
        .forEach((g, i) => D.gemiCiz(T, g, 'normal', { renk: 'kursun', gecikme: i * 150 }));
    }
    durum('OYUN BİTTİ', 'kursun', 0, `${kazanan === 'ben' ? 'Kazandın!' : 'Kaybettin.'} Sen ${O.atis.ben} atış, rakip ${O.atis.rakip} atış yaptı.`);
    const kazandim = kazanan === 'ben';
    Ses.cal(kazandim ? 'kazan' : 'kaybet', 700);
    D.sonucCiz(T, kazandim ? 'KAZANDIN!' : 'KAYBETTİN…',
      `${O.atis.ben} atış · rakip ${O.atis.rakip} atış`, kazandim ? 'mavi' : 'kirmizi', 500);
    D.dugmeVurgu($('#yeni-sayfa'));
  }

  /* ---------- ses düğmesi ---------- */

  function sesSimgesiGuncelle(anlik) {
    const b = $('#ses-dugme');
    b.setAttribute('aria-pressed', String(Ses.sessiz));
    b.setAttribute('aria-label', Ses.sessiz ? 'Sesi aç' : 'Sesi kapat');
    D.sesSimgesiCiz($('.ikon', b), !Ses.sessiz, anlik);
  }

  function seslendir() {
    // Tarayıcılar ses için kullanıcı hareketi ister: ilk dokunuşta AudioContext açılır.
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    sesSimgesiGuncelle(false);
    $('#ses-dugme').addEventListener('click', () => {
      Ses.sessizYap(!Ses.sessiz);
      sesSimgesiGuncelle(false);
      Ses.cal('kalem');                                       // açılırken küçük bir hışırtı duyulur
    });
  }

  /* ---------- klavyeyle oynama (rakip tahtası ARIA ızgarası) ---------- */

  // Gezinen tabindex: Tab ile tahtaya tek durakta girilir, hücreler arasında ok tuşlarıyla dolaşılır.
  function gezinenOdak(h, kim = 'rakip') {
    for (const r of O.cizim[kim].hucre) r.setAttribute('tabindex', r === h ? '0' : '-1');
  }

  function tahtaKlavye(e, kim = 'rakip') {
    const h = e.target.closest ? e.target.closest('.hucre') : null;
    if (!h) return;
    const n = O.cizim[kim].n;
    let s = +h.dataset.s, k = +h.dataset.k;
    switch (e.key) {
      case 'ArrowUp':    s = Math.max(0, s - 1); break;
      case 'ArrowDown':  s = Math.min(n - 1, s + 1); break;
      case 'ArrowLeft':  k = Math.max(0, k - 1); break;
      case 'ArrowRight': k = Math.min(n - 1, k + 1); break;
      case 'Home':       k = 0; break;
      case 'End':        k = n - 1; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (kim === 'rakip') oyuncuAtar(s, k);
        else {
          const id = O.tahta.ben.gemiHaritasi[s * n + k];
          if (id >= 0) klavyeYerlestirme.baslat(id);
          else duyur(G.hucreAdi(s, k) + ': boş hücre');
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    const yeni = O.cizim[kim].hucre[s * n + k];
    gezinenOdak(yeni, kim);
    yeni.focus({ preventScroll: true });
  }

  /* ---------- düğme çerçeveleri boyutu izler ---------- */

  // Gizle/göster, pencere boyutu ya da geç gelen font düğmenin boyutunu değiştirince çerçeve yeniden çizilir.
  let dugmeGozlemci = null;
  function dugmeBoyutlariniIzle() {
    if (typeof ResizeObserver === 'undefined') return;
    const boyut = new WeakMap();
    dugmeGozlemci = new ResizeObserver((girdiler) => {
      for (const g of girdiler) {
        const b = g.target, w = b.offsetWidth, h = b.offsetHeight;
        if (!w || !h) continue;                             // gizli: göründüğünde ölçülür
        const eski = boyut.get(b);
        boyut.set(b, w + 'x' + h);
        if (eski !== w + 'x' + h) D.dugmeCerceve(b, 0, true);
      }
    });
    $$('.dugme').forEach(b => dugmeGozlemci.observe(b));
  }

  /* ---------- sahne (bir kez kurulur) ---------- */

  function sahneKur() {
    D.ustSol($('#ust-ben'), 100);
    D.ustSag($('#ust-rakip'), 480, '');

    $$('.dugme').forEach((b, i) => {
      const yazi = $('.yazi', b);
      if (yazi) D.harfle(yazi, null, { tohum: ['dugme', b.id], gecikme: 900 + i * 250 });
      D.dugmeCerceve(b, 900 + i * 250);
      b.addEventListener('pointerenter', () => D.dugmeVurgu(b));
      b.addEventListener('focus', () => { if (D.klavyeOdagi(b)) D.dugmeOdak(b, true); });
      b.addEventListener('blur', () => D.dugmeOdak(b, false));
    });
    dugmeBoyutlariniIzle();
    $$('.sayac .etiket').forEach((e, i) => D.harfle(e, null, { tohum: ['sayac-etiket', i], gecikme: 1100 + i * 200 }));
    $$('.zimba').forEach((z, i) => D.zimbaCiz(z, i, 300 + i * 200));
    $$('.susler').forEach((kap, sayfa) => {
      $$('[data-sus]', kap).forEach((s, i) => D.susCiz(s, s.dataset.sus, [sayfa, i], 1200 + sayfa * 150 + i * 250));
    });

    const rakipTahta = $('#tahta-rakip');
    rakipTahta.addEventListener('pointerdown', e => {
      O.dokunmatik = e.pointerType === 'touch' || e.pointerType === 'pen';
      etkinGuncelle();
    });
    rakipTahta.addEventListener('click', (e) => {
      const h = e.target.closest ? e.target.closest('.hucre') : null;
      if (!h || !O.hazir || O.duraklat || O.kilit || O.bitti || O.sira !== 'ben') return;
      const s = +h.dataset.s, k = +h.dataset.k;
      if (O.tahta.rakip.atis[s * O.tahta.rakip.n + k]) return;
      // Safari dokunmadan sonra click'i fare olayı olarak iletebilir. Asıl işaretçiyi
      // pointerdown'dan koru; gerçek bir fare pointerdown'ı bu bayrağı zaten sıfırlar.
      const dokunma = O.dokunmatik || e.pointerType === 'touch' || e.pointerType === 'pen' || (!e.pointerType && onayModu());
      if (O.kompakt && dokunma) {
        O.secili = { s, k };
        D.hucreOdak(O.cizim.rakip, s, k, 'hedef-secim');
        duyur(`${G.hucreAdi(s, k)} seçildi. Ateş et düğmesiyle onayla.`);
        etkinGuncelle();
      } else oyuncuAtar(s, k);
    });
    rakipTahta.addEventListener('keydown', tahtaKlavye);
    rakipTahta.addEventListener('focusin', (e) => {
      const h = e.target.closest ? e.target.closest('.hucre') : null;
      if (!h) return;
      gezinenOdak(h);
      if (D.klavyeOdagi(h)) D.hucreOdak(O.cizim.rakip, +h.dataset.s, +h.dataset.k);
    });
    rakipTahta.addEventListener('focusout', () => D.hucreOdakSil(O.cizim.rakip));
    const benTahta = $('#tahta-ben');
    klavyeYerlestirme = AB.placement.kur(O, duyur, kendiHucreleriniGuncelle);
    benTahta.addEventListener('keydown', e => tahtaKlavye(e, 'ben'));
    benTahta.addEventListener('focusin', e => {
      const h = e.target.closest?.('.hucre');
      if (h) { gezinenOdak(h, 'ben'); D.hucreOdak(O.cizim.ben, +h.dataset.s, +h.dataset.k); }
    });
    benTahta.addEventListener('focusout', () => D.hucreOdakSil(O.cizim.ben));
    benTahta.addEventListener('pointerdown', suruklemeBasla);
    window.addEventListener('blur', () => { suruklemeIptal(); klavyeYerlestirme.iptal(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { suruklemeIptal(); klavyeYerlestirme.iptal(); } });
    $('#hazir').addEventListener('click', hazirDegistir);
    $('#ates-et').addEventListener('click', () => { if (O.secili) oyuncuAtar(O.secili.s, O.secili.k); });
    benTahta.addEventListener('contextmenu', (e) => {         // sağ tık: döndür
      const th = e.target.closest ? e.target.closest('.tutamak') : null;
      if (!th || !O.dizilebilir) return;
      e.preventDefault();
      if (O.surukle) return;                                  // uzun basış: dönüşü parmak kalkınca dokunma yapar
      const g = O.tahta.ben.gemiler[+th.dataset.gemi];
      gemiyiDondur(g, tutulanHucre(g, D.noktaTahtada(O.cizim.ben, e)));
    });
    $('#yeniden-diz').addEventListener('click', () => { Ses.cal('kalem'); yenidenDiz(); });
    seslendir();
    $('#yeni-sayfa').addEventListener('click', () => { Ses.cal('kalem'); yeniSayfa(); });
  }

  async function basla() {
    if (typeof rough === 'undefined') { roughYok(); return; }
    AB.viewport.kur(gorunumDegisti);
    const fontHazir = await fontBekle();
    sahneKur();
    if (!fontHazir) {                                       // font sonradan gelirse başlığı yeniden ölç
      document.fonts.load(FONT).then((yuklenen) => {
        if (!yuklenen || !yuklenen.length) return;
        D.ustSol($('#ust-ben'), 0, true);
        if (O.dizilebilir) D.altYaziYaz($('#ust-ben'), IPUCU, { anlik: true, vurgulu: true });
      }, () => {});
    }
    await D.varlikYukle();                                  // assets/ içindeki isteğe bağlı PNG'ler
    oyunKur();
    // Konsoldan denemek için: AB.durum
    AB.durum = O;
  }

  basla();
})();
