// Klavye yerleştirmesi: önizleme gerçek tahtayı yalnız onaylanınca değiştirir.
(function () {
  'use strict';
  const AB = window.AB, G = AB.game, D = AB.draw;
  AB.placement = {
    bilgiYaz(O) {
      const t = O.tahta.ben, T = O.cizim.ben;
      if (!t || !T) return;
      T.hucre.forEach((h, i) => {
        const id = t.gemiHaritasi[i], g = id < 0 ? null : t.gemiler[id];
        const yer = G.hucreAdi(Math.floor(i / t.n), i % t.n);
        const gemi = g ? `${g.uzunluk} hücreli gemi, ${g.yatay ? 'yatay' : 'dikey'}` : 'boş';
        const atis = g?.batti ? 'gemi battı' : ['', 'ıska', 'isabet', 'gemi çevresi'][t.atis[i]];
        h.setAttribute('aria-label', `${yer}, ${gemi}${atis ? ', ' + atis : ''}`);
      });
    },
    kur(O, duyur, guncelle) {
      const svg = document.querySelector('#tahta-ben');
      let secim = null;
      function iptal() {
        if (!secim) return;
        const g = O.tahta.ben.gemiler[secim.id];
        secim = null;
        D.hedefSil(O.cizim.ben);
        if (g) D.gemiGeriDon(O.cizim.ben, g);
      }
      function baslat(id) {
        if (!O.dizilebilir || O.duraklat || O.kilit || O.surukle) return;
        iptal();
        const g = O.tahta.ben.gemiler[id];
        secim = { id, s: g.hucreler[0].s, k: g.hucreler[0].k, yatay: g.yatay };
        svg.querySelector(`[data-gemi="${id}"]`).focus({ preventScroll: true });
        onizle();
      }
      function onizle() {
        const { id, s, k, yatay } = secim, g = O.tahta.ben.gemiler[id];
        const uygun = G.tasinabilir(O.tahta.ben, id, s, k, yatay);
        D.hedefGoster(O.cizim.ben, g, s, k, yatay, uygun);
        const ad = s >= 0 && k >= 0 && s < O.tahta.ben.n && k < O.tahta.ben.n ? G.hucreAdi(s, k) : 'Tahta dışı';
        duyur(`${g.uzunluk} hücreli gemi: ${ad}, ${yatay ? 'yatay' : 'dikey'}. ${uygun ? 'Enter ile yerleştir.' : 'Geçersiz yer. Ok tuşlarıyla başka yer seç.'}`);
      }
      svg.addEventListener('keydown', e => {
        const handle = e.target.closest?.('.tutamak');
        if (!handle || !O.dizilebilir || O.duraklat) return;
        if (!secim) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); baslat(+handle.dataset.gemi); }
          return;
        }
        const g = O.tahta.ben.gemiler[secim.id];
        switch (e.key) {
          case 'ArrowUp': secim.s--; break;
          case 'ArrowDown': secim.s++; break;
          case 'ArrowLeft': secim.k--; break;
          case 'ArrowRight': secim.k++; break;
          case 'r': case 'R': secim.yatay = g.uzunluk === 1 || !secim.yatay; break;
          case 'Escape': e.preventDefault(); iptal(); duyur('Yerleştirme iptal edildi. Gemi eski yerinde.'); return;
          case 'Enter': case ' ':
            e.preventDefault();
            if (!G.gemiTasi(O.tahta.ben, g.id, secim.s, secim.k, secim.yatay)) { onizle(); return; }
            iptal();
            D.gemiYerlestir(O.cizim.ben, g);
            D.tutamaklariKur(O.cizim.ben, O.tahta.ben.gemiler);
            guncelle();
            svg.querySelector(`[data-gemi="${g.id}"]`).focus({ preventScroll: true });
            duyur(`Gemi ${G.hucreAdi(g.hucreler[0].s, g.hucreler[0].k)} konumuna yerleştirildi.`);
            return;
          default: return;
        }
        e.preventDefault();
        // Önizleme sınır dışına çıkabilir; sonsuza kadar uzaklaşamaz.
        secim.s = Math.max(-1, Math.min(O.tahta.ben.n, secim.s));
        secim.k = Math.max(-1, Math.min(O.tahta.ben.n, secim.k));
        onizle();
      });
      svg.addEventListener('focusout', e => { if (secim && e.target.matches('.tutamak')) iptal(); });
      return { iptal, baslat };
    },
  };
})();
