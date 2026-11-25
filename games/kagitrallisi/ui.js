// ui.js — kontrolör: ölçü/yerleşim, modlar, hamle akışı, bilgisayar sırası, geri alma, ayar panelleri, seri,
// günün pisti, hayalet, "nasıl oynanır" gösterisi, ses. Kurallar rules.js, ölçüm ai.js, çizim draw.js'te.
(function () {
  'use strict';

  const KR = window.KR, Kit = window.Kit, KL = Kit.kalem;
  const C = KR.config, T = KR.track, R = KR.rules, A = KR.ai, G = KR.gen, D = KR.draw;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => Array.from(k.querySelectorAll(s));
  const Ses = Kit.ses ? Kit.ses.kur({ anahtar: 'kr-sessiz' }) : { cal() {}, baslat() {}, sessiz: true, sessizYap() {} };

  /* ---------- depo (Safari file:// localStorage fırlatabilir: bellek yedeği) ---------- */

  const bellek = {};
  const depo = {
    oku(k, v) {
      try { const s = localStorage.getItem(k); if (s != null) return JSON.parse(s); } catch (e) { /* yedek */ }
      return k in bellek ? bellek[k] : v;
    },
    yaz(k, v) { bellek[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yoksay */ } },
  };

  const VARSAYILAN = {
    mod: C.mod, pist: C.pist, zorluk: C.zorluk, rakip: C.rakip, seri: C.seri, oyuncuSayisi: C.oyuncuSayisi,
    adlar: C.adlar.slice(), renkler: C.renkler.slice(),
    tur: C.kural.tur, carpma: C.kural.carpma, kesisme: C.kural.kesisme, yerindeDurma: C.kural.yerindeDurma,
    frenIzi: C.frenIzi, yarisModu: C.yarisModu, kontrolGoster: C.kontrolGoster,
  };
  const kayitli = depo.oku('kr-ayar', null);
  const ayar = Object.assign({}, VARSAYILAN, kayitli || {});
  const ilkZiyaret = !kayitli;
  const kaydet = () => depo.yaz('kr-ayar', ayar);

  const RENK_AD = { mavi: 'Mavi', kirmizi: 'Kırmızı', yesil: 'Yeşil', turuncu: 'Turuncu' };
  const renk = (ad) => KL.renkDeger(ad);

  const U = {
    jeton: 0, yarisId: 0, mod: null, tanim: null, pist: null, durum: null, gecmis: [], harita: null, haritaSoz: null,
    oyuncular: [], kural: null, seri: null, demo: null, S: null, l: null, bekleyen: null, siraKaydir: 0, odak: 4,
    gunun: null, rekor: null, hayalet: null, kurulumAyar: null,
  };

  /* ---------- ölçü ---------- */

  // Dokunmatik cihaz: aday aralığı ≥ 36 px gerekir (test için KR.ui.U.dokunmatik ile zorlanabilir).
  const dokunmatik = () => U.dokunmatik ?? ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window);

  // Üç düzen: defter (eğik kâğıt, sağ marj) · dikey (kâğıt ekranı doldurur, pist kaydırılır) · yatay (pist solda, marj sütunu sağda)
  function olcuHesapla() {
    const { vw, vh } = KL.alan();
    const p = U.pist || { W: 30, H: 18 };
    const bw = p.W + 2, bh = p.H + 2;
    const sw = 5 + bw + 1 + 10, sh = 3.2 + bh + 3;
    const sqGenis = Math.floor(Math.min((vw - 60) / sw, (vh - 28) / sh));
    const dok = dokunmatik(), enAz = dok ? 32 : 14;
    let l;
    if (sqGenis >= enAz && vw >= 700) l = { duzen: 'defter', sq: Math.min(34, sqGenis), hucre: Math.min(34, sqGenis) };
    else {
      const yatay = vw > vh && vw >= 640;
      const sq = Math.max(16, Math.min(24, Math.floor(yatay ? vh / 26 : vw / 20)));
      l = { duzen: yatay ? 'yatay' : 'dikey', sq, hucre: dok ? 36 : 24 };
    }
    Object.assign(l, { dar: l.duzen !== 'defter', dok, bw, bh, sw, sh });
    const st = document.documentElement.style;
    st.setProperty('--sq', l.sq + 'px');
    st.setProperty('--hucre', l.hucre + 'px');
    for (const k of ['bw', 'bh', 'sw', 'sh']) st.setProperty('--' + k, l[k]);
    document.body.dataset.duzen = l.duzen;
    const once = U.l;
    U.l = l;
    const degisti = !once || once.duzen !== l.duzen || once.sq !== l.sq || once.hucre !== l.hucre;
    if (degisti) sahneSusle();
    return degisti;
  }

  // Sayfa dışı/etrafı: spiral cilt, başlık alt çizgisi, logo (ölçü değişince yeniden)
  function sahneSusle() {
    const l = U.l;
    const cilt = $('#cilt');
    if (cilt) requestAnimationFrame(() => { const h = $('#sayfa').offsetHeight || Math.round(l.sq * l.sh); D.ciltCiz(cilt, h, Math.max(18, l.sq)); });
    const logo = $('#logo');
    if (logo) D.logoCiz(logo);
    requestAnimationFrame(baslikAltiCiz);
    kalemNesnesi(true);
  }

  function baslikAltiCiz() {
    const h = $('#baslik'), svg = $('#baslik-alt');
    if (!h || !svg) return;
    const w = h.offsetWidth, hh = h.offsetHeight;
    if (!w) return;
    svg.setAttribute('viewBox', `0 0 ${w + 20} 14`); svg.setAttribute('width', w + 20); svg.setAttribute('height', 14);
    svg.style.top = (hh - 4) + 'px';
    svg.textContent = '';
    const K = KL.kalemYap(svg);
    KL.altiCiz(K, svg, 8, w + 4, 5, { tohum: ['baslik-alti', U.yarisId], ek: { strokeWidth: 2.8, roughness: .9 }, anlik: U.yarisId > 1 });
  }

  let kalemRenk = '';
  function kalemNesnesi(anlik) {
    const svg = $('#kalem-nesne');
    if (!svg || !U.durum) return;
    const i = U.durum.bitti ? -1 : R.siradakiAraba(U.durum);
    const r = renk(U.oyuncular[i >= 0 ? i : 0].renk);
    if (r === kalemRenk && !anlik) return;
    const degisti = kalemRenk && r !== kalemRenk;
    kalemRenk = r;
    D.kalemNesnesiCiz(svg, r, ['kalem', r]);
    if (degisti && KL.animasyonVar()) {
      svg.animate([{ transform: 'rotate(-5deg) translate(-6px, 0)' }, { transform: 'rotate(-6.5deg) translate(4px, -3px)' }, { transform: 'rotate(-5deg) translate(0, 0)' }], { duration: 420, easing: 'ease-in-out' });
    }
  }

  /* ---------- yazılar ---------- */

  const duyur = (m) => { $('#duyuru').textContent = m; };
  let notJeton = 0;
  function notYaz(m, o = {}) {
    const e = $('#not');
    e.textContent = m || '';
    e.classList.toggle('kursun', !!o.kursun);
    const j = ++notJeton;
    if (m && o.sure) setTimeout(() => { if (j === notJeton) e.textContent = ''; }, o.sure);
  }

  function hizParcalari(vx, vy) {
    const p = [];
    if (vx) p.push(`${Math.abs(vx)} ${vx > 0 ? 'sağa' : 'sola'}`);
    if (vy) p.push(`${Math.abs(vy)} ${vy > 0 ? 'aşağı' : 'yukarı'}`);
    return p.length ? p : ['duruyor'];
  }
  const hizYazi = (vx, vy) => 'hız: ' + hizParcalari(vx, vy).join(', ');

  const adGoster = (i) => {
    const oy = U.oyuncular[i];
    return oy.ad;
  };

  function baslikYaz() {
    const e = $('#pist-adi');
    e.textContent = '';
    const ad = document.createElement('span');
    ad.className = 'ad';
    ad.textContent = U.mod === 'demo' ? 'İlk Viraj · gösteri' : U.pist.ad + (U.seri ? ` · seri ${U.seri.no + 1}/3` : '');
    e.appendChild(ad);
    KL.harfle(ad, null, { tohum: ['pist-adi', ad.textContent], anlik: true });
    const alt = document.createElement('span');
    alt.className = 'par';
    const parca = [];
    if (U.harita && U.harita.par < 255) parca.push(`ideal ${U.harita.par} hamle`);
    if (U.kural && U.kural.tur > 1) parca.push(`${U.kural.tur} tur`);
    if (U.mod === 'gunun') parca.push(new Date(U.gunun.tarih + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }));
    alt.textContent = parca.join(' · ');
    e.appendChild(alt);
    $('#tarih').textContent = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  let sonHiz = '';
  function marjGuncelle(gosterilen) {
    const d = U.durum;
    if (!d) return;
    const i = gosterilen ?? (d.bitti ? -1 : R.siradakiAraba(d));
    const sira = $('#sira');
    if (i >= 0 && !d.bitti) {
      sira.textContent = U.oyuncular.length > 1 ? `sıra: ${adGoster(i)}` : 'sıra sende';
      sira.style.color = renk(U.oyuncular[i].renk);
    } else { sira.textContent = d.bitti ? 'yarış bitti' : ''; sira.style.color = ''; }
    const a = d.arabalar[i >= 0 ? i : 0];
    const anahtar = [i, a.vx, a.vy, U.oyuncular[i >= 0 ? i : 0].renk, U.yarisId].join();
    if (anahtar !== sonHiz) {
      sonHiz = anahtar;
      D.hizOkuCiz($('#hiz-oku'), a.vx, a.vy, renk(U.oyuncular[i >= 0 ? i : 0].renk), ['hiz', U.yarisId, i, a.vx, a.vy]);
    }
    const hy = $('#hiz-yazi');
    hy.textContent = '';
    hizParcalari(a.vx, a.vy).forEach((t, k) => { if (k) hy.appendChild(document.createElement('br')); hy.appendChild(document.createTextNode(t)); });
    hy.style.color = i >= 0 ? renk(U.oyuncular[i].renk) : '';
    const tur = d.ayar.tur;
    $('#hamle-yazi').textContent = a.hamle ? `${a.hamle}. hamle` : 'başlangıç';
    const alt = [];
    if (tur > 1) alt.push(`tur ${Math.min(a.tur + 1, tur)}/${tur}`);
    if (U.harita && U.harita.par < 255) alt.push(`ideal ${U.harita.par}`);
    if (U.rekor && U.oyuncular.length === 1) alt.push(`en iyin ${U.rekor.hamle}`);
    $('#tur-yazi').textContent = alt.join(' · ');
    const ol = $('#oyuncular');
    ol.textContent = '';
    if (U.oyuncular.length > 1 || U.seri || tur > 1) {
      for (const j of d.sira) {
        const b = d.arabalar[j], li = document.createElement('li');
        if (j === i) li.className = 'sirada';
        const mini = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        mini.setAttribute('class', 'mini-araba'); mini.setAttribute('aria-hidden', 'true');
        li.appendChild(mini);
        D.miniAraba(mini, renk(U.oyuncular[j].renk), j + 1, [U.yarisId, j]);
        const ad = document.createElement('span');
        ad.className = 'ad'; ad.textContent = adGoster(j); ad.style.color = renk(U.oyuncular[j].renk);
        li.appendChild(ad);
        const durum = document.createElement('span');
        if (b.bekle > 0) { durum.className = 'centik'; durum.textContent = '| 1 tur'; }
        else { durum.className = 'durum'; durum.textContent = b.durum === 'bitirdi' ? 'bitirdi' : b.durum === 'elendi' ? 'elendi' : ''; }
        li.appendChild(durum);
        if (tur > 1 && b.tur > 0) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          c.setAttribute('class', 'cetele'); c.setAttribute('aria-label', `${b.tur} tur tamam`);
          li.appendChild(c);
          D.ceteleCiz(c, b.tur, ['cetele', U.yarisId, j]);
        }
        if (U.seri) { const p = document.createElement('span'); p.className = 'puan'; p.textContent = U.seri.puan[j] + ' p'; li.appendChild(p); }
        ol.appendChild(li);
      }
    }
    kalemNesnesi();
  }

  /* ---------- harita (BFS) ve önbellek ---------- */

  const haritalar = new Map();
  function haritaHazirla(p, tur, j) {
    const VM = C.bfs.hizSiniri, anahtar = A.onbellekAnahtari(p, tur, VM);
    if (haritalar.has(anahtar)) return Promise.resolve(haritalar.get(anahtar));
    try {
      const s = localStorage.getItem(anahtar);
      if (s) { const h = A.ac(s); haritalar.set(anahtar, h); return Promise.resolve(h); }
    } catch (e) { /* önbellek yok */ }
    notYaz('pist ölçülüyor…', { kursun: true });
    return A.olcAsync(p, { tur, hiz: VM }, { dilimMs: C.bfs.dilimMs, iptal: () => j !== U.jeton }).then(h => {
      haritalar.set(anahtar, h);
      try {
        const s = A.paketle(h);
        if (s.length < 1.5e6) {
          const liste = depo.oku('kr-olcu-liste', []).filter(k => k !== anahtar);
          while (liste.length >= 4) { try { localStorage.removeItem(liste.shift()); } catch (e) { /* yoksay */ } }
          localStorage.setItem(anahtar, s);
          liste.push(anahtar);
          depo.yaz('kr-olcu-liste', liste);
        }
      } catch (e) { /* kota: önbelleğe yazılmaz */ }
      if (j === U.jeton && $('#not').textContent === 'pist ölçülüyor…') notYaz('');
      return h;
    });
  }

  /* ---------- yarış kurulumu ---------- */

  const PISTLER = () => T.kayit;
  const geriSerbest = () => !U.demo && !U.kural.yarisModu && U.mod !== 'gunun';

  function oyunculariKur(mod) {
    if (mod === 'demo') return [
      { ad: 'Usta', renk: 'mavi', tur: 'bilgisayar', zorluk: 'zor' },
      { ad: 'Aceleci', renk: 'kirmizi', tur: 'bilgisayar', zorluk: 'gosteri' },
    ];
    if (mod === 'bilgisayar') {
      const l = [{ ad: 'Sen', renk: 'mavi', tur: 'insan' }];
      const n = Math.max(1, Math.min(3, Number(ayar.rakip) || 1));
      ['kirmizi', 'yesil', 'turuncu'].slice(0, n).forEach((r, k) =>
        l.push({ ad: n > 1 ? `Bilgisayar ${k + 1}` : 'Bilgisayar', renk: r, tur: 'bilgisayar', zorluk: ayar.zorluk }));
      return l;
    }
    if (mod === 'aynicihaz') {
      const n = Math.max(2, Math.min(4, Number(ayar.oyuncuSayisi) || 2));
      return Array.from({ length: n }, (_, k) => {
        const r = ayar.renkler[k] || C.renkler[k];
        return { ad: (ayar.adlar[k] || '').trim() || RENK_AD[r], renk: r, tur: 'insan' };
      });
    }
    return [{ ad: 'Sen', renk: 'mavi', tur: 'insan' }];
  }

  function pistSec(mod) {
    if (mod === 'demo') return T.bul('ilk-viraj');
    if (mod === 'gunun') {
      const tarih = G.yerelTarih();
      if (!U.gunun || U.gunun.tarih !== tarih) {
        const g = G.gununPisti(tarih, C.gen);
        U.gunun = { tarih, tanim: g.tanim, harita: g.harita };
        haritalar.set(A.onbellekAnahtari(T.ayristir(g.tanim), 1, C.bfs.hizSiniri), g.harita);
      }
      return U.gunun.tanim;
    }
    if (U.seri) return T.bul(U.seri.pistler[U.seri.no]);
    return T.bul(ayar.pist) || PISTLER()[0];
  }

  // Yeni yarışta eski sayfa ciltten çevrilir: durağan klon üstte döner, gerçek sayfa altta yeniden çizilir.
  function sayfaCevir() {
    const sayfa = $('#sayfa');
    if (!U.durum || !KL.animasyonVar()) return;
    if (U.l.dar) {
      const a = $('#pist-kap').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      a.finished.then(() => a.cancel(), () => {});
      return;
    }
    const klon = sayfa.cloneNode(true);
    klon.id = ''; klon.className = 'sayfa sayfa-klon'; klon.setAttribute('aria-hidden', 'true');
    klon.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    klon.querySelectorAll('.panel').forEach(e => e.remove());
    sayfa.parentNode.appendChild(klon);
    const a = klon.animate([
      { transform: 'perspective(1600px) rotateY(0deg)', filter: 'brightness(1)' },
      { transform: 'perspective(1600px) rotateY(-70deg)', filter: 'brightness(.86)', offset: .6 },
      { transform: 'perspective(1600px) rotateY(-108deg)', filter: 'brightness(.7)' },
    ], { duration: 520, easing: 'ease-in', fill: 'forwards' });
    a.finished.then(() => klon.remove(), () => klon.remove());
  }

  async function yeniYaris(o = {}) {
    const j = ++U.jeton;
    if (U.yarisId && !o.anlik) sayfaCevir();
    U.yarisId++;
    U.bekleyen = null;
    panelleriKapat();
    const mod = o.demo ? 'demo' : ayar.mod;
    U.mod = mod;
    U.demo = mod === 'demo' ? { aciklama: new Set() } : null;
    if (!o.seriDevam) U.seri = null;
    if (o.seriBasla && (mod === 'bilgisayar' || mod === 'aynicihaz')) {
      const l = PISTLER().map(t => t.kimlik), b = Math.max(0, l.indexOf(ayar.pist));
      U.seri = { pistler: [0, 1, 2].map(k => l[(b + k) % l.length]), no: 0, puan: null };
    }
    if (mod === 'gunun' || mod === 'demo') notYaz(mod === 'gunun' ? 'günün pisti çiziliyor…' : '', { kursun: true });
    if (mod === 'gunun') await KL.bekle(30);
    if (j !== U.jeton) return;
    U.tanim = pistSec(mod);
    U.pist = T.ayristir(U.tanim);
    U.kural = {
      tur: mod === 'gunun' || mod === 'demo' ? 1 : Number(ayar.tur) || 1,
      carpma: mod === 'demo' ? 'okul' : ayar.carpma, kesisme: mod === 'demo' ? true : !!ayar.kesisme,
      yerindeDurma: mod === 'demo' ? 'zorunlu' : ayar.yerindeDurma, yarisModu: mod === 'gunun' || !!ayar.yarisModu,
    };
    U.oyuncular = oyunculariKur(mod);
    if (U.seri && !U.seri.puan) U.seri.puan = U.oyuncular.map(() => 0);
    const n = U.oyuncular.length, k0 = U.siraKaydir++ % n;
    const sira = Array.from({ length: n }, (_, k) => (k + k0) % n);
    U.durum = R.yeniYaris(U.pist, U.kural, U.oyuncular, { sira });
    U.gecmis = [];
    U.harita = null;
    U.rekor = null;
    U.hayalet = null;
    if (mod === 'solo' || mod === 'gunun') {
      U.rekor = depo.oku(rekorAnahtari(), null);
      if (U.rekor && U.rekor.iz && U.rekor.iz.length > 1) U.hayalet = U.rekor.iz;
    }
    olcuHesapla();
    sozcukleriCiz(true);
    komutlariGuncelle();
    U.S = D.sahne($('#cizim'), U.pist, U.yarisId);
    hedefleriTemizle();
    baslikYaz();
    sonHiz = '';
    if (mod !== 'gunun' && mod !== 'demo') notYaz('');
    const ciz = D.pistCiz(U.S, { anlik: o.anlik, kontrolGoster: !!ayar.kontrolGoster });
    U.haritaSoz = haritaHazirla(U.pist, U.kural.tur, j).then(h => {
      if (j === U.jeton) { U.harita = h; baslikYaz(); marjGuncelle(); }
      return h;
    }).catch(() => null);
    marjGuncelle();
    if (!o.anlik) await KL.bekle(Math.min(ciz.sure, 1600));
    if (j !== U.jeton) return;
    arabalariYerlestir();
    kaydirNotu();
    if (U.demo) demoAciklama('basla');
    else if (mod === 'gunun') notYaz(U.rekor ? `bugünkü en iyin: ${U.rekor.hamle} hamle` : 'günün pisti: herkes aynı pistte', { kursun: true });
    else if (mod === 'solo' && U.rekor) notYaz(`en iyin ${U.rekor.hamle} hamle: silik araba`, { kursun: true });
    akis(j);
  }

  const rekorAnahtari = () => (U.mod === 'gunun' ? 'kr-gun-' + U.gunun.tarih : `kr-eniyi-${U.pist.kimlik}-${U.kural.tur}`);

  function baslangicAcisi() {
    const z = U.pist.bitis;
    return Math.atan2(z.yon[1], z.yon[0]) * 180 / Math.PI;
  }
  function arabaAcisi(a) {
    if (a.vx || a.vy) return Math.atan2(a.vy, a.vx) * 180 / Math.PI;
    for (let k = a.iz.length - 1; k > 0; k--) {
      const [x1, y1] = a.iz[k - 1], [x2, y2] = a.iz[k];
      if (x1 !== x2 || y1 !== y2) return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    }
    return baslangicAcisi();
  }

  function arabalariYerlestir() {
    const d = U.durum;
    U.S.arabalar.forEach((e, i) => D.arabaSil(U.S, i));
    D.izlerCiz(U.S, d, U.oyuncular.map(o => renk(o.renk)));
    d.arabalar.forEach((a, i) => {
      const e = D.arabaKoy(U.S, i, renk(U.oyuncular[i].renk), a.x, a.y, arabaAcisi(a), { no: i + 1 });
      e.g.setAttribute('opacity', a.durum === 'elendi' ? '.35' : '1');
    });
    hayaletGuncelle(true);
  }

  function hayaletGuncelle(anlik) {
    if (!U.hayalet) return;
    const a = U.durum.arabalar[0], iz = U.hayalet, k = Math.min(a.hamle, iz.length - 1);
    const [x, y] = iz[k], once = iz[Math.max(0, k - 1)];
    const aci = k ? Math.atan2(y - once[1], x - once[0]) * 180 / Math.PI : baslangicAcisi();
    if (!U.S.arabalar.has('h') || anlik) {
      D.arabaSil(U.S, 'h');
      D.arabaKoy(U.S, 'h', renk('kursun'), x, y, aci, { hayalet: true });
    } else D.arabaTasi(U.S, 'h', x, y, aci, 200);
  }

  /* ---------- akış ---------- */

  async function akis(j) {
    while (j === U.jeton && !U.durum.bitti) {
      const d = U.durum, i = R.siradakiAraba(d), oy = U.oyuncular[i];
      marjGuncelle();
      const l = R.adaylar(d, i);
      const yasalVar = l.some(c => c.yasal);
      const ab = d.arabalar[i];
      D.halkaKoy(U.S, ab.x, ab.y, [U.yarisId, i, ab.hamle]);
      D.hizCizgileri(U.S, ab, ['hc', U.yarisId, i, ab.hamle]);
      let k = null;
      if (!yasalVar) {
        adaylariGoster(i, l, false);
        duyur(`${adGoster(i)}: yasal hamle yok, çarpıyor`);
        await KL.bekle(oy.tur === 'insan' ? 800 : 450);
        if (j !== U.jeton) return;
        if (oy.tur === 'insan' && geriSerbest()) U.gecmis.push(d);
      } else if (oy.tur === 'bilgisayar') {
        const t0 = Date.now();
        if (U.demo) { adaylariGoster(i, l, false); demoFren(i); } else { D.frenIziCiz(U.S, null, [], false); }
        let h = null;
        if (oy.zorluk !== 'kolay') { h = U.harita || await U.haritaSoz; if (j !== U.jeton) return; }
        k = A.sec(d, i, { zorluk: oy.zorluk, harita: h });
        const [a, b] = U.demo ? [650, 750] : C.ai.dusunmeMs;
        await KL.bekle(Math.max(0, a + Math.random() * (b - a) - (Date.now() - t0)));
        if (j !== U.jeton) return;
      } else {
        k = await insanSec(j, i, l);
        if (j !== U.jeton || k == null) return;
        if (geriSerbest()) U.gecmis.push(d);
      }
      D.adaylarSil(U.S);
      D.halkaSil(U.S);
      U.S.g.fren.textContent = '';
      hedefleriTemizle();
      await uygula(j, i, k);
      komutlariGuncelle();
    }
    if (j === U.jeton && U.durum.bitti) await bitis(j);
  }

  async function uygula(j, i, k) {
    const once = U.durum, d = R.hamleYap(once, i, k);
    U.durum = d;
    const renkI = renk(U.oyuncular[i].renk);
    for (const o of d.olaylar) {
      if (j !== U.jeton) return;
      if (o.tip === 'hamle') {
        const a0 = once.arabalar[i], a = d.arabalar[i], L = Math.hypot(a.x - a0.x, a.y - a0.y);
        const sure = Math.round(Math.max(150, Math.min(250, 120 + L * 22)));
        Ses.cal('keceli', 0, L);
        const s = D.izParca(U.S, renkI, a0.x, a0.y, a.x, a.y, ['iz', U.yarisId, i, a.iz.length - 1], { sureMs: [sure, sure] });
        await Promise.all([s.bitti, D.arabaTasi(U.S, i, a.x, a.y, arabaAcisi(a), s.sure)]);
        Ses.cal('nokta');
        if (U.hayalet && i === 0) hayaletGuncelle();
      } else if (o.tip === 'carpti' || o.tip === 'elendi') {
        const a = d.arabalar[o.i];
        Ses.cal('burusma');
        if (navigator.vibrate && U.oyuncular[o.i].tur === 'insan' && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(30); } catch (e) { /* yok */ }
        duyur(`${adGoster(o.i)} çarptı${o.tip === 'elendi' ? ' ve elendi' : ', bir tur bekleyecek'}`);
        if (U.demo) demoAciklama('carpti');
        marjGuncelle(o.i);
        D.arabaSars(U.S, o.i);
        await D.carpmaCiz(U.S, renkI, a.son.x1, a.son.y1, a.son.cx, a.son.cy);
        if (o.tip === 'elendi') { const e = U.S.arabalar.get(o.i); if (e) e.g.setAttribute('opacity', '.35'); }
        await KL.bekle(350);
      } else if (o.tip === 'bitirdi') {
        Ses.cal('bayrak');
        duyur(`${adGoster(o.i)} bitirdi`);
        if (U.oyuncular.length > 1) notYaz(`${U.oyuncular[o.i].ad} bitirdi!`);
      } else if (o.tip === 'bekledi') {
        marjGuncelle(o.i);
        if (!U.demo) notYaz(`${U.oyuncular[o.i].ad} bu tur bekliyor`, { kursun: true, sure: 1400 });
        await KL.bekle(U.demo ? 600 : 450);
      } else if (o.tip === 'tur') {
        notYaz(`${U.oyuncular[o.i].ad}: ${o.tur}. tur tamam`, { kursun: true, sure: 1600 });
      }
    }
  }

  /* ---------- insan hamlesi: adaylar, önizleme, klavye ---------- */

  function hedefleriTemizle() { $('#hedefler').textContent = ''; U.bekleyen = null; }

  function adaylariGoster(i, l, etkilesimli) {
    const a = U.durum.arabalar[i];
    D.adaylarCiz(U.S, l, a, ['aday', U.yarisId, i, a.hamle]);
    if (!etkilesimli) return;
    const kap = $('#hedefler');
    kap.textContent = '';
    l.forEach((c, k) => {
      if (!c.yasal) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hedef';
      b.dataset.k = k;
      b.style.left = `calc(var(--hucre) * ${c.x + 1})`;
      b.style.top = `calc(var(--hucre) * ${c.y + 1})`;
      b.setAttribute('aria-label', `${(c.x === a.x && c.y === a.y) ? 'yerinde dur' : hizYazi(c.vx, c.vy)}${c.ilerleme && c.ilerleme.bitti ? ', bitiş' : ''}`);
      b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { D.onizleme(U.S, a, c); D.adayVurgula(U.S, k, true); } });
      b.addEventListener('pointerleave', () => { D.onizleme(U.S, a, null); D.adayVurgula(U.S, k, false); });
      b.addEventListener('focus', () => { U.odak = k; D.onizleme(U.S, a, c); D.adayVurgula(U.S, k, true); });
      b.addEventListener('blur', () => { D.onizleme(U.S, a, null); D.adayVurgula(U.S, k, false); });
      b.addEventListener('click', () => { Ses.baslat(); if (U.bekleyen) U.bekleyen(k); });
      kap.appendChild(b);
    });
  }

  function insanSec(j, i, l) {
    return new Promise(coz => {
      U.bekleyen = (k) => { U.bekleyen = null; coz(k); };
      adaylariGoster(i, l, true);
      if (ayar.frenIzi) D.frenIziCiz(U.S, R.frenIzi(U.durum, i), ['fren', U.yarisId, i, U.durum.arabalar[i].hamle]);
      const a = U.durum.arabalar[i];
      if (U.l.dar) D.kucukOk(U.S, a, renk(U.oyuncular[i].renk), ['kok', U.yarisId, i, a.hamle]);
      duyur(`${adGoster(i)}: sıra sende. ${hizYazi(a.vx, a.vy)}`);
      kaydir(a.x + a.vx, a.y + a.vy);
      U.odak = 4;
    });
  }

  let kaydirGosterildi = false;
  function kaydirNotu() {
    const n = $('#kaydir-not'), kap = $('#pist-kap');
    if (!n || kaydirGosterildi || !U.l.dar) return;
    if (kap.scrollWidth <= kap.clientWidth + 4 && kap.scrollHeight <= kap.clientHeight + 4) return;
    kaydirGosterildi = true;
    n.style.top = (kap.offsetTop + 8) + 'px';
    n.style.right = (n.parentNode.offsetWidth - kap.offsetLeft - kap.offsetWidth + 10) + 'px';
    n.style.bottom = 'auto';
    n.hidden = false;
    setTimeout(() => { KL.soldur(n, 500).then(() => { n.hidden = true; n.style.opacity = ''; $('#sayfa').appendChild(n); }); }, 2600);
  }

  // Kaydırmalı düzende aday kümesini görünür alana getir.
  function kaydir(x, y, zorla) {
    if (!U.l || !U.l.dar) return;
    const kap = $('#pist-kap'), h = U.l.hucre;
    const px = (x + 1) * h, py = (y + 1) * h;
    const pay = h * 2.5;
    const sol = kap.scrollLeft, ust = kap.scrollTop, w = kap.clientWidth, hh = kap.clientHeight;
    if (!zorla && px - pay > sol && px + pay < sol + w && py - pay > ust && py + pay < ust + hh) return;
    const hedef = { left: Math.max(0, px - w / 2), top: Math.max(0, py - hh / 2) };
    const yumusak = KL.animasyonVar() && !document.hidden && !zorla;
    kap.scrollTo(Object.assign({ behavior: yumusak ? 'smooth' : 'auto' }, hedef));
    // yedek: yumuşak kaydırma bazı ortamlarda (arka planda boyanan sayfa) ilerlemiyor
    if (yumusak) setTimeout(() => {
      const enX = kap.scrollWidth - kap.clientWidth, enY = kap.scrollHeight - kap.clientHeight;
      if (Math.abs(kap.scrollLeft - Math.min(hedef.left, enX)) > 4 || Math.abs(kap.scrollTop - Math.min(hedef.top, enY)) > 4) kap.scrollTo(hedef);
    }, 650);
  }

  const RAKAM = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); geriAl(); return; }
    if (e.key === 'Escape') { if (U.demo) demoBitir(); else panelleriKapat(); return; }
    if (!U.bekleyen) return;
    if (e.key in RAKAM && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const b = $(`#hedefler .hedef[data-k="${RAKAM[e.key]}"]`);
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    const ok = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (ok) {
      e.preventDefault();
      let x = U.odak % 3 + ok[0], y = Math.floor(U.odak / 3) + ok[1];
      for (let n = 0; n < 3; n++) {
        if (x < 0 || x > 2 || y < 0 || y > 2) break;
        const b = $(`#hedefler .hedef[data-k="${y * 3 + x}"]`);
        if (b) { b.focus(); return; }
        x += ok[0]; y += ok[1];
      }
    }
  });

  /* ---------- geri alma ---------- */

  function geriAl() {
    if (!U.durum || !geriSerbest() || !U.gecmis.length) return;
    const j = ++U.jeton;
    U.durum = U.gecmis.pop();
    hedefleriTemizle();
    D.adaylarSil(U.S);
    for (const ad of ['fren', 'efekt', 'sonuc', 'ideal']) U.S.g[ad].textContent = '';
    D.halkaSil(U.S, true);
    arabalariYerlestir();
    notYaz('');
    komutlariGuncelle();
    duyur('son hamle geri alındı');
    akis(j);
  }

  /* ---------- bitiş ---------- */

  async function bitis(j) {
    hedefleriTemizle();
    marjGuncelle();
    komutlariGuncelle();
    const d = U.durum;
    const h = U.harita || await U.haritaSoz;
    if (j !== U.jeton) return;
    if (h) D.idealCiz(U.S, A.idealYol(h, U.pist));
    const oy = (i) => ({ renk: U.oyuncular[i].renk, no: i + 1, ad: U.oyuncular[i].ad });
    const sonuc = { basamaklar: [], satirlar: [] };
    if (U.mod === 'demo') {
      sonuc.basamaklar = d.siralama.map(e => oy(e.i));
      sonuc.satirlar = [{ yazi: 'Sıra sende: Yeni yarış', renk: 'kursun' }];
      demoAciklama('bitti');
    } else if (U.oyuncular.length === 1) {
      const a = d.arabalar[0], ideal = h && h.par < 255 ? h.par : '?';
      if (a.durum === 'bitirdi') {
        sonuc.basamaklar = [Object.assign(oy(0), { altYazi: `${a.hamle} hamle` })];
        sonuc.satirlar = [{ yazi: `ideal ${ideal}`, renk: 'kursun' }, { yazi: `sen ${a.hamle}`, renk: U.oyuncular[0].renk }];
        const eski = U.rekor;
        if (!eski || a.hamle < eski.hamle) {
          depo.yaz(rekorAnahtari(), { hamle: a.hamle, iz: a.iz });
          U.rekor = { hamle: a.hamle, iz: a.iz };
          if (eski) notYaz(`yeni rekor! (önceki ${eski.hamle})`);
          else if (a.hamle <= ideal) notYaz('ideal koşu!');
        } else notYaz(`en iyin ${eski.hamle} hamle`, { kursun: true });
        if (U.mod === 'gunun') { $('#paylas').hidden = false; sozcukleriCiz(true); }
      } else sonuc.satirlar = [{ yazi: 'elendin', renk: 'kirmizi' }, { yazi: `ideal ${ideal}`, renk: 'kursun' }];
      duyur(`Bitti: ${a.hamle} hamle, ideal ${ideal}`);
    } else {
      const ek = (e) => (e.durum === 'bitiremedi' ? 'bitiremedi' : e.durum === 'elendi' ? 'elendi' : `${d.arabalar[e.i].hamle} hamle`);
      sonuc.basamaklar = d.siralama.slice(0, 3).map(e => Object.assign(oy(e.i), { altYazi: ek(e) }));
      sonuc.satirlar = d.siralama.slice(3).map(e => ({ yazi: `${e.yer}. ${U.oyuncular[e.i].ad} · ${ek(e)}`, renk: U.oyuncular[e.i].renk }));
      if (U.seri) {
        d.siralama.forEach(e => { if (e.durum !== 'elendi') U.seri.puan[e.i] += R.seriPuani(e.yer); });
        if (U.seri.no < 2) { $('#devam').hidden = false; sozcukleriCiz(true); notYaz('sıradaki pist için: Sıradaki pist', { kursun: true }); }
        else {
          const sira = U.oyuncular.map((o, i) => i).sort((a, b) => U.seri.puan[b] - U.seri.puan[a]);
          sonuc.baslik = 'Seri bitti';
          sonuc.basamaklar = sira.slice(0, 3).map(i => Object.assign(oy(i), { altYazi: `${U.seri.puan[i]} puan` }));
          sonuc.satirlar = sira.slice(3).map((i, k) => ({ yazi: `${k + 4}. ${U.oyuncular[i].ad} · ${U.seri.puan[i]} puan`, renk: U.oyuncular[i].renk }));
        }
      }
      duyur('Yarış bitti. ' + d.siralama.map(e => `${e.yer}. ${U.oyuncular[e.i].ad}`).join(', '));
    }
    marjGuncelle();
    if (U.l.dar) {
      const kap = $('#pist-kap'), hh = U.l.hucre;
      const mx = U.pist.W / 2, my = U.pist.H / 2;
      sonuc.genMax = kap.clientWidth / hh * D.U - 10; sonuc.merkez = [mx, my];
      kap.scrollTo({ left: (mx + 1) * hh - kap.clientWidth / 2, top: (my + 1) * hh - kap.clientHeight / 2, behavior: 'auto' });
    }
    D.bayrakCiz(U.S, sonuc);
    Ses.cal('bayrak');
  }

  /* ---------- "nasıl oynanır" gösterisi ---------- */

  function demoAciklama(olay) {
    if (!U.demo) return;
    const m = {
      basla: 'Hız önceki turdan taşınır: araba bir önceki hamlesi kadar gider.',
      dokuz: 'Dokuz aday: hız her eksende en çok bir kare değişir.',
      fren: 'Fren izi: böyle yavaşlarsa burada durur.',
      gec: 'Kırmızı geç kaldı: fren izi duvarda bitiyor.',
      carpti: 'Geç fren: çarptı, bir tur bekler.',
      bitti: 'Sıra sende: Yeni yarış.',
    }[olay];
    if (!m || U.demo.aciklama.has(olay)) return;
    U.demo.aciklama.add(olay);
    notYaz(m);
  }

  function demoFren(i) {
    const f = R.frenIzi(U.durum, i);
    D.frenIziCiz(U.S, f, ['demo-fren', U.yarisId, i, U.durum.arabalar[i].hamle]);
    const tur = U.durum.turNo;
    if (tur === 2) demoAciklama('dokuz');
    if (tur >= 3 && f.noktalar.length > 2 && f.carpma < 0) demoAciklama('fren');
    if (f.carpma >= 0 && U.oyuncular[i].zorluk === 'gosteri') demoAciklama('gec');
  }

  function demoBitir() {
    if (!U.demo) return;
    U.demo = null;
    yeniYaris();
  }

  /* ---------- komutlar, paneller, ayarlar ---------- */

  function komutlariGuncelle() {
    const g = $('#geri');
    const ac = !!(U.durum && geriSerbest() && U.gecmis.length);
    if (g.disabled === ac) { g.disabled = !ac; }
    $('#fren').setAttribute('aria-pressed', String(!!ayar.frenIzi));
    $('#ses').setAttribute('aria-pressed', String(!Ses.sessiz));
    if (!U.durum || !U.durum.bitti) { $('#devam').hidden = true; $('#paylas').hidden = true; }
  }

  function sozcukleriCiz(anlik) {
    $$('.sozcuk').forEach((b, i) => {
      if (b.hidden || b.offsetParent === null) return;
      const ek = b.id === 'fren' && ayar.frenIzi ? { strokeWidth: 3.2 } : undefined;
      KL.dugmeAltiCiz(b, anlik ? 0 : 700 + i * 110, anlik, ek);
    });
  }

  function seciliCiz(kap) {
    $$('.ayar', kap).forEach(b => {
      const v = ayarDegeri(b.dataset.ayar);
      const secili = String(v) === b.dataset.deger;
      b.setAttribute('aria-pressed', String(secili));
      const eski = b.querySelector(':scope > svg.cerceve');
      if (eski) eski.remove();
      if (secili && b.offsetParent !== null) KL.dugmeAltiCiz(b, 0, true, { strokeWidth: 1.8 });
    });
  }

  const EVETHAYIR = ['seri', 'kesisme', 'yarisModu', 'kontrolGoster'];
  function ayarDegeri(k) {
    const v = ayar[k];
    return EVETHAYIR.includes(k) ? (v ? 'evet' : 'hayir') : v;
  }
  function ayarYaz(k, deger) {
    if (EVETHAYIR.includes(k)) ayar[k] = deger === 'evet';
    else if (['rakip', 'oyuncuSayisi', 'tur'].includes(k)) ayar[k] = Number(deger);
    else ayar[k] = deger;
    if (k === 'zorluk' && deger === 'kolay') ayar.frenIzi = true;
    kaydet();
  }

  function kurulumGorunur() {
    const kap = $('#kurulum');
    $$('[data-mod]', kap).forEach(e => { e.dataset.gizli = e.dataset.mod.split(' ').includes(ayar.mod) ? '0' : '1'; });
    $$('[data-gizle]', kap).forEach(e => { e.dataset.gizli = e.dataset.gizle === ayar.mod ? '1' : '0'; });
    oyuncuAdlari();
    seciliCiz(kap);
  }

  function oyuncuAdlari() {
    const kap = $('#oyuncu-adlari');
    kap.textContent = '';
    const n = Number(ayar.oyuncuSayisi) || 2;
    for (let k = 0; k < n; k++) {
      const s = document.createElement('div');
      s.className = 'oyuncu-satir';
      const r = ayar.renkler[k] || C.renkler[k];
      const rb = document.createElement('button');
      rb.type = 'button'; rb.className = 'renk-sec';
      const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      miniSvg.setAttribute('aria-hidden', 'true'); rb.appendChild(miniSvg);
      D.miniAraba(miniSvg, renk(r), k + 1, ['secim', k, r]);
      rb.setAttribute('aria-label', `${k + 1}. oyuncunun rengi: ${RENK_AD[r]}. Değiştirmek için dokun`);
      rb.addEventListener('click', () => {
        const kullanilan = new Set(ayar.renkler.slice(0, n).filter((_, m) => m !== k));
        const sira = C.renkler, bas = sira.indexOf(r);
        for (let t = 1; t <= sira.length; t++) {
          const yeni = sira[(bas + t) % sira.length];
          if (!kullanilan.has(yeni)) {
            const eskiVarsayilan = !ayar.adlar[k] || ayar.adlar[k] === RENK_AD[r];
            ayar.renkler[k] = yeni;
            if (eskiVarsayilan) ayar.adlar[k] = RENK_AD[yeni];
            break;
          }
        }
        kaydet(); oyuncuAdlari();
      });
      const inp = document.createElement('input');
      inp.type = 'text'; inp.maxLength = 14; inp.value = ayar.adlar[k] || RENK_AD[r];
      inp.setAttribute('aria-label', `${k + 1}. oyuncunun adı`);
      inp.style.color = renk(r);
      inp.addEventListener('input', () => { ayar.adlar[k] = inp.value; kaydet(); });
      s.append(rb, inp);
      kap.appendChild(s);
    }
  }

  function panelAc(id) {
    panelleriKapat();
    const p = $('#' + id);
    p.hidden = false;
    if (KL.animasyonVar()) {
      const dar = U.l && U.l.dar;
      p.animate([{ opacity: 0, transform: dar ? 'translateY(16px)' : 'translateY(-14px) rotate(-3deg)' }, { opacity: 1, transform: dar ? 'translateY(0)' : 'translateY(0) rotate(-.8deg)' }], { duration: 260, easing: 'ease-out' });
    }
    if (id === 'kurulum') kurulumGorunur();
    if (id === 'ayarlar') { $('#ayar-not').textContent = ''; seciliCiz(p); }
    $$('.sozcuk', p).forEach(b => KL.dugmeAltiCiz(b, 0, true));
    const ilk = $('button', p);
    if (ilk) ilk.focus({ preventScroll: true });
  }
  function panelleriKapat() { $$('.panel').forEach(p => { p.hidden = true; }); }

  function pistDugmeleri() {
    const kap = $('#pist-secim');
    PISTLER().forEach((t, i) => {
      if (i) { const a = document.createElement('span'); a.className = 'ara'; a.textContent = '·'; kap.appendChild(a); }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ayar'; b.dataset.ayar = 'pist'; b.dataset.deger = t.kimlik; b.textContent = t.ad;
      kap.appendChild(b);
    });
  }

  function olaylariBagla() {
    ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => Ses.baslat(), { passive: true }));
    $$('.sozcuk').forEach(b => b.addEventListener('click', () => { KL.dugmeAltiVurgu(b); Ses.cal('nokta'); }));
    $('#yeni').addEventListener('click', () => { if (U.demo) U.demo = null; panelAc('kurulum'); });
    $('#basla').addEventListener('click', () => { kaydet(); yeniYaris({ seriBasla: !!ayar.seri }); });
    $('#kurulum-kapat').addEventListener('click', panelleriKapat);
    $('#ayar-ac').addEventListener('click', () => panelAc('ayarlar'));
    $('#ayar-kapat').addEventListener('click', panelleriKapat);
    $('#nasil-ac').addEventListener('click', () => panelAc('nasil'));
    $('#nasil-kapat').addEventListener('click', panelleriKapat);
    $('#izle').addEventListener('click', () => yeniYaris({ demo: true }));
    $('#geri').addEventListener('click', geriAl);
    $('#devam').addEventListener('click', () => {
      if (!U.seri || U.seri.no >= 2) return;
      U.seri.no++;
      yeniYaris({ seriDevam: true });
    });
    $('#paylas').addEventListener('click', paylas);
    $('#fren').addEventListener('click', () => {
      ayar.frenIzi = !ayar.frenIzi; kaydet();
      komutlariGuncelle(); sozcukleriCiz(true);
      if (U.bekleyen && U.durum && !U.durum.bitti) {
        const i = R.siradakiAraba(U.durum);
        if (ayar.frenIzi) D.frenIziCiz(U.S, R.frenIzi(U.durum, i), ['fren', U.yarisId, i]); else U.S.g.fren.textContent = '';
      }
    });
    $('#ses').addEventListener('click', () => {
      Ses.baslat();
      Ses.sessizYap(!Ses.sessiz);
      komutlariGuncelle();
      if (!Ses.sessiz) Ses.cal('keceli', 0, 3);
    });
    $$('.panel').forEach(p => p.addEventListener('click', (e) => {
      const b = e.target.closest('.ayar');
      if (!b) return;
      ayarYaz(b.dataset.ayar, b.dataset.deger);
      Ses.cal('nokta');
      if (p.id === 'kurulum') kurulumGorunur();
      else {
        seciliCiz(p);
        if (b.dataset.ayar === 'kontrolGoster' && U.S) D.kontrolCiz(U.S, !!ayar.kontrolGoster);
        else $('#ayar-not').textContent = 'yeni yarışta geçerli olur';
      }
    }));
    $('#pist-kap').addEventListener('pointerdown', () => { if (U.demo) demoBitir(); });
    let bekleyen = 0;
    const boyut = () => {
      cancelAnimationFrame(bekleyen);
      bekleyen = requestAnimationFrame(() => {
        if (olcuHesapla()) { sozcukleriCiz(true); $$('.panel').forEach(p => { if (!p.hidden) seciliCiz(p); }); }
        if (U.durum && !U.durum.bitti) { const a = U.durum.arabalar[R.siradakiAraba(U.durum)]; kaydir(a.x + a.vx, a.y + a.vy, true); }
      });
    };
    window.addEventListener('resize', boyut);
    window.addEventListener('orientationchange', boyut);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', boyut);
  }

  async function paylas() {
    if (!U.rekor || !U.gunun) return;
    const metin = G.paylasimMetni(U.gunun.tarih, U.rekor.hamle, U.harita ? U.harita.par : '?');
    try {
      if (navigator.share) { await navigator.share({ title: 'Kağıt Rallisi', text: metin }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(metin); notYaz('panoya kopyalandı', { kursun: true, sure: 2000 }); return; } catch (e) { /* yedek */ }
    const t = document.createElement('textarea');
    t.value = metin; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); notYaz('panoya kopyalandı', { kursun: true, sure: 2000 }); } catch (e) { notYaz(metin, { kursun: true }); }
    t.remove();
  }

  /* ---------- başlangıç ---------- */

  async function basla() {
    if (typeof rough === 'undefined') { KL.kalemYok(); return; }
    Kit.malzeme.sec('kecelikalem', { cizim: C.cizim, renk: C.renk });
    olcuHesapla();
    await Promise.all([KL.fontBekle(), KL.fontBekle('Caveat Brush')]);
    $$('.sozcuk .yazi').forEach(y => KL.harfle(y, null, { tohum: ['sozcuk', y.textContent], anlik: true }));
    KL.harfle($('#baslik'), 'Kağıt Rallisi', { tohum: ['baslik'], anlik: true });
    pistDugmeleri();
    olaylariBagla();
    komutlariGuncelle();
    sozcukleriCiz(false);
    sahneSusle();
    await yeniYaris();
    if (ilkZiyaret) { kaydet(); panelAc('nasil'); }
    KR.ui = { U, ayar, yeniYaris, geriAl };                    // konsoldan denemek için
  }

  basla();
})();
