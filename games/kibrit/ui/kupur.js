// ui/kupur.js — defterde alıştırma kutusu: kalemle çizilmiş çerçeve, kurşun kalem başlık ("Bulmaca 1284"), kategori ve
// zorluk, el yazısı talimat, eşitlik sahnesi (yuvalar + kâğıtta duran gerçek çöpler), kalemle çizilmiş "Rakamlar böyle
// yazılır", kırmızı kalem işareti ("Çözüldü!"). Sahne: çöp nesneleri, fırıldak baş düzeni, yerleştirme, canlandırma, ipucu.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const Mo = KB.model, C = KB.config;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (ad, oz, eb) => { const e = document.createElementNS(NS, ad); for (const k in oz) e.setAttribute(k, oz[k]); if (eb) eb.appendChild(e); return e; };
  const hEl = (ad, sinif, eb, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin !== undefined) e.textContent = metin; if (eb) eb.appendChild(e); return e; };

  const TALIMAT = {
    tek: 'Bir çöpün yerini değiştirerek eşitliği doğru yapın.',
    iki: 'İki çöpün yerini değiştirerek eşitliği doğru yapın.',
    ekle: 'Kutudan bir çöp ekleyerek eşitliği doğru yapın.',
    cikar: 'Bir çöpü kutuya kaldırarak eşitliği doğru yapın.',
    hepsini: 'Bir çöpün yerini değiştirerek doğru eşitliklerin hepsini bulun.',
    romen: 'Bir çöpün yerini değiştirerek Romen rakamlarıyla yazılmış eşitliği doğru yapın.',
    boz: 'Tek bir çöpün yerini değiştirerek bu doğru eşitliği bozun.',
  };
  const HUCRE_AD = (s, h) => {
    const x = s.hucreler[h];
    if (x.tur === 'I') return `${x.islem + 1}. işaret`;
    const sy = s.sayilar[x.sayi];
    return sy.basamak > 1 ? `${x.sayi + 1}. sayının ${x.sira + 1}. hanesi` : `${x.sayi + 1}. sayı`;
  };
  const YUVA_AD = { R: ['üst', 'sağ üst', 'sağ alt', 'alt', 'sol alt', 'sol üst', 'orta'], I: ['üst yatay', 'orta yatay', 'alt yatay', 'dikey', 'eğik', 'ters eğik'], M: ['orta dikey', 'V sol', 'V sağ', 'X birinci', 'X ikinci', 'L dikey', 'L taban'] };
  const yuvaAdi = (s, y) => `${HUCRE_AD(s, y >> 3)}, ${YUVA_AD[s.hucreler[y >> 3].tur][y & 7]}`;
  // Fırıldak baş düzeni: rakamda baş saat yönünde (a sağda, b ve c aşağıda, d solda, e ve f yukarıda, g solda); böylece
  // köşelerin çoğunda tek baş olur, başlar kümelenip rakamı bulandırmaz. İşlemde yatay sağa, dikey ve çaprazlar yukarı;
  // romende baş üstte (L'nin tabanı sağda).
  const BAS = { R: [1, 1, 1, -1, -1, -1, -1], I: [1, 1, 1, -1, 1, -1], M: [-1, -1, -1, -1, -1, -1, 1] };

  /* ---------- sahne: yuvalar ve çöpler ---------- */
  class Sahne {
    // o: { durum, L, tohum, kilavuz, kucuk }
    constructor(svg, o) {
      this.svg = svg; this.o = o;
      this.sablon = o.durum.sablon; this.L = o.L; this.tohum = o.tohum || ['sahne'];
      this.copL = o.L * C.copOrani;
      const lay = Mo.yerlesim(this.sablon.id, this.L);
      this.lay = lay;
      const P = this.L * KB.sahne.SAHNE_PAY / 2;
      const vw = lay.genislik + 2 * P, vh = lay.yukseklik + 1.4 * P;
      svg.setAttribute('viewBox', `${(-P).toFixed(1)} ${(-P * .7).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
      // gerçek boy: çöp L px; kutu daralırsa (max-width) orantılı küçülür
      svg.setAttribute('width', vw.toFixed(1)); svg.setAttribute('height', vh.toFixed(1));
      svg.innerHTML = '';
      this.gYuva = svgEl('g', { class: 'yuvalar' }, svg);
      this.gIpucu = svgEl('g', { class: 'ipucu-iz' }, svg);
      this.gCop = svgEl('g', { class: 'coplar' }, svg);
      this.gUst = svgEl('g', { class: 'ust' }, svg);
      this.yuvalar = new Map();
      for (const y of lay.yuvalar) {
        const node = Kit.kibrit.yuva(svg, { x: y.x, y: y.y, aci: y.aci, uzunluk: this.L, ebeveyn: this.gYuva });
        node.dataset.yuva = y.yuva;
        this.yuvalar.set(y.yuva, Object.assign({ node }, y));
      }
      this.coplar = new Map(); this.yuvaCop = new Map(); this.sayac = 0;
      this.kilavuzAcik = !!o.kilavuz;
      this.kur(o.durum);
    }
    basYon(yuva) { return BAS[this.sablon.hucreler[yuva >> 3].tur][yuva & 7]; }
    copYap(id) {
      const c = Kit.kibrit.cop(this.svg, { uzunluk: this.copL, tohum: [...this.tohum, 'cop', id], ebeveyn: this.gCop, basit: this.o.kucuk });
      c.node.dataset.cop = id;
      const x = { id, node: c.node, yuva: null };
      this.coplar.set(id, x);
      return x;
    }
    kur(durum) {
      this.gCop.innerHTML = ''; this.gUst.innerHTML = '';
      this.coplar.clear(); this.yuvaCop.clear();
      const s = this.sablon;
      for (let h = 0; h < s.hucreSayisi; h++) {
        for (let bit = 0; bit < Mo.BITS[s.hucreler[h].tur]; bit++) {
          if (durum.bayt[h] & (1 << bit)) {
            const id = 'c' + (this.sayac++);
            const c = this.copYap(id);
            this.yerlestir(c.id, h * 8 + bit);
          }
        }
      }
      this.kilavuz(this.kilavuzAcik);
    }
    durum() {
      const bayt = new Uint8Array(this.sablon.hucreSayisi);
      for (const y of this.yuvaCop.keys()) bayt[y >> 3] |= 1 << (y & 7);
      return { sablon: this.sablon, bayt };
    }
    // Çöpü yuvaya koy (elle konmuş gibi küçük sapma); sure > 0 ise canlandır
    yerlestir(id, yuva, sure = 0) {
      const c = this.coplar.get(id), y = this.yuvalar.get(yuva);
      if (c.yuva !== null && this.yuvaCop.get(c.yuva) === id) this.yuvaCop.delete(c.yuva);
      c.yuva = yuva; this.yuvaCop.set(yuva, id);
      if (c.node.parentNode !== this.gCop) this.gCop.appendChild(c.node);
      c.node.classList.remove('kalkik');
      const hedef = { x: y.x, y: y.y, aci: y.aci, yon: this.basYon(yuva) };
      if (sure > 0 && c.konum) return this.tasi(c, hedef, sure, { kayma: true, tohum: [id, yuva] });
      Kit.kibrit.konumla(c.node, hedef.x, hedef.y, hedef.aci, { kayma: true, tohum: [id, yuva], yon: hedef.yon });
      c.konum = hedef;
      return Promise.resolve();
    }
    // Elde (kalkık) çöp: yuvasız, en üst katmanda
    kaldir(id) {
      const c = this.coplar.get(id);
      if (c.yuva !== null && this.yuvaCop.get(c.yuva) === id) this.yuvaCop.delete(c.yuva);
      c.yuva = null;
      this.gUst.appendChild(c.node);
      c.node.classList.add('kalkik');
      return c;
    }
    // yon verilmezse: açı değişmediyse eldeki yön korunur, değiştiyse açıdan
    elde(id, x, y, aci, yon) {
      const c = this.coplar.get(id);
      if (yon === undefined) yon = c.konum && c.konum.aci === aci && c.konum.yon ? c.konum.yon : Kit.kibrit.basYonu(aci);
      c.konum = { x, y, aci, yon };
      Kit.kibrit.konumla(c.node, x, y, aci, { olcek: 1.07, yukseklik: 2.8, yon });
    }
    sil(id) { const c = this.coplar.get(id); if (!c) return; if (c.yuva !== null) this.yuvaCop.delete(c.yuva); c.node.remove(); this.coplar.delete(id); }
    yeniCop() { return this.copYap('k' + (this.sayac++)); }
    // Kısa geçiş (rAF): konum ve açı. Başın gerçek yönü (açı + baş ucu) en kısa yoldan döner; baş yolda sıçramaz.
    tasi(c, hedef, sure, o = {}) {
      const bas = Object.assign({}, c.konum || hedef);
      const ys = bas.yon || Kit.kibrit.basYonu(bas.aci), ye = hedef.yon || Kit.kibrit.basYonu(hedef.aci);
      const es = bas.aci + (ys === -1 ? 180 : 0), ee = hedef.aci + (ye === -1 ? 180 : 0);
      const da = ((ee - es) % 360 + 540) % 360 - 180;
      const animasyon = Kit.kalem.animasyonVar();
      const son = () => {
        Kit.kibrit.konumla(c.node, hedef.x, hedef.y, hedef.aci, Object.assign({ yon: ye }, o));
        c.konum = { x: hedef.x, y: hedef.y, aci: hedef.aci, yon: ye };
      };
      return new Promise(res => {
        if (!animasyon) { son(); return res(); }
        const t0 = performance.now();
        const adim = (t) => {
          const u = Math.min(1, (t - t0) / sure), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          if (u < 1) {
            const x = bas.x + (hedef.x - bas.x) * e, y = bas.y + (hedef.y - bas.y) * e;
            Kit.kibrit.konumla(c.node, x, y, es + da * e, { olcek: 1 + .06 * Math.sin(Math.PI * u), yukseklik: 1 + Math.sin(Math.PI * u) * 2.2, yon: 1 });
            requestAnimationFrame(adim);
          } else { son(); res(); }
        };
        requestAnimationFrame(adim);
      });
    }
    // Hedef bayta geçiş: kaldırılan yuvalardaki çöpler eklenen yuvalara taşınır; artanlar kutuya, eksikler kutudan
    async uygula(bayt, sure = 260) {
      const f = Mo.fark(this.durum(), { sablon: this.sablon, bayt });
      const den = f.kaldirilan.slice(), ye = f.eklenen.slice();
      const isler = [];
      while (den.length && ye.length) {
        const d = den.shift();
        // en yakın eklenen yuva
        let en = 0, best = Infinity;
        const yd = this.yuvalar.get(d);
        ye.forEach((y, i) => { const q = this.yuvalar.get(y), u = Math.hypot(q.x - yd.x, q.y - yd.y); if (u < best) { best = u; en = i; } });
        const hedefY = ye.splice(en, 1)[0];
        const id = this.yuvaCop.get(d);
        this.yuvaCop.delete(d);
        isler.push([id, hedefY]);
      }
      for (const [id, y] of isler) { const c = this.coplar.get(id); c.yuva = null; }
      const p = isler.map(([id, y]) => this.yerlestir(id, y, sure));
      for (const d of den) this.sil(this.yuvaCop.get(d));
      for (const y of ye) { const c = this.yeniCop(); this.yerlestir(c.id, y); }
      await Promise.all(p);
      this.kilavuz(this.kilavuzAcik);
    }
    // Yuva izleri: kılavuz açıksa rakam yuvaları hep silik (işlem hücresinin yuvaları yıldız gibi kalabalık görünmesin diye gizli)
    islemMi(y) { return this.sablon.hucreler[y >> 3].tur === 'I'; }
    kilavuz(acik) {
      this.kilavuzAcik = acik;
      for (const [y, s] of this.yuvalar) Kit.kibrit.yuvaDurum(s.node, acik && !this.yuvaCop.has(y) && !this.islemMi(y) ? 1 : 0);
    }
    // Sürüklerken: bütün boş rakam yuvaları görünür (işaretçiye yakın olanlar daha belirgin); işlem yuvaları yalnız işaretçi o
    // hücreye yaklaşınca (hepsi birden yıldız gibi kalabalık görünür); aday vurgulu
    yuvaGoster(nokta, aday) {
      for (const [y, s] of this.yuvalar) {
        let d = 0;
        if (!this.yuvaCop.has(y)) {
          const u = nokta ? Math.hypot(s.x - nokta.x, s.y - nokta.y) : Infinity;
          if (y === aday) d = 2;
          else if (this.islemMi(y)) d = u < this.L * .75 ? 1 : 0;
          else d = u < this.L * 2 ? 1 : 3;
        }
        Kit.kibrit.yuvaDurum(s.node, d);
      }
    }
    // Fare üstündeyken en yakın çöp hafifçe aydınlanır
    uzerinde(id) {
      if (this._uz === id) return;
      if (this._uz && this.coplar.get(this._uz)) this.coplar.get(this._uz).node.classList.remove('uzerinde');
      this._uz = id;
      if (id && this.coplar.get(id)) this.coplar.get(id).node.classList.add('uzerinde');
    }
    // Nokta → en yakın çöp (yuvadaki); dönüş { id, uzaklik }
    enYakinCop(p) {
      let en = null, best = Infinity;
      for (const [y, id] of this.yuvaCop) {
        const s = this.yuvalar.get(y);
        const u = parcaUzakligi(p, s, this.copL);
        if (u < best) { best = u; en = id; }
      }
      return { id: en, uzaklik: best };
    }
    // Nokta → en yakın boş yuva (parça uzaklığı; çaprazlara küçük ceza, açıya göre eşitlik bozma)
    enYakinBosYuva(p, aci = null, yaricap = this.L * C.yakalama) {
      let en = null, best = Infinity;
      for (const [y, s] of this.yuvalar) {
        if (this.yuvaCop.has(y)) continue;
        let u = parcaUzakligi(p, s, this.L * .8);
        if (Math.abs(s.aci) === 45) u += this.L * .05;
        if (aci !== null) { const da = Math.abs(((s.aci - aci) % 180 + 270) % 180 - 90); u += da / 90 * this.L * .04; }
        if (u < best) { best = u; en = y; }
      }
      return best <= yaricap ? en : null;
    }
    // İpucu izleri: hücrenin çevresine kırmızı kurşun elips; çöpün altına vurgu
    ipucuTemizle() { this.gIpucu.innerHTML = ''; this.coplar.forEach(c => c.node.classList.remove('isaretli')); }
    ipucuHucre(h) {
      const k = this.lay.hucreler[h];
      const K = Kit.kalem.kalemYap(this.svg);
      K.elips(this.gIpucu, [k.x + k.w / 2, this.L, k.w * 1.75, this.L * 2.75], { stroke: '#b4382e', strokeWidth: 1.6, roughness: 1.2 }, ['ipucu', ...this.tohum, h], {});
    }
    ipucuCop(yuva) { const id = this.yuvaCop.get(yuva); if (id) this.coplar.get(id).node.classList.add('isaretli'); }
    ipucuYuva(yuva) { const s = this.yuvalar.get(yuva); if (s) Kit.kibrit.yuvaDurum(s.node, 2); }
    // Ekran koordinatı → sahne koordinatı
    nokta(ev) {
      const m = this.svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    }
    olcek() { const m = this.svg.getScreenCTM(); return m ? Math.hypot(m.a, m.b) : 1; }
  }
  function parcaUzakligi(p, s, uz) {
    const r = s.aci * Math.PI / 180, dx = Math.cos(r) * uz / 2, dy = Math.sin(r) * uz / 2;
    const ax = s.x - dx, ay = s.y - dy, bx = s.x + dx, by = s.y + dy;
    const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(p.x - (ax + vx * t), p.y - (ay + vy * t));
  }

  /* ---------- defter: kalemle çizilmiş alıştırma kutusu ---------- */
  const GRAFIT = '#4a4a4a', KIRMIZI = '#b4382e', SILIK = '#8a8783';

  // Kalemle çizilmiş küçük çöp diyagramı: her çöp kurşun kalem çizgisi, başı kırmızı kalem noktası (fırıldak düzeniyle)
  function diyagram(K, g, karakter, x, tur, m, tohum) {
    const kod = tur === 'R' ? Mo.RAKAM[karakter] : tur === 'I' ? Mo.ISLEM[karakter] : Mo.ROMEN[karakter];
    const uz = m * .76;
    Mo.GEO[tur].forEach(([gx, gy, aci], bit) => {
      if (!(kod & (1 << bit))) return;
      const r = aci * Math.PI / 180, dx = Math.cos(r) * uz / 2, dy = Math.sin(r) * uz / 2;
      const cx = x + gx * m, cy = gy * m, yon = BAS[tur][bit];
      K.cizgi(g, [cx - dx, cy - dy, cx + dx, cy + dy], { stroke: GRAFIT, strokeWidth: 1.7, roughness: .45, bowing: .4 }, ['efsane', ...tohum, karakter, bit], { anlik: true, baski: false });
      K.daire(g, [cx + yon * dx, cy + yon * dy, m * .27], { stroke: KIRMIZI, strokeWidth: .6, fill: KIRMIZI, fillStyle: 'solid', roughness: .3 }, ['efsane-bas', ...tohum, karakter, bit], { anlik: true, baski: false });
    });
  }
  function efsane(kap, romen, tohum) {
    kap.innerHTML = '';
    hEl('span', 'etiket', kap, romen ? 'romen rakamları böyle yazılır:' : 'rakamlar böyle yazılır:');
    const svg = svgEl('svg', { 'aria-hidden': 'true' }, kap);
    const K = Kit.kalem.kalemYap(svg);
    const g = svgEl('g', {}, svg);
    // çizim birimi sabit (m = 16); ekrandaki boyu CSS verir (yükseklik, en boy oranı korunur)
    const m = 16, aralik = m * 1.9, etY = 2 * m + 16;
    let x = 0;
    const yaz = (metin, xx) => { const t = svgEl('text', { x: xx, y: etY, 'text-anchor': 'middle', 'font-size': 14, fill: SILIK }, g); t.textContent = metin; };
    if (romen) {
      for (const [ch, v] of [['I', '1'], ['V', '5'], ['X', '10'], ['L', '50']]) { diyagram(K, g, ch, x, 'M', m, tohum); yaz(`${ch} ${v}`, x + m * .36); x += m * 2.3; }
      x += m * .3;
    } else {
      for (let d = 0; d <= 9; d++) { diyagram(K, g, String(d), x, 'R', m, tohum); yaz(String(d), x + m / 2); x += aralik; }
      x += m * .4;
    }
    for (const [op, ad] of [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷'], ['=', '=']]) { diyagram(K, g, op, x, 'I', m, tohum); yaz(ad, x + m / 2); x += aralik; }
    const W = x - aralik + m + 6;
    svg.setAttribute('viewBox', `-5 -5 ${W + 6} ${etY + 9}`);
    hEl('span', 'aciklama', kap, romen ? 'IV = 4 · IX = 9 · XL = 40; aynı harf en çok üç kez yan yana' : '1 sağdaki iki çöp · 6 şapkalı · 9 kuyruklu · 7 üç çöp · ÷ eğik çizgi');
    hEl('span', 'gizli', kap, romen ? 'I bir çöp; V iki eğik çöp; X iki kesişen çöp; L bir dikey ve bir yatay çöp.' : 'Yedi çöplü rakamlar; altıda üst çöp var, dokuzda alt çöp var, yedi üç çöp.');
  }

  // Zorluk: kalemle çizilmiş dört küçük daire; zorluk kadarı taranmış
  function zorlukSimge(kap, n, tohum, bant) {
    const ad = bant ? KB.difficulty.BANT_AD[bant] : n + ' / 4';
    const svg = svgEl('svg', { class: 'zorluk', viewBox: '-2 -2 52 16', width: 52, height: 16, role: 'img', 'aria-label': `Zorluk: ${ad}` }, kap);
    const t = svgEl('title', {}, svg); t.textContent = `Zorluk: ${ad}`;
    const K = Kit.kalem.kalemYap(svg);
    for (let i = 0; i < 4; i++) {
      const dolu = i < n;
      K.daire(svg, [6 + i * 12, 6, 9], Object.assign({ stroke: dolu ? GRAFIT : SILIK, strokeWidth: 1.1, roughness: .7 },
        dolu ? { fill: GRAFIT, fillStyle: 'zigzag', hachureGap: 1.6, fillWeight: .7 } : {}), ['zorluk', ...tohum, i], { anlik: true });
    }
  }

  // Kırmızı kalemle işaret: el yazısı sözcük ve çevresinde halka (öğretmen kalemi). x/y kabın içinde merkez.
  function isaret(kap, metin, o = {}) {
    const KL = Kit.kalem;
    const r = KL.rastgele('isaret', ...(o.tohum || [metin]));
    const boyut = o.boyut || 30;
    const aci = o.aci ?? (r() * 8 - 6);
    const svg = svgEl('svg', { class: 'isaret', 'aria-hidden': 'true' }, null);
    kap.appendChild(svg);
    // önce ölç
    const olc = svgEl('text', { x: 0, y: 0, 'font-size': boyut }, svg);
    olc.textContent = metin;
    let tw = metin.length * boyut * .48;
    try { const b = olc.getBBox(); if (b.width) tw = b.width; } catch (e) { /* yoksay */ }
    olc.remove();
    const w = tw + boyut * 1.6, h = boyut * 2;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    // kabın içinde kalsın (yatayda)
    const x = Math.max(w / 2 - 6, Math.min(kap.clientWidth - w / 2 + 6, o.x ?? kap.clientWidth / 2)), y = o.y ?? kap.clientHeight / 2;
    svg.style.left = x + 'px'; svg.style.top = y + 'px';
    svg.style.transform = `translate(-50%, -50%) rotate(${aci.toFixed(1)}deg)`;
    const K = KL.kalemYap(svg);
    const anlik = !!o.anlik;
    const yazi = KL.metinSvg(svg, metin, { x: w / 2, y: h / 2 + boyut * .34, boyut, renk: KIRMIZI, hiza: 'middle', tohum: ['isaret', metin], anlik, adim: 45 });
    const halka = K.elips(svg, [w / 2, h / 2, w - 6, h - 8], { stroke: KIRMIZI, strokeWidth: o.kalin || 2, roughness: 1.5, bowing: 2.2 }, ['isaret-halka', ...(o.tohum || [metin])],
      { anlik, gecikme: anlik ? 0 : (yazi.sure || 300) * .6, sureMs: [380, 460] });
    return { node: svg, bitti: Promise.all([yazi.bitti, halka.bitti]) };
  }
  const isaretSil = (kap) => kap.querySelectorAll(':scope > svg.isaret').forEach(x => x.remove());

  const KAT_KISA = { tek: 'tek çöp', iki: 'iki çöp', ekle: 'bir çöp ekle', cikar: 'bir çöp çıkar', hepsini: 'hepsini bul', romen: 'romen' };
  // Alıştırma kutusu. o: { kayit: { no, kategori, bant }, durum, L, tohum, kilavuz, kucuk, efsane, efsaneKap, talimat, alt, baslik }
  // efsaneKap verilirse "rakamlar böyle yazılır" kutunun dışında o kaba (sayfanın dibine) çizilir.
  function olustur(el, o) {
    el.innerHTML = '';
    el.classList.add('bulmaca');
    el.classList.toggle('kucuk', !!o.kucuk);
    const romen = o.durum.sablon.romen;
    const tohum = o.tohum || ['bulmaca'];
    const cer = svgEl('svg', { class: 'cerceve-iz', 'aria-hidden': 'true' }, el);
    const bas = hEl('header', 'bulmaca-bas', el);
    const h = hEl('h2', '', bas, o.baslik || (o.kayit && o.kayit.no ? `Bulmaca ${o.kayit.no}` : 'Bulmaca'));
    h.id = (el.id || 'bulmaca') + '-baslik';
    const sag = hEl('div', 'sag', bas);
    const kat = o.kayit && KAT_KISA[o.kayit.kategori];
    if (kat) hEl('span', 'kat', sag, kat);
    if (o.kayit && o.kayit.bant) zorlukSimge(sag, KB.difficulty.bantNo(o.kayit.bant) + 1, tohum, o.kayit.bant);
    const t = hEl('p', 'talimat', el);
    t.innerHTML = o.talimat || TALIMAT[o.kayit && o.kayit.kategori] || TALIMAT.tek;
    const kap = hEl('div', 'sahne-kap', el);
    const svg = svgEl('svg', { class: 'sahne', role: 'group', 'aria-roledescription': 'kibrit sahnesi', 'aria-describedby': 'sahne-yardim' }, kap);
    const sahne = new Sahne(svg, o);
    let ef = null;
    if (o.efsane !== false && !o.kucuk) {
      if (o.efsaneKap) efsane(o.efsaneKap, romen, tohum);
      else { ef = hEl('div', 'rakamlar', el); efsane(ef, romen, tohum); }
    } else if (o.efsaneKap) o.efsaneKap.innerHTML = '';
    const alt = hEl('p', 'bulmaca-alt', el);
    if (o.alt) alt.innerHTML = o.alt;
    // kalemle çerçeve: köşelerde taşan kutu; efsanenin üstünde ayraç çizgisi
    function cerceve() {
      cer.innerHTML = '';
      const w = el.offsetWidth, hh = el.offsetHeight;
      if (!w || !hh) return;
      cer.setAttribute('viewBox', `0 0 ${w} ${hh}`); cer.setAttribute('width', w); cer.setAttribute('height', hh);
      const K = Kit.kalem.kalemYap(cer);
      Kit.kalem.kutu(K, cer, 2, 2, w - 4, hh - 4, { tohum: ['cerceve', ...tohum], tasma: 7, cizgi: { stroke: GRAFIT, strokeWidth: 1.3, roughness: .8 }, anlik: true });
      if (ef) { const y = ef.offsetTop - 2; K.cizgi(cer, [12, y, w - 14, y + .8], { stroke: SILIK, strokeWidth: 1, roughness: .7 }, ['cerceve-ayrac', ...tohum], { anlik: true }); }
    }
    requestAnimationFrame(cerceve);
    // kutu boyu değişince (yazı tipi, efsane, pencere) çerçeve yeniden çizilir; aynı tohum, aynı çizgi
    if (typeof ResizeObserver !== 'undefined') {
      if (el._cerceveGozcu) el._cerceveGozcu.disconnect();
      el._cerceveGozcu = new ResizeObserver(() => requestAnimationFrame(cerceve));
      el._cerceveGozcu.observe(el);
    }
    return {
      el, svg, sahne, talimatEl: t, altEl: alt,
      yenile: cerceve,
      // kırmızı kalem işareti: kutunun sağ altında, alt çizginin üstüne biner (çözüm okunur kalsın)
      damga: (metin, d = {}) => {
        const boyut = d.boyut || Math.max(20, Math.min(32, el.clientWidth / 18));
        return isaret(el, metin, Object.assign({ x: el.clientWidth * (d.xo ?? .8), y: el.clientHeight - boyut * .75, boyut, tohum: [...tohum, 'isaret', metin] }, d));
      },
      damgaSil: () => isaretSil(el),
    };
  }

  KB.kupur = { TALIMAT, BAS, Sahne, olustur, efsane, diyagram, zorlukSimge, isaret, isaretSil, yuvaAdi, HUCRE_AD };
})();
