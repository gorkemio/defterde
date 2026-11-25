// ui/defterler.js — Defterler (albüm, ana ekran): kategori defterleri, her defterde kolaydan zora sıralı resimler; çözülenler
// renkli, çözülmeyenler soluk soru kareleri. Günün karalaması, Kilim Defteri, kendi resimlerin, İzle, Yazdır, istatistik.
(function () {
  'use strict';
  const KK = window.KK;
  const KL = Kit.kalem, BY = Kit.boyama;
  const $ = (id) => document.getElementById(id);
  const S = { defter: null };
  const el = (ad, sinif, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; };
  function dugme(yazi, f, sinif = '') {
    const b = el('button', 'dugme sozcuk ' + sinif); b.type = 'button';
    const y = el('span', 'yazi', yazi); b.appendChild(y);
    b.addEventListener('click', f);
    return b;
  }

  function ekranHazirla() {
    const O = KK.oyun;
    if (O.ekran === 'oyun' && O.kr) { O.kr.duraklat(); O.kaydet(); }
    O.ekran = 'album';
    KK.sayfa.notKapat();
    document.body.classList.remove('oyunda');
    const { vw, vh } = KL.alan(), y = KK.yerlesim.albumYerlesim({ vw, vh });
    KK.sayfa.sayfaBoyu(y);
    S.yer = y;
    $('oyun-ekrani').hidden = true;
    const a = $('album-ekrani');
    a.hidden = false; a.textContent = '';
    return a;
  }
  function bitir(a) {
    const s = $('sayfa');
    s.style.height = 'auto';
    s.style.minHeight = S.yer.Hsq * S.yer.sq + 'px';
    requestAnimationFrame(() => {
      a.querySelectorAll('.dugme').forEach((b, i) => KL.dugmeAltiCiz(b, Math.min(i, 12) * 30, false));
      const h = Math.ceil(a.scrollHeight / S.yer.sq) * S.yer.sq;
      s.style.height = Math.max(h, S.yer.Hsq * S.yer.sq) + 'px';
    });
    scrollTo(0, 0);
  }

  // ---------- küçük resim (canvas)
  function kucukResim(r, cozuldu, boyut) {
    const cv = el('canvas'), dpr = Math.min(2, devicePixelRatio || 1), N = Math.max(r.en, r.boy), k = Math.max(2, Math.floor(boyut / N));
    const w = r.en * k, h = r.boy * k, P = 4;
    cv.width = (Math.max(w, h) + 2 * P) * dpr; cv.height = (Math.max(w, h) + 2 * P) * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    const ox = P + (Math.max(w, h) - w) / 2, oy = P + (Math.max(w, h) - h) / 2;
    c.fillStyle = '#fbf9f2'; c.fillRect(ox - 2, oy - 2, w + 4, h + 4);
    if (cozuldu) {
      const rnd = KL.rastgele('kucuk', r.id);
      for (let i = 0; i < r.en * r.boy; i++) {
        const x = ox + (i % r.en) * k, y = oy + ((i / r.en) | 0) * k;
        if (r.renk[i]) { c.globalAlpha = .78 + rnd() * .2; c.fillStyle = r.renk[i]; c.fillRect(x, y, k + .3, k + .3); }
        else if (r.zemin[i]) { c.globalAlpha = .35; c.fillStyle = r.zemin[i]; c.fillRect(x, y, k + .3, k + .3); }
      }
      c.globalAlpha = 1;
    } else {
      c.fillStyle = 'rgba(86,140,214,.22)';
      for (let x = 0; x <= r.en; x += 5) c.fillRect(ox + x * k - .5, oy, 1, h);
      for (let y = 0; y <= r.boy; y += 5) c.fillRect(ox, oy + y * k - .5, w, 1);
      c.strokeStyle = 'rgba(74,74,74,.35)'; c.lineWidth = 1; c.strokeRect(ox, oy, w, h);
      Kit.rakamTuval.yaz(c, '?', ox + w / 2, oy + h / 2 + Math.min(w, h) * .2, { boyut: Math.min(w, h) * .42, hiza: 'orta', alfa: .35, tohum: ['soru', r.id] });
    }
    cv.setAttribute('aria-hidden', 'true');
    return cv;
  }

  // Defter kapağı (SVG, kalemle; kapak rengi kuru boyayla)
  function kapak(d, ozet) {
    const svg = KL.svgEl('svg', { viewBox: '0 0 120 150', 'aria-hidden': 'true' });
    const K = KL.kalemYap(svg), t = ['kapak', d.id];
    K.dikdortgen(svg, [6, 4, 108, 140], { stroke: '#4a4a4a', strokeWidth: 1.4, fill: BY.renk(d.kapak), fillStyle: 'hachure', hachureGap: 4.2, fillWeight: 3.4, hachureAngle: -40 }, t, { anlik: true, baski: false });
    K.dikdortgen(svg, [22, 30, 76, 34], { stroke: '#4a4a4a', strokeWidth: 1, fill: '#fbf9f2', fillStyle: 'solid' }, [...t, 'etiket'], { anlik: true, baski: false });
    KL.metinSvg(svg, d.ad.length > 10 ? d.ad.split(' ')[0] : d.ad, { x: 60, y: 53, boyut: d.ad.length > 8 ? 13 : 16, renk: '#4a4a4a', hiza: 'middle', anlik: true });
    // ilerleme: kalemle tikler (her çözülen için bir çentik, beşte bir çapraz)
    const n = Math.min(ozet.cozulen, 40);
    for (let i = 0; i < n; i++) {
      const grup = Math.floor(i / 5), j = i % 5, x0 = 18 + (grup % 4) * 22, y0 = 86 + Math.floor(grup / 4) * 22;
      if (j < 4) K.cizgi(svg, [x0 + j * 4, y0, x0 + j * 4 + .6, y0 + 14], { stroke: '#2b2b2b', strokeWidth: 1.2 }, [...t, 'tik', i], { anlik: true, baski: false });
      else K.cizgi(svg, [x0 - 2, y0 + 12, x0 + 15, y0 + 2], { stroke: '#2b2b2b', strokeWidth: 1.2 }, [...t, 'tik', i], { anlik: true, baski: false });
    }
    return svg;
  }

  // ---------- ana ekran
  function ac(defterId) {
    if (defterId) return defterAc(defterId);
    const a = ekranHazirla(), kat = KK.resimler.yukle(), album = KK.oyun.album;
    const ust = el('div', 'album-ust');
    ust.appendChild(el('h1', '', 'Defterler'));
    a.appendChild(ust);
    // günün karalaması
    const g = el('div', 'gunun'), bilgi = KK.gunluk.ozet();
    g.appendChild(dugme('Günün karalaması', () => KK.gunluk.ac()));
    g.appendChild(el('span', 'gunun-bilgi', bilgi));
    if (KK.gunluk.sonuc(Kit.bulmaca.gunluk.gunEkle(KK.gunluk.bugun(), -1))) g.appendChild(dugme('dünkü resmi paylaş', () => KK.gunluk.dunuPaylas()));
    a.appendChild(g);
    const kisa = el('div', 'album-kisa');
    kisa.appendChild(dugme('Kilim', () => kilimSecici()));
    kisa.appendChild(dugme('İzle', () => KK.izle.ogretici()));
    kisa.appendChild(dugme('Kendi resmini yap', () => KK.kendi.ac()));
    kisa.appendChild(dugme('Yazdır', () => KK.yazdir.secici()));
    kisa.appendChild(dugme('İstatistik', () => istatistik()));
    kisa.appendChild(dugme('Ayarlar', () => { KK.ayarlar.ciz(); KK.sayfa.notAc('ayarlar'); }));
    a.appendChild(kisa);
    const liste = el('div', 'defter-listesi');
    for (const d of kat.defterler) {
      const oz = album.ozet(d.id, d.resimler.length);
      const b = el('button', 'defter-karti'); b.type = 'button';
      b.setAttribute('aria-label', `${d.ad} defteri, ${oz.cozulen} / ${oz.toplam} çözüldü`);
      b.appendChild(kapak(d, oz));
      b.appendChild(el('span', 'ad2', d.ad));
      b.appendChild(el('span', 'ilerleme', `${oz.cozulen} / ${oz.toplam}`));
      b.addEventListener('click', () => defterAc(d.id));
      liste.appendChild(b);
    }
    // Kilim Defteri ve kendi resimlerin
    const kd = { id: 'kilim', ad: 'Kilim Defteri', kapak: 'kirmizi' }, kn = album.liste('kilim').length;
    const kb = el('button', 'defter-karti'); kb.type = 'button';
    kb.appendChild(kapak(kd, { cozulen: kn })); kb.appendChild(el('span', 'ad2', 'Kilim Defteri')); kb.appendChild(el('span', 'ilerleme', `${kn} kilim`));
    kb.addEventListener('click', () => kilimDefteri());
    liste.appendChild(kb);
    const kendiler = album.liste('kendi');
    if (kendiler.length) {
      const ke = el('button', 'defter-karti'); ke.type = 'button';
      ke.appendChild(kapak({ id: 'kendi', ad: 'Kendi resimler', kapak: 'pembe' }, { cozulen: kendiler.length })); ke.appendChild(el('span', 'ad2', 'Kendi resimler')); ke.appendChild(el('span', 'ilerleme', `${kendiler.length}`));
      ke.addEventListener('click', () => kendiDefteri());
      liste.appendChild(ke);
    }
    a.appendChild(liste);
    bitir(a);
    KK.sayfa.duyur('Defterler.');
  }

  function geriBaslik(a, baslik, sag) {
    const ust = el('div', 'album-ust');
    ust.appendChild(dugme('Defterler', () => ac(), 'geri'));
    ust.appendChild(el('h1', '', baslik));
    if (sag) ust.appendChild(el('span', 'gunun-bilgi', sag));
    a.appendChild(ust);
  }

  function defterAc(id) {
    const a = ekranHazirla(), kat = KK.resimler.yukle(), d = kat.defterler.find(x => x.id === id), album = KK.oyun.album;
    if (!d) return ac();
    S.defter = id;
    const oz = album.ozet(id, d.resimler.length);
    geriBaslik(a, d.ad, `${oz.cozulen} / ${oz.toplam} çözüldü`);
    const liste = el('div', 'resim-listesi'), boyut = S.yer.sq * 3.6, cocuk = KK.oyun.ayar.cocuk;
    if (cocuk) a.appendChild(el('p', 'gunun-bilgi', 'Çocuk modu: yalnız 5×5 ve 10×10 resimler.'));
    d.resimler.forEach((r, k) => {
      if (cocuk && Math.max(r.en, r.boy) > 10) return;
      const coz = album.cozulduMu(r.id), yarim = !coz && KK.oyun.yarimMi(r.id);
      const b = el('button', 'resim-karti'); b.type = 'button';
      b.appendChild(kucukResim(r, coz, boyut));
      const et = el('span', 'etiket');
      if (coz) { const ad = el('b', '', r.ad); et.appendChild(ad); }
      else et.textContent = `${k + 1}. ${r.en}×${r.boy} · ${r.bant}${yarim ? ' · yarım' : ''}`;
      b.appendChild(et);
      b.setAttribute('aria-label', coz ? `${r.ad}, çözüldü, ${r.en}'e ${r.boy}` : `${k + 1}. resim, ${r.en}'e ${r.boy}, ${r.bant}${yarim ? ', yarım' : ''}`);
      b.addEventListener('click', () => KK.oyun.ac(r, { temiz: coz }));
      liste.appendChild(b);
    });
    a.appendChild(liste);
    const alt = el('div', 'album-kisa');
    alt.appendChild(dugme('Bu sayfayı bas', () => { document.body.classList.add('album-bas'); print(); setTimeout(() => document.body.classList.remove('album-bas'), 500); }));
    a.appendChild(alt);
    bitir(a);
    KK.sayfa.duyur(`${d.ad} defteri.`);
  }

  // Yeni bulmaca: aynı defterde sıradaki çözülmemiş resim (yoksa sonraki defter)
  function yeniBulmaca() {
    const kat = KK.resimler.yukle(), album = KK.oyun.album, O = KK.oyun;
    if (O.resim && O.resim.tur === 'kilim' && O.ekran === 'oyun') return kilimAc(O.resim.en, O.resim.hedefBant);
    const bas = O.resim && O.resim.tur === 'resim' ? O.resim.defter : S.defter || kat.defterler[0].id;
    const sira = kat.defterler.map(d => d.id), i0 = Math.max(0, sira.indexOf(bas));
    for (let k = 0; k < sira.length; k++) {
      const d = kat.defterler[(i0 + k) % sira.length];
      const sonra = d.resimler.filter(r => !album.cozulduMu(r.id) && (!O.resim || r.id !== O.resim.id) && (!O.ayar.cocuk || Math.max(r.en, r.boy) <= 10));
      if (sonra.length) { S.defter = d.id; return KK.oyun.ac(sonra[0]); }
    }
    KK.sayfa.genelNot('<p>Bütün defterler bitti. Kilim Defteri sonsuz.</p>', [{ yazi: 'kilim', f: () => kilimAc(15) }, { yazi: 'kapat', f: KK.sayfa.notKapat }]);
  }

  // ---------- kilim
  function kilimSecici() {
    const k = el('div');
    k.appendChild(el('h2', '', 'Kilim'));
    k.appendChild(el('p', '', 'Boyu ve zorluğu seç; desen her seferinde yeniden dokunur.'));
    let boy = 15, bant = 'orta';
    const satir = (ad, secenek, al, ver) => {
      const p = el('p', 'ayar-grup'); p.appendChild(el('span', 'ayar-ad', ad + ':'));
      secenek.forEach((s, i) => {
        if (i) p.appendChild(el('span', 'ara', '·'));
        const b = el('button', 'ayar'); b.type = 'button'; b.appendChild(el('span', 'yazi', String(s[1])));
        b.setAttribute('aria-pressed', al() === s[0] ? 'true' : 'false');
        b.addEventListener('click', () => { ver(s[0]); p.querySelectorAll('.ayar').forEach(x => { x.setAttribute('aria-pressed', 'false'); const c = x.querySelector('svg.cerceve'); if (c) c.remove(); }); b.setAttribute('aria-pressed', 'true'); KL.dugmeAltiCiz(b, 0, false); });
        p.appendChild(b);
      });
      return p;
    };
    k.appendChild(satir('boy', KK.config.kilimBoylari.map(n => [n, `${n}×${n}`]), () => boy, v => { boy = v; }));
    k.appendChild(satir('zorluk', ['kolay', 'orta', 'zor'].map(x => [x, x]), () => bant, v => { bant = v; }));
    k.appendChild(el('p', 'yeni-not', '11×11 desenler en çok orta; zor desenler 15×15 ve üstünde dokunur.'));
    KK.sayfa.genelNot(k, [{ yazi: 'dokun', f: () => kilimAc(boy, bant) }, { yazi: 'vazgeç', f: KK.sayfa.notKapat }]);
    requestAnimationFrame(() => document.querySelectorAll('#genel-not .ayar[aria-pressed="true"]').forEach(b => KL.dugmeAltiCiz(b, 0, true)));
  }
  function kilimAc(boy = 15, bant = 'orta', tohum) {
    const t = tohum ?? Math.floor(Math.random() * 1e9);
    KK.sayfa.genelNot(`<p>Kilim dokunuyor… (${boy}×${boy}, ${bant})</p>`, []);
    setTimeout(() => {
      const sonuc = KK.kilim.resim(t, { boy, hedefBant: bant });
      sonuc.hedefBant = bant;
      KK.sayfa.notKapat();
      KK.oyun.ac(sonuc, { temiz: !tohum });
    }, 40);
  }
  function kilimDefteri() {
    const a = ekranHazirla(), liste = KK.oyun.album.liste('kilim').sort((x, y) => (y.ilk || '').localeCompare(x.ilk || ''));
    geriBaslik(a, 'Kilim Defteri', `${liste.length} kilim`);
    const kisa = el('div', 'album-kisa');
    kisa.appendChild(dugme('Yeni kilim', () => kilimSecici()));
    a.appendChild(kisa);
    const izgara = el('div', 'resim-listesi'), boyut = S.yer.sq * 3.6;
    for (const k of liste) {
      const r = KK.kilim.resim(k.tohum, { boy: k.boyN });
      const b = el('button', 'resim-karti'); b.type = 'button';
      b.appendChild(kucukResim(r, true, boyut));
      b.appendChild(el('span', 'etiket', r.ad));
      b.addEventListener('click', () => KK.oyun.ac(r, { temiz: true }));
      izgara.appendChild(b);
    }
    if (!liste.length) a.appendChild(el('p', 'gunun-bilgi', 'Çözdüğün kilimler burada birikir.'));
    a.appendChild(izgara);
    bitir(a);
  }
  function kendiDefteri() {
    const a = ekranHazirla(), liste = KK.oyun.album.liste('kendi');
    geriBaslik(a, 'Kendi resimler', `${liste.length}`);
    const izgara = el('div', 'resim-listesi'), boyut = S.yer.sq * 3.6;
    for (const k of liste) {
      let r; try { r = KK.kendi.resimden(k.kod, k.ad, k.cizen); } catch (e) { continue; }
      const b = el('button', 'resim-karti'); b.type = 'button';
      b.appendChild(kucukResim(r, true, boyut));
      b.appendChild(el('span', 'etiket', r.ad + (r.cizen ? ' · ' + r.cizen : '')));
      b.addEventListener('click', () => KK.oyun.ac(r, { temiz: true }));
      izgara.appendChild(b);
    }
    a.appendChild(izgara);
    bitir(a);
  }

  function istatistik() {
    const O = KK.oyun, st = O.album.istatistik(), G = Kit.bulmaca.gunluk, gun = KK.gunluk.istatistik();
    const d = el('div');
    d.appendChild(el('h2', '', 'İstatistik'));
    const ul = el('p', 'istatistik');
    const satirlar = [
      `çözülen resim: ${st.cozulen}`, `oynanan: ${st.oynanan}`, `hatasız: ${st.hatasiz}`,
      `ortalama süre: ${st.ortSure ? G.sureYazi(st.ortSure) : '-'}`,
      `günün karalaması: ${gun.cozulen}`, `seri: ${gun.seri}`, `en uzun seri: ${gun.enUzun}`,
    ];
    satirlar.forEach(s => { ul.appendChild(document.createTextNode(s)); ul.appendChild(el('br')); });
    d.appendChild(ul);
    KK.sayfa.genelNot(d);
  }

  KK.defterler = Object.assign(S, { ac, defterAc, yeniBulmaca, kilimAc, kilimSecici, kilimDefteri, kucukResim });
})();
