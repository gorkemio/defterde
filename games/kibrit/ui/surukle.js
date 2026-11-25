// ui/surukle.js — çöp etkileşimi: sürükle-bırak (dokunmatikte parmağın 30 px üstünde), dokun-dokun, klavye (Tab/Enter/Escape),
// kibrit kutusu (ekle/çıkar), sınırsız geri al ve baştan. Her kupür için ayrı örnek (iki kişi yarışında iki tane).
//   const e = new KB.Etkilesim(kupur, { kategori, kutu, kutuEl, degisti(durum), sesler: true })
//   e.kilitle(true) · e.geriAl() · e.bastan() · e.durum() · e.temizle()
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const Mo = KB.model, C = KB.config;
  const ses = (ad, g, arg) => { try { Kit.ses.cal(ad, g || 0, arg); } catch (e) { /* yoksay */ } };

  class Etkilesim {
    constructor(kupur, o) {
      this.k = kupur; this.s = kupur.sahne; this.o = o;
      this.svg = kupur.svg;
      this.bas = Mo.kopya(this.s.durum());
      this.yigin = [];
      this.elde = null;           // { id, kaynak, kutudan, pointerId, basEkran, tasindi, secili }
      this.kilitli = false;
      this.kutuAktif = !!(o.kutuEl && (o.kategori === 'ekle' || o.kategori === 'cikar'));
      this.dinle = [];
      const on = (el, ad, f, opt) => { el.addEventListener(ad, f, opt); this.dinle.push([el, ad, f, opt]); };
      on(this.svg, 'pointerdown', (e) => this.basla(e));
      on(this.svg, 'pointermove', (e) => this.hareket(e));
      on(this.svg, 'pointerup', (e) => this.birak(e));
      on(this.svg, 'pointercancel', (e) => this.vazgec(e));
      on(this.svg, 'pointerleave', () => this.s.uzerinde(null));
      on(this.svg, 'keydown', (e) => this.tus(e));
      if (this.kutuAktif) {
        const kel = o.kutuEl;
        kel.classList.add('etkin');
        kel.setAttribute('role', 'button'); kel.setAttribute('tabindex', '0');
        kel.setAttribute('aria-label', o.kategori === 'ekle' ? 'Kibrit kutusu: çöp al' : 'Kibrit kutusu: çöpü buraya bırak');
        on(kel, 'pointerdown', (e) => this.kutuBasla(e));
        on(kel, 'pointermove', (e) => this.hareket(e));
        on(kel, 'pointerup', (e) => this.birak(e));
        on(kel, 'pointercancel', (e) => this.vazgec(e));
        on(kel, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.kutuTus(); } });
      }
      this.erisim();
    }
    temizle() {
      this.dinle.forEach(([el, ad, f, opt]) => el.removeEventListener(ad, f, opt));
      this.dinle = [];
      if (this.o.kutuEl) { this.o.kutuEl.classList.remove('etkin', 'hedef'); this.o.kutuEl.removeAttribute('role'); this.o.kutuEl.removeAttribute('tabindex'); }
    }
    durum() { return this.s.durum(); }
    kilitle(v) {
      this.kilitli = v;
      this.svg.classList.toggle('kilitli', v);
      if (v) this.iptal();
      this.erisim();
    }

    /* ---------- işaretçi ---------- */
    yaricap() { return Math.max(this.s.L * .36, 22 / this.s.olcek()); }
    hedefNokta(e) {
      const p = this.s.nokta(e);
      if (e.pointerType === 'touch' || e.pointerType === 'pen') p.y -= C.dokunmaYukari / this.s.olcek();
      return p;
    }
    basla(e) {
      if (this.kilitli || (e.button !== undefined && e.button > 0)) return;
      const p = this.s.nokta(e);
      if (this.elde && this.elde.secili) {
        e.preventDefault();
        // ikinci dokunuş: boş yuvaya bırak, başka çöpe geç, aynı çöpe dokununca bırak
        const y = this.s.enYakinBosYuva(p, null, this.s.L * .75);
        const c = this.s.enYakinCop(p);
        if (y !== null && (c.id === null || c.uzaklik > this.yaricap() * .6)) return this.koy(y);
        if (c.id !== null && c.uzaklik <= this.yaricap() && c.id !== this.elde.id) { this.iptal(); return this.basla(e); }
        return this.iptal();
      }
      const c = this.s.enYakinCop(p);
      if (c.id === null || c.uzaklik > this.yaricap()) return;
      e.preventDefault();
      this.s.uzerinde(null);
      try { this.svg.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
      const cop = this.s.coplar.get(c.id);
      const kaynak = cop.yuva;
      const k = cop.konum || this.s.yuvalar.get(kaynak);
      this.s.kaldir(c.id);
      this.s.elde(c.id, k.x, k.y, k.aci);
      this.elde = { id: c.id, kaynak, kutudan: false, pointerId: e.pointerId, basEkran: { x: e.clientX, y: e.clientY }, tasindi: false, secili: false, aci: k.aci, el: this.svg };
      this.s.yuvaGoster(p, null);
      ses('kaldir');
    }
    kutuBasla(e) {
      if (this.kilitli || !this.kutuAktif) return;
      e.preventDefault();
      if (this.elde && this.elde.secili) {
        // seçili çöpü kutuya bırak
        return this.kutuyaKoy();
      }
      const c = this.s.yeniCop();
      this.s.kaldir(c.id);
      const p = this.hedefNokta(e);
      this.s.elde(c.id, p.x, p.y, 0);
      try { this.o.kutuEl.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
      this.elde = { id: c.id, kaynak: null, kutudan: true, pointerId: e.pointerId, basEkran: { x: e.clientX, y: e.clientY }, tasindi: false, secili: false, aci: 0, el: this.o.kutuEl };
      ses('cekmece');
    }
    hareket(e) {
      const el = this.elde;
      if (!el && e.pointerType === 'mouse' && !this.kilitli) {
        const c = this.s.enYakinCop(this.s.nokta(e));
        this.s.uzerinde(c.id !== null && c.uzaklik <= this.yaricap() ? c.id : null);
        return;
      }
      if (!el || el.secili || e.pointerId !== el.pointerId) return;
      if (!el.tasindi && Math.hypot(e.clientX - el.basEkran.x, e.clientY - el.basEkran.y) > 6) el.tasindi = true;
      if (!el.tasindi) return;
      const p = this.hedefNokta(e);
      const aday = this.s.enYakinBosYuva(p, el.aci);
      let aci = el.aci;
      if (aday !== null) aci = this.s.yuvalar.get(aday).aci;
      el.aday = aday;
      this.s.elde(el.id, p.x, p.y, aci, aday !== null ? this.s.basYon(aday) : undefined);
      this.s.yuvaGoster(p, aday);
      if (this.kutuAktif) this.o.kutuEl.classList.toggle('hedef', aday === null && this.kutuUstunde(e));
    }
    kutuUstunde(e) {
      if (!this.kutuAktif) return false;
      const r = this.o.kutuEl.getBoundingClientRect();
      const pay = 16;
      const y = e.clientY - ((e.pointerType === 'touch' || e.pointerType === 'pen') ? C.dokunmaYukari : 0);
      return e.clientX >= r.left - pay && e.clientX <= r.right + pay && y >= r.top - pay && y <= r.bottom + pay;
    }
    birak(e) {
      const el = this.elde;
      if (!el || el.secili || e.pointerId !== el.pointerId) return;
      if (!el.tasindi) {
        // dokun-dokun: çöp kalkık kalır, ikinci dokunuşu bekler
        el.secili = true;
        this.s.yuvaGoster(null, null);
        for (const [y, s] of this.s.yuvalar) if (!this.s.yuvaCop.has(y)) Kit.kibrit.yuvaDurum(s.node, 1);
        if (this.kutuAktif) this.o.kutuEl.classList.add('hedef');
        this.erisim();
        return;
      }
      if (this.kutuAktif) this.o.kutuEl.classList.remove('hedef');
      if (el.aday === null && this.kutuUstunde(e)) return this.kutuyaKoy();
      if (el.aday !== null && el.aday !== undefined) return this.koy(el.aday);
      this.iptal();
    }
    vazgec(e) { if (this.elde && e.pointerId === this.elde.pointerId && !this.elde.secili) this.iptal(); }

    // Eldeki çöpü yuvaya koy: hamle tamamlanır
    koy(yuva) {
      const el = this.elde;
      if (!el) return;
      const once = this.durum();
      this.elde = null;
      if (this.kutuAktif) this.o.kutuEl.classList.remove('hedef');
      const dogrudan = el.kaynak === yuva;
      this.s.yerlestir(el.id, yuva, 120);
      this.s.kilavuz(this.s.kilavuzAcik);
      ses('koy', 0, Math.random());
      if (!dogrudan) { this.yigin.push(once.bayt); this.bildir(); }
      this.erisim(yuva);
    }
    kutuyaKoy() {
      const el = this.elde;
      if (!el) return;
      const once = this.durum();
      this.elde = null;
      this.o.kutuEl.classList.remove('hedef');
      this.s.sil(el.id);
      this.s.kilavuz(this.s.kilavuzAcik);
      ses('cekmece');
      if (!el.kutudan) { once.bayt && this.yigin.push(once.bayt); this.bildir(); }
      this.erisim();
    }
    // Eldeki çöpü geldiği yere döndür
    iptal() {
      const el = this.elde;
      if (!el) return;
      this.elde = null;
      if (this.kutuAktif) this.o.kutuEl.classList.remove('hedef');
      if (el.kutudan || el.kaynak === null) this.s.sil(el.id);
      else this.s.yerlestir(el.id, el.kaynak, 140);
      this.s.kilavuz(this.s.kilavuzAcik);
      this.erisim();
    }
    // durum değişti: bir önceki durum yığında
    bildir() { if (this.o.degisti) this.o.degisti(this.durum()); }

    async geriAl() {
      if (this.kilitli || !this.yigin.length) return false;
      this.iptal();
      const b = this.yigin.pop();
      await this.s.uygula(b, 200);
      ses('koy', 0, .3);
      if (this.o.degisti) this.o.degisti(this.durum(), { geri: true });
      this.erisim();
      return true;
    }
    async bastan() {
      if (this.kilitli) return false;
      this.iptal();
      const simdi = this.durum();
      if (Mo.maske(simdi) === Mo.maske(this.bas)) return false;
      this.yigin.push(simdi.bayt);
      await this.s.uygula(this.bas.bayt, 260);
      if (this.o.degisti) this.o.degisti(this.durum(), { bastan: true });
      this.erisim();
      return true;
    }
    // Hepsini Bul: çözüm bulununca kupür başlangıca döner (yığın sıfırlanır)
    async sifirla() {
      this.iptal();
      this.yigin = [];
      await this.s.uygula(this.bas.bayt, 260);
      this.erisim();
    }

    /* ---------- klavye ---------- */
    erisim(odakYuva) {
      const s = this.s;
      const tutuyor = this.elde && this.elde.secili;
      for (const [id, c] of s.coplar) {
        const n = c.node;
        if (this.kilitli) { n.removeAttribute('tabindex'); n.removeAttribute('role'); continue; }
        n.setAttribute('tabindex', tutuyor ? '-1' : '0');
        n.setAttribute('role', 'button');
        n.setAttribute('aria-label', c.yuva !== null ? `çöp: ${KB.kupur.yuvaAdi(s.sablon, c.yuva)}` : 'eldeki çöp');
      }
      for (const [y, q] of s.yuvalar) {
        const n = q.node;
        if (tutuyor && !s.yuvaCop.has(y)) {
          n.setAttribute('tabindex', '0'); n.setAttribute('role', 'button');
          n.setAttribute('aria-label', `boş yuva: ${KB.kupur.yuvaAdi(s.sablon, y)}`);
        } else { n.removeAttribute('tabindex'); n.removeAttribute('role'); n.removeAttribute('aria-label'); }
      }
      if (odakYuva !== undefined && !tutuyor) {
        const id = s.yuvaCop.get(odakYuva);
        if (id && document.activeElement && this.svg.contains(document.activeElement)) s.coplar.get(id).node.focus({ preventScroll: true });
      }
    }
    tus(e) {
      if (this.kilitli) return;
      const hedef = e.target.closest && e.target.closest('[data-cop], [data-yuva]');
      if (e.key === 'Escape') { if (this.elde) { e.preventDefault(); const id = this.elde.id, k = this.elde.kaynak; this.iptal(); const c = this.s.coplar.get(id); if (c && k !== null) c.node.focus(); } return; }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!hedef) return;
      e.preventDefault();
      if (hedef.dataset.cop && !this.elde) {
        const id = hedef.dataset.cop, c = this.s.coplar.get(id);
        const k = c.konum || this.s.yuvalar.get(c.yuva);
        const kaynak = c.yuva;
        this.s.kaldir(id); this.s.elde(id, k.x, k.y, k.aci);
        this.elde = { id, kaynak, kutudan: false, secili: true, aci: k.aci, pointerId: -1 };
        for (const [y, s] of this.s.yuvalar) if (!this.s.yuvaCop.has(y)) Kit.kibrit.yuvaDurum(s.node, 1);
        ses('kaldir');
        this.erisim();
        // en yakın boş yuvaya odak
        const p = this.s.yuvalar.get(kaynak);
        let en = null, best = Infinity;
        for (const [y, s] of this.s.yuvalar) if (!this.s.yuvaCop.has(y)) { const u = Math.hypot(s.x - p.x, s.y - p.y); if (u < best && y !== kaynak) { best = u; en = s; } }
        if (en) en.node.focus({ preventScroll: true });
      } else if (hedef.dataset.yuva !== undefined && this.elde) {
        this.koy(Number(hedef.dataset.yuva));
      }
    }
    kutuTus() {
      if (this.kilitli) return;
      if (this.elde) return this.kutuyaKoy();
      const c = this.s.yeniCop();
      this.s.kaldir(c.id);
      const son = this.s.lay.genislik + this.s.L * .2;
      this.s.elde(c.id, son, this.s.L, 0);
      this.elde = { id: c.id, kaynak: null, kutudan: true, secili: true, aci: 0, pointerId: -1 };
      for (const [y, s] of this.s.yuvalar) if (!this.s.yuvaCop.has(y)) Kit.kibrit.yuvaDurum(s.node, 1);
      this.erisim();
      const ilk = [...this.s.yuvalar.values()].find(s => !this.s.yuvaCop.has(s.yuva));
      if (ilk) ilk.node.focus({ preventScroll: true });
    }
  }

  KB.Etkilesim = Etkilesim;
})();
