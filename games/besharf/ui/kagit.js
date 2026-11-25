// ui/kagit.js — daktilo kâğıdının içeriği (tek svg): başlık, No./tarih, 6×5 ızgara, basılan harfler, düzeltici lekeleri,
// kopya kalemi işaretleri, marj notları, alt satır (anlam ya da kırmızı şeritle cevap).
// Katmanlar: cizgi (kutular, başlık altı) < yazi (harfler ve lekeler, oluş sırasıyla) < isaret < not.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const D = () => Kit.daktilo, KK = () => Kit.kopyakalemi, DK = () => Kit.daktilokagidi;

  let kap = null, svg = null, zemin = null, K = null, k = {}, olcu = null;
  let harfler = [], lekeler = [], notlar = [];      // [satir][sutun]

  function bosalt() {
    harfler = Array.from({ length: 6 }, () => Array(5).fill(null));
    lekeler = Array.from({ length: 6 }, () => []);
    notlar = Array(6).fill(null);
  }

  // Kutunun sol üst köşesi ve harf tabanı
  function kutu(satir, sutun) {
    const s = olcu.s, g = olcu.g;
    const x = olcu.izgaraX + sutun * (s + g), y = olcu.izgaraY + satir * (s + g);
    return { x, y, s, cx: x + s / 2, cy: y + s / 2, taban: D().ortaTaban(y + s / 2, olcu.harfBoy) };
  }

  // el: section.daktilo-kagit · o: { baslik: 'BEŞ HARF', alt: 'No. 1 · 20 Ekim 2026', tohum, anlik }
  function kur(el, o) {
    kap = el;
    k = Object.assign({ tohum: 1, baslik: 'BEŞ HARF', ek: 0 }, o);
    if (!k.alt && k.no) k.alt = `No. ${k.no} · ${k.tarih}`;
    el.style.height = '';
    olcu = BH.sahne.olcu;
    el.querySelectorAll(':scope > svg, :scope > .kagit-komut').forEach(e => e.remove());
    zemin = DK().kur(el, { tohum: ['kagit', k.tohum] });
    svg = Kit.kalem.svgEl('svg', { class: 'kagit-svg', 'aria-hidden': 'true' });
    el.appendChild(svg);
    bosalt();
    boyutla(o);
  }

  // Ölçü değişince (ya da ilk kurulumda) çizgileri baştan çizer; yazı ve işaretleri oyun yeniden basar.
  function boyutla(o = {}) {
    olcu = BH.sahne.olcu;
    const w = olcu.kagitW, h = olcu.kagitH + (k.ek || 0);
    kap.style.height = k.ek ? h + 'px' : '';
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.textContent = '';
    zemin.yenile();
    K = Kit.kalem.kalemYap(svg);
    k.katman = {};
    for (const ad of ['cizgi', 'yazi', 'isaret', 'not']) k.katman[ad] = Kit.kalem.svgEl('g', { class: 'katman-' + ad }, svg);
    bosalt();
    baslik(o);
    izgara(o);
  }

  function baslik(o) {
    const w = olcu.kagitW;
    const y1 = 10 + olcu.baslikBoy * .78;
    const t = D().yaz(k.katman.yazi, k.baslik, { x: w / 2, y: y1, boyut: olcu.baslikBoy, hiza: 'orta', adim: .74,
      tohum: ['baslik', k.baslik], anlik: o.anlik, gecikme: 120 });
    const y2 = y1 + 9 + olcu.noBoy;
    const satir = k.alt || '';
    D().yaz(k.katman.yazi, satir, { x: w / 2, y: y2, boyut: olcu.noBoy, hiza: 'orta', tohum: ['no', satir],
      anlik: o.anlik, gecikme: 120 + t.sure + 120, aralikMs: 35 });
    const yari = t.genislik / 2;
    Kit.kalem.altiCiz(K, k.katman.cizgi, w / 2 - yari + 2, w / 2 + yari - 2, y1 + 5, {
      tohum: ['baslik-alti'], anlik: o.anlik, gecikme: 120 + t.sure + 80, ek: { strokeWidth: 1.4, stroke: KK().RENK.grafit },
    });
  }

  function izgara(o) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
      const b = kutu(r, c);
      Kit.kalem.kutu(K, k.katman.cizgi, b.x, b.y, b.s, b.s, {
        tohum: ['kutu', r, c], tasma: Math.max(2, b.s * .07), anlik: o.anlik, gecikme: 300 + r * 70 + c * 25,
        cizgi: { strokeWidth: 1.15, stroke: KK().RENK.grafit },
      });
    }
  }

  /* ---------- yazma, silme ---------- */

  // deneme: aynı kutuya kaçıncı kez basıldığı (her vuruş biraz farklı yoğunluk ve kayma)
  function harfBas(satir, sutun, harf, o = {}) {
    const b = kutu(satir, sutun);
    const h = D().harf(k.katman.yazi, harf, { x: b.cx, y: b.taban, boyut: olcu.harfBoy, serit: o.serit,
      tohum: ['izgara', satir, sutun, harf, o.deneme || 0], anlik: o.anlik, gecikme: o.gecikme });
    h.node.dataset.satir = satir;
    h.node.dataset.sutun = sutun;
    harfler[satir][sutun] = h.node;
    return h;
  }

  // Düzeltici: leke harfin üstüne düşer, harf altında kalır (sonra DOM'dan kalkar)
  function harfSil(satir, sutun, o = {}) {
    const b = kutu(satir, sutun);
    const eski = harfler[satir][sutun];
    const l = DK().duzeltici(k.katman.yazi, { x: b.x + 2, y: b.y + 2, w: b.s - 4, h: b.s - 4,
      tohum: ['leke', satir, sutun, o.deneme || 0], anlik: o.anlik });
    lekeler[satir].push(l.node);
    harfler[satir][sutun] = null;
    if (eski) l.bitti.then(() => eski.remove());
    return l;
  }

  // Satır gönderilince lekeler solar
  function lekeSoldur(satir, ms = 300) {
    const l = lekeler[satir];
    lekeler[satir] = [];
    return Promise.all(l.map(n => DK().sol(n, ms)));
  }

  /* ---------- işaretler ---------- */

  // sonuc: [0|1|2 × 5] (0 yok, 1 yanlış yer, 2 doğru yer). Soldan sağa, aralikMs arayla; her işaretin kendi sesi.
  function isaretle(satir, sonuc, o = {}) {
    const hareket = !o.anlik && Kit.kalem.animasyonVar();
    const ara = hareket ? (o.aralikMs ?? BH.config.isaretGecikmeMs) : 0;
    const bit = [];
    sonuc.forEach((d, sutun) => {
      const b = kutu(satir, sutun), an = ['isaret', satir, sutun];
      const gecikme = (o.gecikme || 0) + sutun * ara;
      let s;
      if (d === 2) {
        s = KK().tara(K, k.katman.isaret, { x: b.x, y: b.y, w: b.s, h: b.s }, { oyuk: harfler[satir][sutun], bosluk: 2, tohum: an, anlik: o.anlik, gecikme });
      } else if (d === 1) {
        s = KK().cember(K, k.katman.isaret, { cx: b.cx, cy: b.cy, r: b.s * .37 }, { tohum: an, anlik: o.anlik, gecikme });
      } else {
        const r = Kit.kalem.rastgele('ciz', ...an), e = Kit.kalem.aralik(r, .08, .16) * (r() < .5 ? 1 : -1);
        s = KK().ustunuCiz(K, k.katman.isaret, { x1: b.x + b.s * .14, y1: b.cy + b.s * e, x2: b.x + b.s * .86, y2: b.cy - b.s * e },
          { tohum: an, anlik: o.anlik, gecikme });
      }
      if (o.ses && !o.anlik && Kit.ses) Kit.ses.cal(d === 2 ? 'tarama' : d === 1 ? 'cember' : 'cizik', gecikme);
      bit.push(s.bitti);
    });
    return { bitti: Promise.all(bit), sure: hareket ? 4 * ara + 340 : 0 };
  }

  /* ---------- geçersiz kelime: dalgalı çizgi + marj notu ---------- */

  function gecersiz(satir, metin = 'listede yok', o = {}) {
    gecersizSil(satir, { anlik: true });
    const b0 = kutu(satir, 0), b4 = kutu(satir, 4);
    const g = Kit.kalem.svgEl('g', { class: 'gecersiz' }, k.katman.not);
    KK().dalga(K, g, { x1: b0.x + b0.s * .18, x2: b4.x + b4.s * .82, y: b0.taban + Math.max(4, olcu.s * .11) },
      { tohum: ['dalga', satir, metin], anlik: o.anlik });
    const boy = Math.max(9, Math.round(olcu.s * .23));
    const x = b4.x + b4.s + Math.max(6, olcu.g + 3);
    const satirlar = metin.split(' ');
    const y0 = b4.cy - (satirlar.length - 1) * boy * .55 + boy * .3;
    satirlar.forEach((parca, i) => D().yaz(g, parca, { x, y: y0 + i * boy * 1.1, boyut: boy, tohum: ['not', satir, i, parca],
      anlik: o.anlik, gecikme: 120 + i * 160, aralikMs: 28 }));
    notlar[satir] = g;
    return g;
  }

  function gecersizSil(satir, o = {}) {
    const g = notlar[satir];
    notlar[satir] = null;
    if (g) return o.anlik ? (g.remove(), Promise.resolve()) : Kit.kalem.soldur(g, 220);
    return Promise.resolve();
  }

  /* ---------- alt satır: kırmızı şeritle cevap ya da anlam ---------- */

  function altSatir(metin, o = {}) {
    const old = k.katman.not.querySelector('.alt-satir');
    if (old) old.remove();
    const g = Kit.kalem.svgEl('g', { class: 'alt-satir' }, k.katman.not);
    const y = olcu.izgaraY + olcu.izgaraH + olcu.notH * .78;
    return D().yaz(g, metin, { x: olcu.kagitW / 2, y, boyut: o.boyut || Math.round(olcu.s * .42), hiza: 'orta', serit: o.serit,
      tohum: ['alt', metin], anlik: o.anlik, gecikme: o.gecikme, aralikMs: 70, ses: o.ses });
  }

  /* ---------- oyun sonu: kâğıt makineden çekilir, altına anlam basılır ---------- */

  // Kâğıt ek px aşağı uzar (makinenin içinde kalan kısım görünür). Animasyonda her karede zemin yeniden çizilir.
  function uzat(ek, o = {}) {
    const mevcutSvg = svg;
    const h0 = olcu.kagitH + (k.ek || 0), h1 = olcu.kagitH + ek;
    k.ek = ek;
    const ayarla = (h) => {
      kap.style.height = h + 'px';
      svg.setAttribute('viewBox', `0 0 ${olcu.kagitW} ${h}`);
      svg.setAttribute('height', h);
      zemin.yenile();
    };
    if (o.anlik || !Kit.kalem.animasyonVar() || h1 <= h0) { ayarla(h1); return Promise.resolve(); }
    return new Promise((coz) => {
      const t0 = performance.now(), sure = o.sure || 520;
      const adim = (t) => {
        if (svg !== mevcutSvg) { coz(); return; } // Mod veya ölçü değişince eski uzamayı bırak.
        const f = Math.min(1, (t - t0) / sure);
        const e = 1 - Math.pow(1 - f, 2.2);
        ayarla(Math.round(h0 + (h1 - h0) * e));
        if (f < 1) requestAnimationFrame(adim); else coz();
      };
      requestAnimationFrame(adim);
    });
  }

  // Uzantıdaki y konumu (ızgaranın altındaki satırdan sonra)
  const uzantiY = () => olcu.izgaraY + olcu.izgaraH + olcu.notH + 6;

  // Metni kâğıt genişliğine göre sözcük sınırından satırlara böler ve basar. Döner { bitti, sure, sonY }
  function paragraf(metin, o = {}) {
    const boy = o.boyut || Math.max(11, Math.round(olcu.s * .3));
    const yan = o.yan ?? Math.max(16, olcu.izgaraX - 4);
    const enCok = Math.max(12, Math.floor((olcu.kagitW - 2 * yan) / (boy * Kit.daktilo.ADIM)));
    const satirlar = [];
    let s = '';
    for (const soz of String(metin).split(/\s+/)) {
      if (!soz) continue;
      if (s && Array.from(s + ' ' + soz).length > enCok) { satirlar.push(s); s = soz; } else s = s ? s + ' ' + soz : soz;
    }
    if (s) satirlar.push(s);
    const g = Kit.kalem.svgEl('g', { class: 'paragraf' + (o.sinif ? ' ' + o.sinif : '') }, k.katman.not);
    if (o.opaklik) g.setAttribute('opacity', o.opaklik);
    let y = o.y ?? uzantiY() + boy, gec = o.gecikme || 0;
    const bit = [];
    satirlar.forEach((satir, i) => {
      const x = o.hiza === 'orta' ? olcu.kagitW / 2 : yan;
      const r = D().yaz(g, satir, { x, y, boyut: boy, hiza: o.hiza || 'sol', serit: o.serit, tohum: ['p', metin, i],
        anlik: o.anlik, gecikme: gec, aralikMs: o.aralikMs ?? 24, ses: o.ses });
      bit.push(r.bitti);
      gec += r.sure + (o.anlik ? 0 : 140);
      y += boy * 1.45;
    });
    return { node: g, bitti: Promise.all(bit), sure: gec - (o.gecikme || 0), sonY: y - boy * 1.45 };
  }

  // Tek satır (geri sayım gibi her saniye değişen): eski düğümü siler, anlık basar
  function tekSatir(ad, metin, o = {}) {
    const eski = k.katman.not.querySelector(`[data-satir="${ad}"]`);
    if (eski) eski.remove();
    const p = paragraf(metin, Object.assign({ anlik: true }, o));
    p.node.dataset.satir = ad;
    return p;
  }

  // Oyun sonu komutları: kâğıdın dibine daktiloyla basılmış, altı kopya kalemiyle çizili sözcükler. liste: [[metin, fn, id]]
  function komutlar(liste, o = {}) {
    const eski = kap.querySelector(':scope > .kagit-komut');
    if (eski) eski.remove();
    if (!liste || !liste.length) return null;
    const p = document.createElement('p');
    p.className = 'kagit-komut';
    kap.appendChild(p);
    const dugmeler = liste.map(([metin, fn, id]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dugme sozcuk';
      if (id) b.id = id;
      const s = document.createElement('span');
      s.className = 'yazi';
      b.appendChild(s);
      p.appendChild(b);
      Kit.daktilo.metin(s, metin, { anlik: true, tohum: ['komut', id || metin] });
      b.addEventListener('click', () => { Kit.kalem.dugmeAltiVurgu(b); fn(); });
      return b;
    });
    requestAnimationFrame(() => dugmeler.forEach((b, i) => Kit.kalem.dugmeAltiCiz(b, o.anlik ? 0 : 200 + i * 120, !!o.anlik)));
    return p;
  }

  BH.kagit = { kur, boyutla, komutlar, kutu, harfBas, harfSil, lekeSoldur, isaretle, gecersiz, gecersizSil, altSatir, uzat, paragraf, tekSatir,
    uzantiY: () => uzantiY(), get svg() { return svg; }, get ek() { return k.ek || 0; } };
})();
