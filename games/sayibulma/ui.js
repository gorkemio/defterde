// ui.js — kontrolör: ölçü, font, sahne ve oyun akışı. Kurallar rules.js'te, çözücü solver.js'te, çizim draw.js ve kit/
// altında; burada yalnız onları birbirine bağlarız.
//
// Sayfadaki her sütun bir "taraf"tır: { kendi (sütunun sahibinin sayısı, üstte karalı), hedef (bu sütunun bulmaya çalıştığı
// sayı; bilinmiyorsa null → cevaplar sayaçla verilir), satirlar, S (aday kümesi), kalan, buldu }.
//   senbul / gunun — tek sütun: bilgisayar tutar, sen tahmin edersin (zorluk yalnız yardımları belirler)
//   obulsun        — tek sütun: sen aklında tutarsın, bilgisayar tahmin eder, sen sayaçlarla cevaplarsın; çelişki ve düzeltme
//   izle           — obulsun'un sayısını yazdığın hâli (ya da "Nasıl oynanır?" gösterisi): cevaplar kendiliğinden
//   yaris          — iki sütun: sen ve bilgisayar; her tur önce sen, sonra o; tur tamamlanır, ikiniz de bulursanız berabere
//   ikikisi        — iki sütun: iki oyuncu aynı cihazda; "telefonu ver" notlarıyla iki gizli sayı. "Cevapları biz veririz"de
//                    sayı yazılmaz, cevaplar sayaçla girilir, cihaz yalnız çelişki kontrolü yapar.
// Aşamalar: giris · basla (o bulsun: "tuttum") · gizli (sayı yazılıyor) · devir (telefonu ver) · dusunuyor · cevap · celiski · bitti
(function () {
  'use strict';

  const SB = window.SB, Kit = window.Kit;
  const C = SB.config, D = SB.draw, KL = Kit.kalem, RL = SB.rules, V = SB.solver;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));

  const HANE_ADI = { 3: 'üç', 4: 'dört', 5: 'beş' };
  const MOD_ADI = { senbul: 'sen bul', gunun: 'günün sayısı', obulsun: 'o bulsun', izle: 'izle', yaris: 'yarış', ikikisi: 'iki kişi' };
  const MODLAR = ['senbul', 'obulsun', 'yaris', 'ikikisi', 'gunun'];
  // Kırmızı-mavi kalemin sesleri (kit/kirmizimavi.js): rakam yazma, kalemi çevirme, sayfa yırtma, tik. Yoksa sessiz çalışır.
  const Ses = Kit.ses ? Kit.ses.kur({ anahtar: 'sb-sessiz' }) : { cal() {}, baslat() {}, sessiz: true, sessizYap() {}, durdur() {} };
  const sesYazi = (adet, gecikme = 0, aralik = 150) => { for (let k = 0; k < adet; k++) Ses.cal('rakam', gecikme + k * aralik, 90); };
  const cevapGlif = (arti, eksi, hane) => (arti === hane ? 2 : 4);
  const OLCEK = (n) => (n <= 5 ? 'mükemmel' : n <= 7 ? 'iyi' : 'olur');
  const DURUMLAR = [null, 'var', 'yok', 'soru'];
  const DURUM_ADI = { null: 'işaretsiz', var: 'var', yok: 'yok', soru: 'belki' };

  // jeton: oyunun kimliği; "Yeni sayfa"da artar, eski oyunun bekleyen adımları jeton değişmişse sessizce çıkar.
  // kilit: satır yazılırken ve hesap sürerken girişi kapatır; ilk await'ten ÖNCE eşzamanlı kurulur (çift dokunma).
  const O = {
    jeton: 0, oyunId: 0,
    ayar: { mod: MODLAR.includes(C.mod) ? C.mod : 'senbul', zorluk: C.zorluk, cizelge: null, biz: !!(C.ikiKisi && C.ikiKisi.cevaplariBizVeririz),
      sayi: RL.ayar({ hane: C.hane, tekrar: C.tekrar, sifirBaslar: C.sifirBaslar }), sayiElle: false },
    oyun: null, sutun: 0, asama: 'giris',
    giris: '', girisSayac: 0, ipucu: null,
    sayac: { arti: 0, eksi: 0, adim: 0 }, duzelt: null, celiski: null, kontrol: null, devirSonra: null,
    elle: Array(10).fill(null), isaretSayac: 0,
    cizelgeAcik: true, kalanAcik: true,
    kilit: false, kuyruk: [], not: null, notSatir: 0,
    L: null, Sc: null, olcuAnahtar: '', H: 0,
  };

  /* ---------- saklama (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  const bellek = {};
  function oku(a) { try { const s = localStorage.getItem(a); return s ? JSON.parse(s) : (bellek[a] ?? null); } catch (e) { return bellek[a] ?? null; } }
  function yaz(a, v) { bellek[a] = v; try { localStorage.setItem(a, JSON.stringify(v)); } catch (e) { /* yoksay */ } }
  // Sayı ayarı (hane, sıfır, tekrar) yalnız Ayarlar'dan bilerek değiştirildiyse saklanır; yoksa config.js'in varsayılanı geçer
  // (varsayılan değişince eski kayıtlar onu ezmesin).
  const depoYaz = () => yaz('sb-ayar', { mod: O.ayar.mod, zorluk: O.ayar.zorluk, cizelge: O.ayar.cizelge, cizelgeAcik: O.cizelgeAcik, biz: O.ayar.biz,
    sayi: O.ayar.sayiElle ? O.ayar.sayi : undefined, sayiElle: O.ayar.sayiElle || undefined });
  function ayarlariYukle() {
    const k = oku('sb-ayar');
    if (!k || typeof k !== 'object') return;
    if (MODLAR.includes(k.mod)) O.ayar.mod = k.mod;
    if (['kolay', 'orta', 'zor'].includes(k.zorluk)) O.ayar.zorluk = k.zorluk;
    if (['elle', 'otomatik'].includes(k.cizelge)) O.ayar.cizelge = k.cizelge;
    if (typeof k.cizelgeAcik === 'boolean') O.cizelgeAcik = k.cizelgeAcik;
    if (typeof k.biz === 'boolean') O.ayar.biz = k.biz;
    if (k.sayiElle === true && k.sayi && typeof k.sayi === 'object') { O.ayar.sayi = RL.ayar(k.sayi); O.ayar.sayiElle = true; }
  }

  /* ---------- mod ve zorluk ---------- */

  const mod = () => O.oyun.mod;
  const senBul = () => mod() === 'senbul' || mod() === 'gunun';
  const izle = () => mod() === 'izle';
  const ikiSutun = () => mod() === 'yaris' || mod() === 'ikikisi';
  const T = (c = O.sutun) => O.oyun.taraf[c];
  const R_ = (c = O.sutun) => T(c).satirlar.length;
  const enCokSatir = () => Math.max(...O.oyun.taraf.map(t => t.satirlar.length));
  // Bu sütunda kim tahmin ediyor
  const tahminci = (c) => (mod() === 'obulsun' || mod() === 'izle' || (mod() === 'yaris' && c === 1) ? 'bilgisayar' : 'insan');
  const adlar = () => (mod() === 'yaris' ? ['sen', 'o'] : ['1.\u00a0oyuncu', '2.\u00a0oyuncu']);   // bölünmez boşluk: "2." satır sonunda kalmasın

  // senbul/gunun: kolay çizelge otomatik + kalan açık · orta çizelge elle · zor yardım yok.
  // obulsun/izle: çizelge ve kalan bilgisayarın bildiklerini gösterir. yaris: yalnız çizelge (varsayılan elle). ikikisi: yardım yok.
  function yardim() {
    const z = O.ayar.zorluk, m = mod();
    if (m === 'ikikisi') return { ipucu: false, kalan: false, otoIzin: false, oto: false, cizelge: false };
    if (m === 'yaris') return { ipucu: false, kalan: false, otoIzin: true, oto: O.ayar.cizelge === 'otomatik', cizelge: true };
    if (!senBul()) return { ipucu: false, kalan: true, otoIzin: true, oto: O.ayar.cizelge !== 'elle', cizelge: true };
    return {
      ipucu: z !== 'zor', kalan: z !== 'zor', otoIzin: z !== 'zor', cizelge: true,
      oto: z !== 'zor' && (O.ayar.cizelge ? O.ayar.cizelge === 'otomatik' : z === 'kolay'),
    };
  }
  const kalanVarsayilan = () => !senBul() || O.ayar.zorluk === 'kolay';
  function modYazisi() {
    const g = O.oyun;
    if (g.gosteri) return 'izle · nasıl oynanır';
    if (mod() === 'gunun') return `günün sayısı · ${RL.tarihYazi(g.tarih)} · ${O.ayar.zorluk}`;
    // Yalnız varsayılandan (config.js) farklı sayı ayarları başlığa yazılır
    const a = g.ayar, ek = (a.hane !== C.hane ? ` · ${a.hane} hane` : '') + (a.tekrar !== !!C.tekrar ? (a.tekrar ? ' · tekrarlı' : ' · farklı rakam') : '')
      + (a.sifirBaslar !== !!C.sifirBaslar ? (a.sifirBaslar ? ' · 0 olabilir' : ' · 0 olmaz') : '');
    if (mod() === 'ikikisi') return (g.biz ? 'iki kişi · cevapları siz verin' : 'iki kişi') + ek;
    return `${MOD_ADI[mod()]} · ${O.ayar.zorluk}${ek}`;
  }

  /* ---------- oyun durumu ---------- */

  function tarafYap(ayar, hedef, kendi) {
    return { hedef: hedef || null, kendi: kendi || null, satirlar: [], S: V.kur(ayar), kalan: [RL.kume(ayar).boyut], buldu: false };
  }

  // o: { mod, gosteri }
  function oyunKur(o = {}) {
    O.oyunId++;
    const m = o.mod || O.ayar.mod;
    const ayar = RL.ayar(m === 'gunun' ? RL.VARSAYILAN : O.ayar.sayi);
    const g = O.oyun = { ayar, mod: m, gosteri: !!o.gosteri, biz: m === 'ikikisi' && O.ayar.biz, taraf: [], bitti: false, ipucuSayisi: 0, tarih: RL.yerelTarih() };
    O.sutun = 0;
    if (m === 'senbul') g.taraf = [tarafYap(ayar, RL.rastgeleSayi(ayar))];
    else if (m === 'gunun') g.taraf = [tarafYap(ayar, RL.gununSayisi(g.tarih))];
    else if (m === 'obulsun') g.taraf = [tarafYap(ayar)];
    else if (m === 'izle') { const x = o.gosteri ? RL.rastgeleSayi(ayar) : null; g.taraf = [tarafYap(ayar, x, x)]; }
    else if (m === 'yaris') { const x = RL.rastgeleSayi(ayar); g.taraf = [tarafYap(ayar, x), tarafYap(ayar, null, x)]; }
    else g.taraf = [tarafYap(ayar), tarafYap(ayar)];
    O.asama = senBul() ? 'giris' : m === 'obulsun' ? 'basla' : m === 'izle' ? 'dusunuyor' : m === 'yaris' ? 'gizli' : g.biz ? 'giris' : 'devir';
    O.giris = ''; O.ipucu = null; O.kuyruk = [];
    O.sayac = { arti: 0, eksi: 0, adim: 0 }; O.duzelt = null; O.celiski = null; O.devirSonra = null;
    O.elle = Array(10).fill(null);
    O.kalanAcik = kalanVarsayilan();
    if (m === 'gunun') gunuYukle();
  }

  // Yol gösteren iki satırlık kurşun not: oyunun ilk adımlarında ne yapılacağını söyler, sonra kaybolur.
  function rehber() {
    const g = O.oyun, a = O.asama, h = g.ayar.hane;
    if (g.bitti) return null;                             // açık not (ayarlar, nasıl oynanır) yol notunun altına yazılır
    if (a === 'gizli') return ['saklayacağın sayıyı yaz', '«tamam»a bas: üstü karalanır'];
    if (a === 'giris' && !O.ipucu) {
      if (senBul() && !R_(0)) return [`aklımdaki ${h} haneli sayıyı bul`, g.ayar.tekrar ? '(rakamlar tekrar edebilir: 5755 gibi)' : '(rakamları hep farklı)', 'aşağıdaki rakamlara bas, sonra «tahmin»'];
      if (ikiSutun() && !enCokSatir()) return mod() === 'yaris' ? ['sıra sende: onun sayısını tahmin et', 'rakamlara bas, sonra «tahmin»']
        : g.biz ? ['rakamlara bas, sonra «tahmin»', 'öbür oyuncu + ve − ile cevaplar'] : ['sırayla tahmin edin', 'rakamlara bas, sonra «tahmin»'];
    }
    if (a === 'cevap' && O.duzelt == null && !T().satirlar.some(s => s.arti != null)) return ['+ kutusu: doğru yerdeki rakamlar (dokun, artar)', '− kutusu: var ama yeri yanlış olanlar'];
    return null;
  }
  // Notun ilk satırı: etkin satırın altındaki ilk boş satır (iki sütunda en uzun sütunun altı)
  // (ilk tahmin satırına göre)
  function rehberGoreli() {
    const a = O.asama, taban = a === 'gizli' ? -1 : a === 'cevap' ? R_() - 1 : R_();
    return Math.max(taban + 1, enCokSatir());
  }
  const rehberK = () => O.L.ilk + rehberGoreli();
  let sonRehber = '';
  function rehberCiz() {
    if (!O.Sc) return;
    const r = rehber(), anahtar = r ? r.join('|') + '@' + rehberK() : '';
    if (anahtar === sonRehber && O.Sc.k.notlar.querySelector('[data-not="rehber1"]')) return;
    sonRehber = anahtar;
    const k = r ? rehberK() : 0;
    for (let n = 0; n < 3; n++) D.notSatir(O.Sc, 'rehber' + (n + 1), k + n, r && r[n] ? r[n] : '', { renk: 'kursun', boyut: .42, anlik: true });
  }

  // İlk tahmin satırından sonra kullanılan satırlar
  function icerikSatir() {
    const g = O.oyun, a = O.asama, en = enCokSatir();
    let n;
    if (g.bitti) n = en + 3;
    else if (a === 'basla') n = Math.max(en, R_()) + (O.baslaSatir || 2);   // başlangıç notu ölçülen satır kadar
    else if (a === 'celiski') n = Math.max(en, R_()) + 2;
    else if (a === 'giris' || a === 'dusunuyor') n = Math.max(en, R_() + 1);
    else n = Math.max(en, 1);
    const r = rehber();
    if (r) n = Math.max(n, rehberGoreli() + r.length);
    return n + (ipucuNotuVar() ? 1 : 0);
  }
  const ipucuNotuVar = () => senBul() && !O.oyun.bitti && R_(0) >= C.ipucuNotuEsigi && yardim().ipucu && !O.ipucu;
  const kullanilan = () => icerikSatir() + (O.not ? 1 + O.notSatir : 0);
  const ilkEk = () => (izle() ? 1 : ikiSutun() ? 2 : 0);   // tahminlerin üstünde: gizli sayı (ve iki sütunda adlar)
  const girisK = () => (O.asama === 'gizli' ? O.L.ilk - 1 : O.L.ilk + R_());
  const notK = () => O.L.ilk + icerikSatir() + 1;
  // Sayaçların bağlı olduğu satır: düzeltilen satır; yoksa cevap bekleyen son tahmin. Çelişkide satır seçilene dek yok.
  const sayacSatiri = () => (O.duzelt != null ? O.duzelt : O.asama === 'cevap' ? R_() - 1 : null);

  /* ---------- ölçü ve yerleşim ---------- */

  // Tuş takımı her ekranda: telefonda altta 3×4, geniş ekranda sayfanın altında tek sıra (klavye de çalışır)
  const tuslarAcik = () => true;

  function olc() {
    const { vw, vh } = KL.alan();
    const L = D.yerlesim(vw, vh, { satir: kullanilan(), ilkEk: ilkEk(), sutun: ikiSutun() ? 2 : 1, hane: O.oyun.ayar.hane, satirPx: C.satir });
    const st = document.documentElement.style;
    st.setProperty('--W', L.W + 'px');
    st.setProperty('--H', L.H + 'px');
    document.body.dataset.duzen = L.dar ? 'dar' : 'genis';
    document.body.dataset.tuslar = tuslarAcik() ? 'acik' : 'kapali';
    const anahtar = JSON.stringify([L.W, L.s, L.dar, L.ilk, L.sutun]);
    const tam = anahtar !== O.olcuAnahtar, boy = L.H !== O.H;
    O.olcuAnahtar = anahtar; O.H = L.H; O.L = L;
    Kit.cizgili.kur($('#sayfa'), { satir: L.s, ust: L.ust, alt: L.alt, marjX: L.marjX, tohum: ['sayfa', O.oyunId] });
    return { tam, boy };
  }

  function konumla() {
    const L = O.L, ss = $('#sayfa').style, t = (k) => D.taban(L, k), px = (v) => v + 'px', Z = D.sut(L, O.sutun);
    ss.setProperty('--kx', px(L.x0 - .25 * L.s));
    ss.setProperty('--ky', px(t(L.komutK) - L.s));
    ss.setProperty('--kw', px(L.W - L.x0 - .3 * L.s));
    ss.setProperty('--tx', px(Z.xC - .2 * L.s));
    ss.setProperty('--ty', px(t(girisK()) - L.s));
    const son = D.kutuYeri(L, L.hane - 1, O.sutun);
    ss.setProperty('--gx', px(Z.x0 - .1 * L.s));
    ss.setProperty('--gy', px(t(girisK()) - L.s));
    ss.setProperty('--gw', px(son.x + son.gw - Z.x0 + .2 * L.s));
    ss.setProperty('--px', px(L.x0 - .25 * L.s));
    ss.setProperty('--py', px(t(girisK() + 1) - L.s));
    ss.setProperty('--nx', px(L.x0 - .2 * L.s));
    ss.setProperty('--ny', px(t(notK() - 1)));
    ss.setProperty('--nw', px(L.W - L.x0 - .3 * L.s));
    ss.setProperty('--bx', px(L.x0 - .2 * L.s));
    ss.setProperty('--by', px(t(L.ilk + R_() - 1)));
    $$('#cizelge button').forEach((b, d) => {
      Object.assign(b.style, { left: px(D.hucreX(L, d)), top: px(t(L.cizelge.k) - L.s), width: px(L.cizelge.hucre), height: px(L.s) });
    });
    if (sayacSatiri() != null) {
      const Y = D.sayacYeri(L, sayacSatiri(), O.sutun), pad = .12 * L.s;
      for (const [id, k] of [['#sayac-arti', Y.arti], ['#sayac-eksi', Y.eksi]]) {
        Object.assign($(id).style, { left: px(k.x - pad), top: px(Y.y - L.s + .1 * L.s), width: px(k.w + 2 * pad), height: px(L.s) });
      }
      ss.setProperty('--cx', px(Y.son + (ikiSutun() ? .3 : .5) * L.s));
      ss.setProperty('--cy', px(Y.y - L.s));
    }
    // Düzeltme düğmeleri: sayaçla cevaplanan sütunda, cevaplanmış her satırın cevabının üstünde
    const kap = $('#cevaplar');
    kap.textContent = '';
    const duzeltilir = !T().hedef && !O.oyun.bitti && tahminci(O.sutun) !== 'yok' && (O.asama === 'cevap' || O.asama === 'celiski');
    if (duzeltilir) {
      T().satirlar.forEach((s, i) => {
        if (s.arti == null || i === O.duzelt) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `${i + 1}. satırın cevabını düzelt (şu an artı ${s.arti}, eksi ${s.eksi})`);
        Object.assign(b.style, { left: px(Z.xC - .15 * L.s), top: px(t(L.ilk + i) - L.s), width: px(Kit.rakam.genislik('+0 -0', Z.hC) + .3 * L.s), height: px(L.s) });
        b.addEventListener('click', () => duzeltBasla(i));
        kap.appendChild(b);
      });
    }
  }

  function boyutla() {
    if (KL.alan().vw < 100) return;                       // görünmez/küçültülmüş pencere: ölçü anlamsız, bekle
    const d = olc();
    if (O.Sc) {
      if (d.tam) { sahneCiz(true); sozcukleriCiz(true); }
      else if (d.boy) {
        O.Sc.L = O.L;
        O.Sc.svg.setAttribute('viewBox', `0 0 ${O.L.W} ${O.L.H}`);
        kalanCiz(true);
      }
    }
    konumla();
  }

  /* ---------- sahne ---------- */

  const tarihYazi = () => new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const baslikCiz = (anlik, gecikme = 0) => D.baslikYaz(O.Sc, { baslik: 'Sayı Bulma', tarih: tarihYazi(), alt: modYazisi(), gecikme, anlik });
  const adlariCiz = (anlik) => { if (ikiSutun()) D.sutunAdlari(O.Sc, O.L.ilk - 2, adlar(), O.oyun.bitti ? -1 : O.sutun, { anlik, sayac: O.oyunId * 100 + R_() }); };

  // Gizli sayı satırı: izle'de tek, iki sütunda her sütunun sahibinin sayısı (karalı; bilgisayarınki "????")
  function gizliSatirlari(anlik, gecikme = 0) {
    const g = O.oyun, k = O.L.ilk - 1;
    if (izle()) {
      const x = T(0).kendi;
      D.gizliYaz(O.Sc, k, x || '', { etiket: g.gosteri ? 'tutulan:' : 'sayım:', karala: !!x && !g.gosteri, anlik: anlik || !x, gecikme, oyun: O.oyunId });
    } else if (ikiSutun()) {
      g.taraf.forEach((t, c) => {
        if (mod() === 'yaris' && c === 1) D.gizliYaz(O.Sc, k, '', { sutun: 1, etiket: null, soru: true, anlik, gecikme, oyun: O.oyunId });
        else if (t.kendi) D.gizliYaz(O.Sc, k, t.kendi, { sutun: c, etiket: null, karala: true, anlik: true, oyun: O.oyunId });
      });
    }
  }

  // Bütün sayfayı durumdan yeniden çizer. anlik=false: yeni sayfa, kalemle yazılır.
  function sahneCiz(anlik) {
    const g = O.oyun;
    O.Sc = D.sahneKur($('#yazi'), O.L);
    const S = O.Sc;
    let gec = anlik ? 0 : 150;
    const b = baslikCiz(anlik, gec);
    gec += anlik ? 0 : b.sure * .5;
    const cz = D.cizelgeCiz(S, { gecikme: gec, anlik });
    O.elle.forEach((d, i) => { if (d) D.cizelgeIsaret(S, i, d, { anlik: true, sayac: O.isaretSayac }); });
    otoGuncelle(true);
    gec += anlik ? 0 : cz.sure * .6;
    adlariCiz(anlik);
    gizliSatirlari(anlik, gec);
    g.taraf.forEach((t, c) => t.satirlar.forEach((s, i) => {
      D.satirYaz(S, i, s, { anlik: true, oyun: O.oyunId, sutun: c, cevapsiz: s.arti == null });
      if (O.duzelt === i && c === O.sutun) D.cevapDurum(S, i, 'soluk', c);
    }));
    if (g.bitti) sonucCiz(true);
    else if (O.asama === 'giris' || O.asama === 'gizli') {
      D.girisCiz(S, { i: girisK() - O.L.ilk, yazilan: O.giris, anlik, gecikme: gec, oyun: O.oyunId, sutun: O.sutun });
      if (O.ipucu) D.ipucuGoster(S, R_(), O.ipucu, { anlik: true });
    } else if (O.asama === 'dusunuyor') dusunuyorYaz(true);
    else if (O.asama === 'cevap' || O.asama === 'celiski') sayacGuncelle();
    if (O.asama === 'celiski') celiskiYaz(true);
    kalanCiz(anlik, false, gec + 300);
    gorunurlukGuncelle();
    return gec;
  }

  const kirmiziAlti = () => ({ stroke: KL.renkDeger('kirmizi'), strokeWidth: 1.6 });
  function sozcukleriCiz(anlik, gecikme = 0) {
    let i = 0;
    $$('#komutlar .sozcuk, #tahmin, #ipucu-not, #cevapla, #basla-not .sozcuk, #devir .sozcuk').forEach((b) => {
      if (b.hidden || b.closest('[hidden]')) return;
      KL.dugmeAltiCiz(b, anlik ? 0 : gecikme + i++ * 110, anlik, kirmiziAlti());
    });
  }
  function eksikAltlariCiz() {
    $$('.sozcuk').forEach(b => { if (!b.hidden && !b.closest('[hidden]') && !b.querySelector(':scope > svg.cerceve')) KL.dugmeAltiCiz(b, 0, false, kirmiziAlti()); });
  }

  function kalanCiz(anlik, yeni, gecikme) {
    if (!O.Sc) return;
    if (ikiSutun()) { O.Sc.k.kalan.textContent = ''; return; }
    D.kalanYaz(O.Sc, T(0).kalan, { anlik, yeni, gecikme });
    O.Sc.k.kalan.style.visibility = O.kalanAcik && yardim().kalan ? '' : 'hidden';
  }
  function otoGuncelle(anlik) {
    if (!O.Sc) return;
    D.cizelgeOto(O.Sc, yardim().oto ? V.cikarim(T(0).S) : null, { anlik: true });
    if (!anlik && KL.animasyonVar()) O.Sc.k.cizelgeOto.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'both' });
    cizelgeEtiketleri();
  }

  function gorunurlukGuncelle() {
    const y = yardim(), g = O.oyun, a = O.asama;
    $('#ipucu').hidden = !y.ipucu;
    $('#kalan-ac').hidden = !y.kalan;
    $('#kalan-ac').setAttribute('aria-pressed', String(O.kalanAcik));
    $('#cizelge-ac').hidden = !y.cizelge;
    $('#cizelge-ac').setAttribute('aria-pressed', String(O.cizelgeAcik));
    const cizelgeGorunur = y.cizelge && O.cizelgeAcik;
    document.body.dataset.cizelge = cizelgeGorunur ? 'acik' : 'kapali';
    if (O.Sc) {
      for (const k of ['cizelge', 'cizelgeOto', 'cizelgeElle']) O.Sc.k[k].style.visibility = cizelgeGorunur ? '' : 'hidden';
      O.Sc.k.kalan.style.visibility = O.kalanAcik && y.kalan ? '' : 'hidden';
    }
    const tb = $('#tahmin');
    tb.hidden = !(a === 'giris' || a === 'gizli') || g.bitti;
    tb.querySelector('.yazi').textContent = a === 'gizli' ? 'tamam' : 'tahmin';
    tb.setAttribute('aria-label', a === 'gizli' ? 'Sayımı yazdım' : 'Tahmin et');
    tb.disabled = !(O.giris.length === g.ayar.hane || O.ipucu);
    $('#giris-alan').hidden = !O.ipucu;
    $('#ipucu-not').hidden = !ipucuNotuVar();
    $('#basla-not').hidden = a !== 'basla';
    // Başlangıç notu (o bulsun) cümle uzunsa satır kaydırır: kaç defter satırı tuttuğu ölçülür, altındaki notlar ona göre yerleşir
    if (a === 'basla' && O.L) {
      const satir = Math.max(2, Math.ceil(($('#basla-not').offsetHeight - 2) / O.L.s));
      if (satir !== O.baslaSatir) { O.baslaSatir = satir; boyutla(); }
    }
    $('#devir').hidden = a !== 'devir';
    $('#paylas').hidden = !(mod() === 'gunun' && g.bitti);
    const sayacta = sayacSatiri() != null && !g.bitti && (a === 'cevap' || a === 'celiski');
    $('#sayac-arti').hidden = $('#sayac-eksi').hidden = $('#cevapla').hidden = !sayacta;
    if (sayacta) {
      $('#sayac-arti').setAttribute('aria-label', `artı: ${O.sayac.arti}. Dokun: bir artır`);
      $('#sayac-eksi').setAttribute('aria-label', `eksi: ${O.sayac.eksi}. Dokun: bir artır`);
      $('#cevapla').disabled = !RL.cevapMumkun(O.sayac.arti, O.sayac.eksi, g.ayar);
    }
    tuslariGuncelle();
    eksikAltlariCiz();
    if (O.Sc) {
      rehberCiz();
      const yaz = (a === 'giris' || a === 'gizli') && !g.bitti && !O.ipucu && !O.kilit;
      D.girisImlec(O.Sc, girisK() - O.L.ilk, yaz ? O.giris.length : null, O.sutun);
    }
  }

  /* ---------- rakam çizelgesi ---------- */

  function cizelgeKur() {
    const kap = $('#cizelge');
    for (let d = 0; d < 10; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.d = d;
      b.addEventListener('click', () => cizelgeDokun(d));
      kap.appendChild(b);
    }
  }
  function cizelgeEtiketleri() {
    const cik = O.oyun && yardim().oto ? V.cikarim(T(0).S) : null;
    $$('#cizelge button').forEach((b, d) => {
      let ek = '';
      if (cik) ek = cik.var.includes(d) ? ', kesin var' : cik.yok.includes(d) ? ', kesin yok' : '';
      if (cik && d in cik.yer) ek += `, yeri ${cik.yer[d]}. hane`;
      b.setAttribute('aria-label', `${d} rakamı: ${DURUM_ADI[O.elle[d]]}${ek}`);
    });
  }
  // Dokununca durum döner: boş → var → yok → ? → boş. Elle işaret otomatik işaretin üstünde, ona dokunmaz.
  function cizelgeDokun(d) {
    if (!O.Sc || !O.cizelgeAcik || !yardim().cizelge) return;
    const yeni = DURUMLAR[(DURUMLAR.indexOf(O.elle[d]) + 1) % DURUMLAR.length];
    O.elle[d] = yeni;
    D.cizelgeIsaret(O.Sc, d, yeni, { sayac: ++O.isaretSayac });
    if (yeni) Ses.cal('rakam', 0, 70);
    cizelgeEtiketleri();
  }

  /* ---------- giriş: klavye ve tuş takımı ---------- */

  function rakamUygun(ch, giris = O.giris) {
    const a = O.oyun.ayar;
    if (giris.length >= a.hane) return false;
    if (!a.tekrar && giris.includes(ch)) return false;
    if (!a.sifirBaslar && !giris.length && ch === '0') return false;
    return true;
  }
  const yaziyor = () => !O.kilit && !O.oyun.bitti && (O.asama === 'giris' || O.asama === 'gizli');
  const cevapliyor = () => !O.kilit && !O.oyun.bitti && (O.asama === 'cevap' || O.asama === 'celiski');

  function rakamYaz(ch) {
    if (!yaziyor()) return;
    if (O.ipucu) ipucuKaldir();
    if (!rakamUygun(ch)) return;
    const j = O.giris.length;
    O.giris += ch;
    D.girisRakam(O.Sc, { i: girisK() - O.L.ilk, j, ch, oyun: O.oyunId, sayac: ++O.girisSayac, sutun: O.sutun });
    Ses.cal('rakam', 0, 90);
    gorunurlukGuncelle();
  }
  function sil() {
    if (!yaziyor()) return;
    if (O.ipucu) { ipucuKaldir(); return; }
    if (!O.giris) return;
    O.giris = O.giris.slice(0, -1);
    D.girisSil(O.Sc, O.giris.length);
    gorunurlukGuncelle();
  }

  function tusIsle(t) {
    if (O.asama === 'cevap' || O.asama === 'celiski') {
      if (t === 'sil') sayacAyarla(0, 0, 0);
      else if (t === 'tahmin') cevapla();
      else sayacRakam(Number(t));
      return;
    }
    if (O.asama === 'devir') { if (t === 'tahmin') hazirim(); return; }
    if (t === 'sil') sil();
    else if (t === 'tahmin') (O.asama === 'gizli' ? gizliOnayla() : tahminEt());
    else rakamYaz(t);
  }
  // Kilitliyken (satır yazılırken) gelen tuşlar sıraya alınır; oyun bittiyse ya da yeni sayfa açıldıysa atılır.
  function tusGeldi(t) {
    if (O.kilit && !O.oyun.bitti) { if (O.kuyruk.length < 12) O.kuyruk.push(t); return; }
    tusIsle(t);
  }
  function kuyruguIsle() {
    while (O.kuyruk.length && !O.kilit && !O.oyun.bitti) tusIsle(O.kuyruk.shift());
    if (O.oyun.bitti) O.kuyruk = [];
  }

  const TUSLAR = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sil', '0', 'tahmin'];
  function tuslariKur() {
    const kap = $('#tuslar');
    kap.textContent = '';
    for (const t of TUSLAR) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tus';
      b.dataset.tus = t;
      if (/\d/.test(t)) {
        b.setAttribute('aria-label', t);
        const svg = KL.svgEl('svg', { viewBox: '0 0 40 48', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }, b);
        const K = KL.kalemYap(svg), h = 24;
        Kit.rakam.ciz(K, svg, t, { x: 20 - Kit.rakam.genislik(t, h) / 2, y: 36, boyut: h, renk: 'mavi', tohum: ['tus', t], anlik: true });
      } else b.innerHTML = `<span class="yazi">${t}</span>`;
      b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true' && !O.kilit) return;
        tusGeldi(t);
      });
      kap.appendChild(b);
    }
  }
  function tuslariGuncelle() {
    const g = O.oyun, a = O.asama, yaz = yaziyor(), cev = cevapliyor();
    for (const b of $$('.tus')) {
      const t = b.dataset.tus;
      let k;
      if (cev) {
        const bagli = sayacSatiri() != null;
        if (/\d/.test(t)) k = !bagli || Number(t) > g.ayar.hane;
        else if (t === 'sil') k = !bagli;
        else k = !bagli || !RL.cevapMumkun(O.sayac.arti, O.sayac.eksi, g.ayar);
      } else if (a === 'devir') k = t !== 'tahmin';
      else if (/\d/.test(t)) k = !yaz || !rakamUygun(t);
      else if (t === 'sil') k = !yaz || (!O.giris && !O.ipucu);
      else k = !yaz || !(O.giris.length === g.ayar.hane || O.ipucu);
      b.setAttribute('aria-disabled', String(k));
      if (t === 'tahmin') {
        const ad = cev ? 'cevapla' : a === 'gizli' ? 'tamam' : a === 'devir' ? 'hazırım' : 'tahmin';
        if (b.textContent !== ad) b.innerHTML = `<span class="yazi">${ad}</span>`;
      }
    }
    const kap = $('#tuslar');
    document.documentElement.style.setProperty('--tuslar-h', document.body.dataset.tuslar === 'acik' ? kap.offsetHeight + 'px' : '0px');
  }

  // Telefonda etkin satır tuş takımının altında kalmasın
  function etkinSatiriGoster() {
    if (document.body.dataset.tuslar !== 'acik') return;
    const a = O.asama;
    const hedef = O.oyun.bitti ? $('#yeni') : a === 'basla' ? $('#basla-not') : (a === 'cevap' || a === 'celiski') ? $('#cevapla') : $('#tahmin');
    if (!hedef || hedef.hidden) return;
    const r = hedef.getBoundingClientRect(), alt = window.innerHeight - $('#tuslar').offsetHeight - 16;
    if (r.bottom > alt) window.scrollBy({ top: r.bottom - alt + O.L.s * .5, behavior: KL.animasyonVar() ? 'smooth' : 'auto' });
  }

  /* ---------- tur akışı ---------- */

  // c. sütunun satırı cevaplandı: sırada ne var?
  function sonraki(c) {
    const g = O.oyun;
    if (!ikiSutun()) {
      if (T(0).buldu) { bitir(); return; }
      if (tahminci(0) === 'bilgisayar') bilgisayarSirasi(0);
      else girisAc(0);
      return;
    }
    if (c === 0) {                                         // tur ortası: sıra ikinci sütunda (biri bulsa da tur tamamlanır)
      if (tahminci(1) === 'bilgisayar') bilgisayarSirasi(1); else girisAc(1);
      return;
    }
    if (g.taraf.some(t => t.buldu)) { bitir(); return; }  // tur sonu
    girisAc(0);
  }

  // Sütun c'de giriş satırı açılır (insan tahmin edecek)
  function girisAc(c) {
    O.sutun = c;
    O.asama = 'giris';
    O.giris = '';
    O.kilit = false;
    boyutla();
    adlariCiz(true);
    D.girisKutu(O.Sc, { i: R_(c), oyun: O.oyunId, sutun: c });
    gorunurlukGuncelle();
    if (ikiSutun()) duyur(mod() === 'yaris' ? 'Sıra sende.' : `Sıra ${adlar()[c]}nda.`);
    etkinSatiriGoster();
    kuyruguIsle();
  }

  /* ---------- insan tahmini ---------- */

  async function tahminEt() {
    const g = O.oyun, c = O.sutun, t = T();
    if (!yaziyor() || O.asama !== 'giris') return;
    if (O.ipucu && !O.giris) { ipucuKabul(); return; }
    if (!RL.gecerli(O.giris, g.ayar)) return;
    O.kilit = true;
    const j = O.jeton;
    const tahmin = O.giris, i = R_();
    const node = D.girisAl(O.Sc);
    O.giris = '';
    // Hedef biliniyorsa cevap kendiliğinden; bilinmiyorsa (iki kişi, cevapları biz veririz) öbür oyuncu sayaçla cevaplar
    if (!t.hedef) {
      t.satirlar.push({ tahmin, arti: null, eksi: null });
      boyutla();
      const r = D.satirYaz(O.Sc, i, t.satirlar[i], { tahminNode: node, oyun: O.oyunId, sutun: c, cevapsiz: true });
      Ses.cal('rakam', 0, 80);
      satirMetni();
      duyur(`${adlar()[c]}: ${bosluklu(tahmin)}. ${adlar()[1 - c]} cevaplasın.`);
      await r.bitti;
      if (j !== O.jeton) return;
      sayacBekle();
      return;
    }
    const cv = RL.cevap(t.hedef, tahmin), satir = { tahmin, arti: cv.arti, eksi: cv.eksi };
    t.satirlar.push(satir);
    t.S = V.ele(t.S, tahmin, RL.kod(cv.arti, cv.eksi, g.ayar.hane));
    t.kalan.push(V.kalan(t.S));
    if (RL.kazandi(cv, g.ayar.hane)) t.buldu = true;
    O.asama = 'dusunuyor';
    boyutla();
    gorunurlukGuncelle();
    const r = D.satirYaz(O.Sc, i, satir, { tahminNode: node, oyun: O.oyunId, sutun: c });
    Ses.cal('rakam', 0, 80);
    Ses.cal('cevir', 140);
    sesYazi(cevapGlif(cv.arti, cv.eksi, g.ayar.hane), 230, 140);
    satirMetni();
    duyur(`${ikiSutun() ? adlar()[c] + ', ' : ''}${i + 1}. tahmin ${bosluklu(tahmin)}: artı ${cv.arti}, eksi ${cv.eksi}.` +
      (O.kalanAcik && yardim().kalan && !t.buldu ? ` Kalan aday ${t.kalan[t.kalan.length - 1]}.` : ''));
    if (mod() === 'gunun') gunuKaydet();
    await r.bitti;
    if (j !== O.jeton) return;
    kalanCiz(false, true);
    otoGuncelle(false);
    sonraki(c);
  }

  /* ---------- sonuç ---------- */

  function sonucMetni() {
    const g = O.oyun;
    if (!ikiSutun()) {
      const n = R_(0);
      if (!senBul()) return `buldum: ${n} tahmin`;
      return `${n} tahmin · ${OLCEK(n)}` + (g.ipucuSayisi ? ` · ${g.ipucuSayisi} ipucu` : '');
    }
    const [a, b] = g.taraf, n = Math.max(R_(0), R_(1));
    if (a.buldu && b.buldu) return `berabere: ikiniz de ${n} tahminde`;
    if (mod() === 'yaris') return a.buldu ? `kazandın! ${R_(0)} tahmin` : `o buldu: ${R_(1)} tahmin · kaybettin`;
    return `${adlar()[a.buldu ? 0 : 1]} kazandı · ${n} tahmin`;
  }
  function sonucCiz(anlik) {
    const g = O.oyun, k = O.L.ilk + enCokSatir() + 1;
    if (!ikiSutun()) return D.sonucYaz(O.Sc, k, T(0).satirlar[R_(0) - 1].tahmin, sonucMetni(), { anlik, oyun: O.oyunId });
    // İki sütun: her sütunun altında aradığı sayı (bulduysa tikli); altında ortak sonuç
    const bit = [];
    O.Sc.k.sonuc.textContent = '';
    const L = O.L, Z = L.sutunlar;
    g.taraf.forEach((t, c) => {
      const x = t.buldu ? t.satirlar[t.satirlar.length - 1].tahmin : t.hedef;
      if (!x) return;
      // Sayı ve tik sütunun genişliğine sığsın: rakam boyu en çok .85 satır
      const genis = (c === 0 ? Z[1].x0 - Z[0].x0 - .5 * L.s : L.W - .35 * L.s - Z[1].x0) - .4 * L.s;
      const boyut = Math.min(L.s * .85, genis / (Kit.rakam.genislik(x, 1) + (t.buldu ? .8 : 0)));
      bit.push(D.sonucYaz(O.Sc, k, x, null, { sutun: c, boyut, tik: t.buldu, ekle: true, anlik, oyun: O.oyunId, gecikme: anlik ? 0 : c * 400 }).bitti);
    });
    const m = D.notSatir(O.Sc, 'sonuc', k + 1, sonucMetni(), { renk: 'kirmizi', boyut: .5, anlik, gecikme: anlik ? 0 : 900 });
    return { bitti: Promise.all(bit.concat(m ? [m.bitti] : [])) };
  }
  function bitir() {
    const g = O.oyun;
    g.bitti = true;
    O.asama = 'bitti';
    O.duzelt = null;
    D.girisTemizle(O.Sc);
    D.sayacSil(O.Sc);
    D.notlariSil(O.Sc);
    boyutla();
    adlariCiz(true);
    sonucCiz(false);
    sesYazi(g.ayar.hane, 0, 150);
    Ses.cal('tik', 150 * g.ayar.hane + 180);
    O.kilit = false;
    gorunurlukGuncelle();
    D.dugmeIsaretle($('#yeni'), true);
    if (mod() === 'gunun') gunuKaydet();
    duyur(senBul() ? `Buldun! Sayı ${bosluklu(T(0).hedef)}. ${sonucMetni()}.`
      : ikiSutun() ? sonucMetni() + '.' : `Bilgisayar buldu: ${bosluklu(T(0).satirlar[R_(0) - 1].tahmin)}, ${R_(0)} tahminde.`);
    etkinSatiriGoster();
    sozcukleriCiz(true);
  }

  /* ---------- ipucu (sen bul) ---------- */

  async function ipucuIste() {
    if (!yardim().ipucu || !yaziyor() || O.asama !== 'giris') return;
    if (O.ipucu) { ipucuKabul(); return; }
    O.kilit = true;
    const j = O.jeton;
    let t = null;
    try { t = await V.secAsync(T(0).S, { seviye: 'orta', butceMs: C.cozucu.butceMs, dilimMs: C.cozucu.dilimMs }); } catch (e) { /* iptal */ }
    if (j !== O.jeton) return;
    O.kilit = false;
    if (!t) { gorunurlukGuncelle(); return; }
    for (let k = O.giris.length - 1; k >= 0; k--) D.girisSil(O.Sc, k, true);
    O.giris = '';
    O.ipucu = t.dize;
    O.oyun.ipucuSayisi++;
    D.ipucuGoster(O.Sc, R_(), t.dize);
    boyutla();
    gorunurlukGuncelle();
    duyur(`İpucu: ${bosluklu(t.dize)}. Kabul etmek için İpucu'ya ya da tahmin'e bas.`);
  }
  function ipucuKabul() {
    const d = O.ipucu;
    if (!d) return;
    ipucuKaldir();
    Array.from(d).forEach((ch, j) => D.girisRakam(O.Sc, { i: R_(), j, ch, oyun: O.oyunId, sayac: ++O.girisSayac, gecikme: j * 110 }));
    O.giris = d;
    gorunurlukGuncelle();
  }
  function ipucuKaldir() {
    O.ipucu = null;
    if (O.Sc) D.ipucuSil(O.Sc);
    boyutla();
    gorunurlukGuncelle();
  }

  /* ---------- gizli sayı ve devir ---------- */

  // o bulsun: "tuttum" (sayaçlarla cevap) ya da "sayımı yazayım" (izle: yazılır, karalanır, cevaplar kendiliğinden)
  function tuttum() {
    if (O.asama !== 'basla') return;
    duyur('Bilgisayar düşünüyor.');
    bilgisayarSirasi(0);
  }
  function yazayim() {
    if (O.asama !== 'basla') return;
    O.oyun.mod = 'izle';
    O.asama = 'gizli';
    O.kalanAcik = true;
    boyutla();                                             // ilk satır bir aşağı kayar: sayfa baştan (anında) çizilir
    baslikCiz(true);
    gorunurlukGuncelle();
    duyur('Sayını yaz; yazdıktan sonra kalemle karalanır, bilgisayar görmeden bulmaya çalışır.');
  }
  function gizliAc(c) {
    O.sutun = c;
    O.asama = 'gizli';
    O.giris = '';
    O.kilit = false;
    boyutla();
    adlariCiz(true);
    D.girisCiz(O.Sc, { i: -1, oyun: O.oyunId, sutun: c });
    gorunurlukGuncelle();
    duyur(mod() === 'yaris' ? 'Sayını yaz: bilgisayar bunu bulmaya çalışacak. Yazınca karalanır.'
      : `${adlar()[c]}: sayını yaz, arkadaşın bakmasın. Yazınca karalanır.`);
  }
  async function gizliOnayla() {
    const g = O.oyun, c = O.sutun;
    if (O.asama !== 'gizli' || !RL.gecerli(O.giris, g.ayar)) return;
    O.kilit = true;
    const j = O.jeton, x = O.giris;
    O.giris = '';
    const node = D.girisAl(O.Sc);
    D.girisTemizle(O.Sc);
    O.asama = 'dusunuyor';
    gorunurlukGuncelle();
    let k;
    if (izle()) { T(0).kendi = T(0).hedef = x; k = D.gizliYaz(O.Sc, O.L.ilk - 1, x, { etiket: 'sayım:', karala: true, node, oyun: O.oyunId }); }
    else {
      T(c).kendi = x;
      T(1 - c).hedef = x;                                  // öbür sütun bu sayıyı arar
      k = D.gizliYaz(O.Sc, O.L.ilk - 1, x, { sutun: c, etiket: null, karala: true, node, oyun: O.oyunId });
    }
    for (let n = 0; n < 3; n++) Ses.cal('rakam', (KL.animasyonVar() ? 150 : 0) + n * 260, 360);
    await k.bitti;
    if (j !== O.jeton) return;
    if (izle()) { bilgisayarSirasi(0); return; }
    if (mod() === 'yaris') { girisAc(0); return; }
    if (c === 0) devirAc(`Telefonu ${adlar()[1]}ya ver. ${adlar()[0]} bakmasın.`, () => gizliAc(1));
    else devirAc(`Telefonu ${adlar()[0]}ya ver: ilk tahmin onun.`, () => girisAc(0));
  }

  function devirAc(metin, sonra) {
    O.asama = 'devir';
    O.devirSonra = sonra;
    O.kilit = false;
    $('#devir-metin').textContent = metin;
    gorunurlukGuncelle();
    KL.dugmeAltiCiz($('#hazirim'), 200, false, kirmiziAlti());
    duyur(metin + ' Hazır olunca "hazırım"a bas.');
  }
  function hazirim() {
    if (O.asama !== 'devir' || !O.devirSonra) return;
    const f = O.devirSonra;
    O.devirSonra = null;
    $('#devir').hidden = true;
    f();
  }

  /* ---------- bilgisayar ---------- */

  function dusunuyorYaz(acik) {
    if (!O.Sc) return;
    const Z = D.sut(O.L, O.sutun);
    D.notSatir(O.Sc, 'dusunuyor', O.L.ilk + R_(), acik ? 'o düşünüyor…' : '', { renk: 'kursun', anlik: true, x: Z.x0, boyut: ikiSutun() ? .42 : .48 });
  }

  // Bilgisayarın tahmini (c. sütun): hesap (dilimli) ile düşünme beklemesi paralel; satır mavi yazılır.
  // Hedef biliniyorsa (izle, yarış) cevap kendiliğinden; değilse sayaçlarla beklenir.
  async function bilgisayarSirasi(c) {
    const g = O.oyun, j = O.jeton;
    O.sutun = c;
    const t = T(c);
    O.asama = 'dusunuyor';
    O.kilit = true;
    boyutla();
    adlariCiz(true);
    dusunuyorYaz(true);
    gorunurlukGuncelle();
    if (O.kontrol) O.kontrol.abort();
    const kontrol = (O.kontrol = new AbortController());
    const [a, b] = C.cozucu.dusunmeMs, bekle = KL.animasyonVar() ? a + Math.random() * (b - a) : 0;
    let s = null;
    try {
      [s] = await Promise.all([
        V.secAsync(t.S, { seviye: O.ayar.zorluk, butceMs: C.cozucu.butceMs, dilimMs: C.cozucu.dilimMs, signal: kontrol.signal, islemSiniri: C.cozucu.islemSiniri }),
        KL.bekle(g.gosteri ? bekle * 1.3 : bekle),
      ]);
    } catch (e) { return; }                               // iptal: yeni sayfa açıldı
    if (j !== O.jeton) return;
    dusunuyorYaz(false);
    if (!s) { celiskiGoster(); return; }
    const i = R_(c), satir = { tahmin: s.dize, arti: null, eksi: null };
    t.satirlar.push(satir);
    boyutla();
    const r = D.satirYaz(O.Sc, i, satir, { cevapsiz: true, oyun: O.oyunId, sutun: c });
    sesYazi(1 + g.ayar.hane, 0, 145);
    duyur(`${ikiSutun() ? 'O, ' : ''}${i + 1}. tahmin: ${bosluklu(s.dize)}.` + (t.hedef ? '' : ' Artı ve eksi sayısını işaretle, cevapla.'));
    await r.bitti;
    if (j !== O.jeton) return;
    if (t.hedef) {
      await KL.bekle(KL.animasyonVar() ? 120 : 0);           // kalemi çevirme
      if (j !== O.jeton) return;
      const cv = RL.cevap(t.hedef, s.dize);
      await cevapIsle(i, cv.arti, cv.eksi, j);
      return;
    }
    sayacBekle();
  }

  /* ---------- cevap: sayaçlar, çelişki, düzeltme ---------- */

  function sayacBekle() {
    O.asama = 'cevap';
    O.sayac = { arti: 0, eksi: 0, adim: 0 };
    O.kilit = false;
    boyutla();
    sayacGuncelle();
    gorunurlukGuncelle();
    etkinSatiriGoster();
    kuyruguIsle();
  }

  // c. sütunun i. satırının (yeni) cevabı: kırmızı yazılır, aday kümesi daralır; sonra sıradaki adım.
  async function cevapIsle(i, arti, eksi, j) {
    const g = O.oyun, c = O.sutun, t = T(c), satir = t.satirlar[i];
    O.kilit = true;
    satir.arti = arti; satir.eksi = eksi;
    D.sayacSil(O.Sc);
    O.asama = 'dusunuyor';
    gorunurlukGuncelle();
    const cv = D.cevapYaz(O.Sc, D.satirGrubu(O.Sc, i, c), i, satir, { oyun: O.oyunId, sutun: c });
    Ses.cal('cevir', 0);
    sesYazi(cevapGlif(arti, eksi, g.ayar.hane), 80, 140);
    t.S = V.ele(t.S, satir.tahmin, RL.kod(arti, eksi, g.ayar.hane));
    t.kalan.push(V.kalan(t.S));
    if (RL.kazandi({ arti }, g.ayar.hane)) t.buldu = true;
    satirMetni();
    duyur(`${i + 1}. satır: artı ${arti}, eksi ${eksi}.` + (ikiSutun() ? '' : ` Kalan aday ${V.kalan(t.S)}.`));
    await cv.bitti;
    if (j !== O.jeton) return;
    kalanCiz(false, true);
    otoGuncelle(false);
    if (!t.buldu && !V.kalan(t.S)) { celiskiGoster(); return; }
    if (!ikiSutun() && !t.buldu) {
      await KL.bekle(KL.animasyonVar() ? (g.gosteri ? 500 : 250) : 0);
      if (j !== O.jeton) return;
    }
    sonraki(c);
  }

  // Sayaçlar: dokununca bir artar (0 … hane). Klavye/tuş takımı: ilk rakam artı, ikincisi eksi; sil sıfırlar.
  function sayacAyarla(arti, eksi, adim) {
    if (!cevapliyor() || sayacSatiri() == null) return;
    O.sayac = { arti, eksi, adim };
    sayacGuncelle();
    Ses.cal('cevir', 0);
    gorunurlukGuncelle();
  }
  function sayacRakam(n) {
    const H = O.oyun.ayar.hane;
    if (!cevapliyor() || sayacSatiri() == null || n > H) return;
    if (O.sayac.adim === 0) sayacAyarla(n, O.sayac.eksi, 1);
    else sayacAyarla(O.sayac.arti, n, 0);
  }
  function sayacGuncelle() {
    if (!O.Sc || !(O.asama === 'cevap' || O.asama === 'celiski')) return;
    if (sayacSatiri() == null) { D.sayacSil(O.Sc); return; }
    const olamaz = !RL.cevapMumkun(O.sayac.arti, O.sayac.eksi, O.oyun.ayar);
    D.sayacCiz(O.Sc, sayacSatiri(), O.sayac.arti, O.sayac.eksi, { olamaz, sutun: O.sutun });
  }

  async function cevapla() {
    const g = O.oyun;
    if (!cevapliyor() || sayacSatiri() == null) return;
    const { arti, eksi } = O.sayac;
    if (!RL.cevapMumkun(arti, eksi, g.ayar)) { duyur(`artı ${arti}, eksi ${eksi} olamaz.`); return; }
    const j = O.jeton;
    if (O.duzelt != null) { duzeltBitir(arti, eksi, j); return; }
    await cevapIsle(R_() - 1, arti, eksi, j);
  }

  // Çelişki: aday kalmadı. Tek bir cevabı kaldırınca küme doluyorsa o satır(lar) gösterilir.
  function celiskiGoster() {
    O.celiski = V.celiski(T().S) || { satirlar: [] };
    O.asama = 'celiski';
    O.duzelt = null;
    O.kilit = false;
    boyutla();
    celiskiYaz(false);
    gorunurlukGuncelle();
    etkinSatiriGoster();
    const l = O.celiski.satirlar;
    duyur(l.length && l.length <= 3 ? `Cevaplar çelişiyor: ${l.map(i => i + 1).join('., ')}. satırlardan birini kontrol et. Cevaba dokunup düzeltebilirsin.`
      : 'Cevaplar birbiriyle çelişiyor. Bir cevaba dokunup düzeltebilirsin.');
  }
  function celiskiYaz(anlik) {
    const l = O.celiski ? O.celiski.satirlar : [], k = O.L.ilk + R_(), x = D.sut(O.L, O.sutun).x0, kucuk = ikiSutun() ? .9 : 1;
    // En çok üç aday satır yazılır ("1., 2. ya da 5. satırı kontrol et"); daha çoksa genel not
    const no = l.map(i => `${i + 1}.`);
    const metin = l.length === 1 ? `${no[0]} satırı kontrol et`
      : l.length && l.length <= 3 ? `${no.slice(0, -1).join(', ')} ya da ${no[no.length - 1]} satırı kontrol et`
      : 'cevaplar birbiriyle çelişiyor';
    D.notSatir(O.Sc, 'celiski', k, metin, { renk: 'kirmizi', anlik, boyut: .5 * kucuk, x });
    D.notSatir(O.Sc, 'celiski2', k + 1, 'cevaba dokun, düzelt', { renk: 'kursun', anlik, boyut: .4 * kucuk, gecikme: anlik ? 0 : 500, x });
    const isaretli = l.length && l.length <= 3 ? l : T().satirlar.map((s, i) => (s.arti != null ? i : -1)).filter(i => i >= 0);
    D.cevapAltiCiz(O.Sc, isaretli, { anlik, gecikme: anlik ? 0 : 300, sutun: O.sutun });
  }

  // Bir satırın cevabına dokunuldu: sayaçlar o satıra gelir, eski cevap solar.
  function duzeltBasla(i) {
    const t = T();
    if (!cevapliyor() || t.satirlar[i].arti == null) return;
    if (O.duzelt != null) D.cevapDurum(O.Sc, O.duzelt, 'normal', O.sutun);
    O.duzelt = i;
    if (O.asama !== 'celiski') O.asama = 'cevap';
    O.sayac = { arti: t.satirlar[i].arti, eksi: t.satirlar[i].eksi, adim: 0 };
    D.cevapDurum(O.Sc, i, 'soluk', O.sutun);
    konumla();
    sayacGuncelle();
    gorunurlukGuncelle();
    duyur(`${i + 1}. satırın cevabını düzeltiyorsun: artı ${O.sayac.arti}, eksi ${O.sayac.eksi}.`);
  }
  // Düzeltme onaylandı: aday kümesi bütün cevaplardan baştan kurulur, kalan zinciri yeniden hesaplanır.
  async function duzeltBitir(arti, eksi, j) {
    const g = O.oyun, c = O.sutun, t = T(c), i = O.duzelt, satir = t.satirlar[i];
    O.kilit = true;
    O.duzelt = null;
    satir.arti = arti; satir.eksi = eksi;
    D.sayacSil(O.Sc);
    D.cevapDurum(O.Sc, i, 'sil', c);
    const cv = D.cevapYaz(O.Sc, D.satirGrubu(O.Sc, i, c), i, satir, { oyun: O.oyunId + 1000 * (++O.girisSayac), sutun: c });
    let S = V.kur(g.ayar);
    t.kalan = [S.adaylar.length];
    for (const s of t.satirlar) if (s.arti != null) { S = V.ele(S, s.tahmin, RL.kod(s.arti, s.eksi, g.ayar.hane)); t.kalan.push(V.kalan(S)); }
    t.S = S;
    t.buldu = t.satirlar.some(s => s.arti === g.ayar.hane);
    satirMetni();
    await cv.bitti;
    if (j !== O.jeton) return;
    D.notSatir(O.Sc, 'celiski', 0, ''); D.notSatir(O.Sc, 'celiski2', 0, '');
    D.cevapAltiCiz(O.Sc, []);
    O.celiski = null;
    kalanCiz(true);
    otoGuncelle(false);
    if (!t.buldu && !V.kalan(S)) { celiskiGoster(); return; }
    duyur(`${i + 1}. satır düzeltildi.` + (ikiSutun() ? '' : ` Kalan aday ${V.kalan(S)}.`));
    const son = t.satirlar[t.satirlar.length - 1];
    if (son.arti == null) { sayacBekle(); return; }       // son tahmin hâlâ cevap bekliyor
    sonraki(c);
  }

  /* ---------- günün sayısı ---------- */

  const gunAnahtari = () => 'sb-gun-' + O.oyun.tarih;
  function gunuKaydet() {
    const g = O.oyun;
    yaz(gunAnahtari(), { tahminler: T(0).satirlar.map(s => s.tahmin), bitti: g.bitti, zorluk: O.ayar.zorluk, ipucu: g.ipucuSayisi });
  }
  // Bugün başlanmış ya da bitmiş günün sayısı varsa satırlar yeniden oynatılır (cevaplar yeniden hesaplanır).
  function gunuYukle() {
    const k = oku(gunAnahtari()), g = O.oyun, t = T(0);
    if (!k || !Array.isArray(k.tahminler)) return;
    for (const d of k.tahminler.slice(0, 60)) {
      if (!RL.gecerli(d, g.ayar)) return;
      const cv = RL.cevap(t.hedef, d);
      t.satirlar.push({ tahmin: d, arti: cv.arti, eksi: cv.eksi });
      t.S = V.ele(t.S, d, RL.kod(cv.arti, cv.eksi, g.ayar.hane));
      t.kalan.push(V.kalan(t.S));
      if (RL.kazandi(cv, g.ayar.hane)) { t.buldu = true; break; }
    }
    g.ipucuSayisi = k.ipucu || 0;
    if (t.buldu) { g.bitti = true; O.asama = 'bitti'; g.zorlukSonuc = k.zorluk; }
  }
  async function paylas() {
    const g = O.oyun;
    if (mod() !== 'gunun' || !g.bitti) return;
    const metin = RL.paylasimMetni(g.tarih, R_(0), g.zorlukSonuc || O.ayar.zorluk);
    try {
      if (navigator.share) { await navigator.share({ title: 'Sayı Bulma', text: metin }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(metin); duyur('Panoya kopyalandı: ' + metin); notKisa('panoya kopyalandı'); return; } catch (e) { /* yedek */ }
    const ta = document.createElement('textarea');
    ta.value = metin; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); duyur('Panoya kopyalandı: ' + metin); notKisa('panoya kopyalandı'); }
    catch (e) { duyur(metin); notKisa(metin); }
    ta.remove();
  }
  function notKisa(metin) {
    const k = O.L.ilk + enCokSatir() + 3;
    D.notSatir(O.Sc, 'kisa', k, metin, { renk: 'kursun', boyut: .42 });
    setTimeout(() => { if (O.Sc) D.notSatir(O.Sc, 'kisa', k, ''); }, 2500);
  }

  /* ---------- yeni sayfa: yırtma ---------- */

  // Sayfanın donmuş bir kopyası yukarı kalkıp kopar; altındaki gerçek sayfa o sırada temizlenip kalemle yeniden yazılır.
  function sayfaYirt() {
    if (!KL.animasyonVar()) return Promise.resolve();
    const sayfa = $('#sayfa'), kopya = sayfa.cloneNode(true);
    kopya.removeAttribute('id');
    kopya.classList.add('yirtilan');
    kopya.setAttribute('aria-hidden', 'true');
    kopya.inert = true;
    for (const e of kopya.querySelectorAll('[id]')) if (!e.closest('defs') && !e.closest('mask') && !e.closest('pattern')) e.removeAttribute('id');
    $('#defter').appendChild(kopya);
    Ses.cal('yirt');
    const a = kopya.animate([
      { transform: 'translateY(0) rotate(0deg)', boxShadow: '14px 26px 44px -10px rgba(30,18,6,.55)' },
      { transform: 'translateY(-2.5%) rotate(-.8deg) skewX(-.6deg)', offset: .22 },
      { transform: 'translateY(-118%) rotate(-5deg) skewX(1deg)', boxShadow: '30px 50px 60px -10px rgba(30,18,6,.25)' },
    ], { duration: 400, easing: 'cubic-bezier(.45,0,.8,.3)', fill: 'forwards' });
    return a.finished.then(() => kopya.remove(), () => kopya.remove());
  }

  // o: { mod, gosteri } — verilmezse ayarlardaki mod
  async function yeniSayfa(o = {}) {
    const j = ++O.jeton;
    O.kilit = true;
    if (O.kontrol) { O.kontrol.abort(); O.kontrol = null; }
    // Günün sayısı bittiyse yeni sayfa normal oyuna döner (günün sayısı bir kez oynanır)
    if (!o.mod && O.ayar.mod === 'gunun' && O.oyun.mod === 'gunun' && O.oyun.bitti) { O.ayar.mod = 'senbul'; depoYaz(); }
    notKapat();
    D.dugmeIsaretle($('#yeni'), false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    const yirt = sayfaYirt();
    oyunKur(o);
    O.olcuAnahtar = '';                                   // yeni sayfa: kenar yeniden yırtılır, her şey baştan
    olc();
    konumla();
    sahneCiz(false);
    sozcukleriCiz(true);
    satirMetni();
    O.kilit = false;
    baslangic();
    gorunurlukGuncelle();
    await yirt;
    if (j !== O.jeton) return;
    if (O.oyun.gosteri) {
      duyur(`Nasıl oynanır: bilgisayar ${bosluklu(T(0).hedef)} sayısını bulmaya çalışıyor.`);
      await KL.bekle(KL.animasyonVar() ? 1400 : 0);
      if (j !== O.jeton) return;
      bilgisayarSirasi(0);
    }
  }

  // Yeni oyunun ilk adımı (aşamaya göre) ve duyurusu
  function baslangic() {
    const g = O.oyun, m = mod();
    $('#basla-metin').textContent = `Aklında ${g.ayar.tekrar ? '' : 'rakamları farklı '}${HANE_ADI[g.ayar.hane]} haneli bir sayı tut; bilgisayar bulmaya çalışsın.`;
    if (g.bitti) { sonucCiz(true); D.dugmeIsaretle($('#yeni'), true); duyur(`Bugünün sayısını buldun: ${sonucMetni()}.`); return; }
    if (O.asama === 'basla') duyur($('#basla-metin').textContent + ' Tuttun mu?');
    else if (m === 'yaris') gizliAc(0);
    else if (m === 'ikikisi' && !g.biz) devirAc(`${adlar()[0]} sayısını yazacak. ${adlar()[1]} bakmasın.`, () => gizliAc(0));
    else if (m === 'ikikisi') { girisAc(0); duyur(`Aklınızda birer sayı tutun. ${adlar()[0]} başlar; cevapları öbürü verir.`); }
    else if (m === 'gunun') duyur(`Günün sayısı: herkes bugün aynı sayıyı arıyor.`);
    else if (senBul() && !R_(0)) duyur('Yeni sayfa. Bilgisayar bir sayı tuttu.');
  }

  /* ---------- notlar: ayarlar ve nasıl oynanır ---------- */

  function notAc(id) {
    if (O.not === id) { notKapat(); return; }
    notKapat();
    O.not = id;
    const el = $('#' + id);
    el.hidden = false;
    if (id === 'ayarlar') ayarlariGoster(true);
    konumla();
    O.notSatir = Math.ceil((el.offsetHeight - 2) / O.L.s);
    boyutla();
    $(`[aria-controls="${id}"]`).setAttribute('aria-expanded', 'true');
    if (id === 'ayarlar') ayarlariGoster(false);
    if (id === 'nasil-not') nasilCiz();
    $$('.sozcuk', el).forEach((b, i) => KL.dugmeAltiCiz(b, 200 + i * 120, false, kirmiziAlti()));
    const r = el.getBoundingClientRect(), alt = window.innerHeight - (document.body.dataset.tuslar === 'acik' ? $('#tuslar').offsetHeight : 0);
    if (r.bottom > alt) window.scrollBy({ top: r.bottom - alt + 12, behavior: KL.animasyonVar() ? 'smooth' : 'auto' });
  }
  function notKapat() {
    if (!O.not) return;
    const el = $('#' + O.not), acan = $(`[aria-controls="${O.not}"]`);
    // Odak notun içindeyse: klavyeyle gelindiyse notu açan sözcüğe döner, fareyle/dokunarak gelindiyse bırakılır
    const odak = document.activeElement, icerde = odak && el.contains(odak);
    const klavye = icerde && odak.matches(':focus-visible');
    el.hidden = true;
    if (icerde) { if (klavye) acan.focus({ preventScroll: true }); else odak.blur(); }
    acan.setAttribute('aria-expanded', 'false');
    O.not = null; O.notSatir = 0;
    boyutla();
  }

  const oyunModu = () => (O.oyun.mod === 'izle' && !O.oyun.gosteri ? 'obulsun' : O.oyun.mod);
  function ayarlariGoster(anlik) {
    const y = yardim();
    const sa = O.ayar.sayi;
    const deger = { mod: O.ayar.mod, zorluk: O.ayar.zorluk, cizelge: y.oto ? 'otomatik' : 'elle', biz: O.ayar.biz ? 'biz' : 'cihaz',
      hane: String(sa.hane), sifir: sa.sifirBaslar ? 'evet' : 'hayir', tekrar: sa.tekrar ? 'evet' : 'hayir' };
    $('#biz-ayar').hidden = O.ayar.mod !== 'ikikisi';
    $('#cizelge-ayar').hidden = !y.cizelge;
    $$('#ayarlar .ayar').forEach(b => {
      const secili = deger[b.dataset.ayar] === b.dataset.deger;
      b.setAttribute('aria-pressed', String(secili));
      if (b.dataset.ayar === 'cizelge') b.setAttribute('aria-disabled', String(!y.otoIzin));
      const eski = b.querySelector(':scope > svg.cerceve');
      if (eski) eski.remove();
      if (secili && !b.closest('[hidden]')) KL.dugmeAltiCiz(b, 0, anlik, { stroke: KL.renkDeger('kirmizi'), strokeWidth: 1.4 }, [-.5, 1.2]);
    });
    const ga = O.oyun.ayar, sayiFarkli = mod() !== 'gunun' && (sa.hane !== ga.hane || sa.tekrar !== ga.tekrar || sa.sifirBaslar !== ga.sifirBaslar);
    const bekleyen = (O.ayar.mod !== oyunModu() && !O.oyun.gosteri) || (O.ayar.mod === 'ikikisi' && mod() === 'ikikisi' && O.ayar.biz !== O.oyun.biz);
    const m = mod();
    $('#ayar-aciklama').textContent = bekleyen ? `${MOD_ADI[O.ayar.mod]} yeni sayfada başlar`
      : sayiFarkli ? 'yeni sayı ayarı yeni sayfada başlar'
      : m === 'gunun' ? 'günün sayısı herkese aynı: hep 4 hane, rakamlar farklı'
      : m === 'ikikisi' ? 'iki kişide zorluk yok; sırayla tahmin edersiniz'
      : m === 'yaris' ? 'yarışta zorluk, bilgisayarın ne kadar iyi tahmin ettiğidir'
      : !senBul() ? 'o bulsun\'da zorluk, bilgisayarın ne kadar iyi tahmin ettiğidir'
      : {
        kolay: 'kolayda çizelge kendiliğinden dolar, kalan aday yazılır, ipucu var',
        orta: 'ortada çizelgeyi sen işaretlersin; kalan aday ve ipucu istersen',
        zor: 'zorda yardım yok: çizelge elle, kalan aday ve ipucu kapalı',
      }[O.ayar.zorluk];
  }

  function ayarDegistir(b) {
    if (b.getAttribute('aria-disabled') === 'true') return;
    const ad = b.dataset.ayar, v = b.dataset.deger;
    const bos = O.oyun.taraf.every(t => !t.satirlar.length) && !O.oyun.gosteri;
    if (ad === 'mod' && v !== O.ayar.mod) {
      O.ayar.mod = v;
      depoYaz();
      if (bos || O.oyun.bitti) { yeniSayfa(); return; }   // sayfada henüz tahmin yoksa hemen; varsa yeni sayfada
    } else if (ad === 'hane' || ad === 'sifir' || ad === 'tekrar') {
      const sa = Object.assign({}, O.ayar.sayi);
      if (ad === 'hane') sa.hane = Number(v);
      if (ad === 'sifir') sa.sifirBaslar = v === 'evet';
      if (ad === 'tekrar') sa.tekrar = v === 'evet';
      O.ayar.sayi = RL.ayar(sa);
      O.ayar.sayiElle = true;
      depoYaz();
      if (bos && mod() !== 'gunun') { yeniSayfa(); return; }
    } else if (ad === 'biz') {
      O.ayar.biz = v === 'biz';
      depoYaz();
      if (mod() === 'ikikisi' && bos) { yeniSayfa(); return; }
    } else if (ad === 'zorluk' && v !== O.ayar.zorluk) {
      O.ayar.zorluk = v;
      O.kalanAcik = kalanVarsayilan();
      if (!yardim().ipucu && O.ipucu) ipucuKaldir();
      baslikCiz(true);
      kalanCiz(true);
      otoGuncelle(false);
    } else if (ad === 'cizelge') {
      O.ayar.cizelge = v;
      otoGuncelle(false);
    } else return;
    depoYaz();
    ayarlariGoster(false);
    gorunurlukGuncelle();
    boyutla();
  }

  // Nasıl oynanır: iki örnek satır kalemle; gizli sayı ve tahminler hane ayarına göre, açıklama cevaptan üretilir
  const ORNEKLER = { 3: ['470', '407', '715'], 4: ['4703', '4130', '5678'], 5: ['47035', '41302', '56789'] };
  const birlestir = (l) => (l.length === 1 ? l[0] : `${l.slice(0, -1).join(', ')} ile ${l[l.length - 1]}`);
  function ornekAciklama(gizli, t) {
    const yer = [], baska = [];
    Array.from(t).forEach((d, i) => { if (gizli[i] === d) yer.push(d); else if (gizli.includes(d)) baska.push(d); });
    if (!yer.length && !baska.length) return 'hiçbiri yok';
    if (!yer.length && baska.length === 1) return `yalnız ${baska[0]} var, o da başka yerde`;
    return [yer.length ? `${birlestir(yer)} yerinde` : '', baska.length ? `${birlestir(baska)} başka yerde` : ''].filter(Boolean).join('; ');
  }
  function nasilCiz() {
    const s = O.L.s, hane = O.oyun.ayar.hane, [gizli, ...tahminler] = ORNEKLER[hane] || ORNEKLER[4];
    $('#nasil-1').textContent = `Biri ${O.oyun.ayar.tekrar ? '' : 'rakamları farklı '}${HANE_ADI[hane]} haneli bir sayı tutar, öbürü tahmin eder.`;
    tahminler.forEach((t, n) => {
      const id = 'ornek-' + (n + 1), c = RL.cevap(gizli, t), metin = D.cevapMetni(c.arti, c.eksi, hane);
      const svg = $('#' + id), w = Kit.rakam.genislik(t, O.L.hT * .9) + .55 * s + Kit.rakam.genislik(metin, O.L.hC * .9) + 6;
      svg.style.width = w + 'px';
      svg.textContent = '';
      svg.setAttribute('viewBox', `0 0 ${w} ${s}`);
      const K = KL.kalemYap(svg), y = s * .86;
      const a = Kit.rakam.yaz(K, svg, t, { x: 2, y, boyut: O.L.hT * .9, renk: 'mavi', tohum: ['ornek', t], gecikme: 250 });
      Kit.rakam.yaz(K, svg, metin, { x: a.genislik + .55 * s, y, boyut: O.L.hC * .9, renk: 'kirmizi', tohum: ['ornek', metin], gecikme: 250 + a.sure + 120 });
      $(`#${id}-okunan`).textContent = `${bosluklu(t)}: artı ${c.arti}, eksi ${c.eksi}.`;
      $(`#${id}-aciklama`).textContent = ornekAciklama(gizli, t);
    });
  }

  function sesGuncelle() {
    const b = $('#ses');
    b.setAttribute('aria-pressed', String(!Ses.sessiz));
    b.setAttribute('aria-label', Ses.sessiz ? 'Ses kapalı' : 'Ses açık');
    b.querySelector('.yazi').textContent = Ses.sessiz ? 'Ses kapalı' : 'Ses';
    KL.dugmeAltiCiz(b, 0, true, kirmiziAlti());
  }

  /* ---------- erişilebilirlik ---------- */

  const bosluklu = (d) => (d || '').split('').join(' ');
  function duyur(metin) { $('#duyuru').textContent = metin; }
  function satirMetni() {
    const ol = $('#satir-metni');
    ol.textContent = '';
    O.oyun.taraf.forEach((t, c) => t.satirlar.forEach((s, i) => {
      const li = document.createElement('li');
      li.textContent = `${ikiSutun() ? adlar()[c] + ', ' : ''}${i + 1}. tahmin ${bosluklu(s.tahmin)}` + (s.arti != null ? `: artı ${s.arti}, eksi ${s.eksi}` : ': cevap bekliyor');
      ol.appendChild(li);
    }));
  }

  /* ---------- olaylar ---------- */

  function olaylariBagla() {
    $('#yeni').addEventListener('click', () => yeniSayfa());
    $('#ipucu').addEventListener('click', ipucuIste);
    $('#ipucu-not').addEventListener('click', ipucuIste);
    $('#giris-alan').addEventListener('click', ipucuKabul);
    $('#tahmin').addEventListener('click', () => tusGeldi('tahmin'));
    $('#tuttum').addEventListener('click', tuttum);
    $('#yazayim').addEventListener('click', yazayim);
    $('#hazirim').addEventListener('click', hazirim);
    $('#paylas').addEventListener('click', paylas);
    $('#sayac-arti').addEventListener('click', () => sayacAyarla((O.sayac.arti + 1) % (O.oyun.ayar.hane + 1), O.sayac.eksi, 1));
    $('#sayac-eksi').addEventListener('click', () => sayacAyarla(O.sayac.arti, (O.sayac.eksi + 1) % (O.oyun.ayar.hane + 1), 0));
    $('#cevapla').addEventListener('click', cevapla);
    $('#cizelge-ac').addEventListener('click', () => { O.cizelgeAcik = !O.cizelgeAcik; depoYaz(); gorunurlukGuncelle(); });
    $('#kalan-ac').addEventListener('click', () => { O.kalanAcik = !O.kalanAcik; gorunurlukGuncelle(); });
    $('#ses').addEventListener('click', () => { Ses.sessizYap(!Ses.sessiz); sesGuncelle(); if (!Ses.sessiz) Ses.cal('tik'); });
    // Tarayıcılar ses için kullanıcı dokunuşu ister: ilk dokunuşta/tuşta ses bağlamı açılır
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    $('#nasil').addEventListener('click', () => notAc('nasil-not'));
    $('#nasil-kapat').addEventListener('click', notKapat);
    $('#izle').addEventListener('click', () => yeniSayfa({ mod: 'izle', gosteri: true }));
    $('#ayarlar-ac').addEventListener('click', () => notAc('ayarlar'));
    $('#ayarlar-kapat').addEventListener('click', notKapat);
    $$('#ayarlar .ayar').forEach(b => b.addEventListener('click', () => ayarDegistir(b)));
    $$('.sozcuk').forEach(b => b.addEventListener('click', () => KL.dugmeAltiVurgu(b)));
    // Fareyle/dokunarak basılan düğme odakta kalmasın: yoksa Enter "tahmin" yerine o düğmeye basar
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && e.detail > 0) setTimeout(() => b.blur(), 0);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('.defterde-donus')) return; // Platform bağlantısında doğal klavye gezinmesi.
      if (e.key === 'Escape') { notKapat(); return; }
      // Görünen bir düğme odaktaysa Enter/boşluk onu çalıştırır; gizlenmiş bir düğmede kalmış odak sayılmaz.
      const odak = document.activeElement;
      if (odak && odak.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ') && odak.offsetParent !== null && !odak.closest('[hidden]')) return;
      if (/^[0-9]$/.test(e.key)) { tusGeldi(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { tusGeldi('sil'); e.preventDefault(); }
      else if (e.key === 'Enter') { if (O.asama === 'basla') tuttum(); else tusGeldi('tahmin'); e.preventDefault(); }
    });
    let bekleyen = 0;
    const yenidenBoyutla = () => {
      cancelAnimationFrame(bekleyen);
      bekleyen = requestAnimationFrame(() => { boyutla(); tuslariGuncelle(); });
    };
    window.addEventListener('resize', yenidenBoyutla);
    window.addEventListener('orientationchange', yenidenBoyutla);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', yenidenBoyutla);
  }

  /* ---------- başlangıç ---------- */

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    Kit.malzeme.sec('kirmizimavi', { cizim: C.cizim, renk: C.renk });
    ayarlariYukle();
    oyunKur();
    cizelgeKur();
    olc();
    konumla();
    const fontHazir = await KL.fontBekle();
    tuslariKur();
    olaylariBagla();
    sesGuncelle();
    const gec = sahneCiz(false);
    sozcukleriCiz(false, Math.min(gec, 900));
    satirMetni();
    baslangic();
    gorunurlukGuncelle();
    if (!fontHazir) KL.fontGelince(() => { sahneCiz(true); sozcukleriCiz(true); });
  }

  SB.ui = { O };
  basla();
})();
