// ui/baslat.js — açılış: malzeme, ses, font, tahta ve giriş kurulumu; adres (#kendi=…, #ornek, #izle) ya da Defterler.
(function () {
  'use strict';
  const KK = window.KK;

  async function basla() {
    if (typeof rough === 'undefined') { Kit.kalem.kalemYok && Kit.kalem.kalemYok(); return; }
    Kit.malzeme.sec('kursunkalem', { cizim: { strokeWidth: 1.4 } });
    Kit.kalem.ayarla(Kit.kalem.ayar.cizim, Kit.kalem.ayar.renk, { yazi: { aile: 'Architects Daughter', ornek: 'AİŞĞÇÖÜıüöç0123456789' } });
    Kit.kuruboya.kur({ ses: true });
    Kit.ses.kur({ anahtar: 'kk-sessiz' });
    Kit.ses.sessizYap(!KK.oyun.ayar.ses);
    addEventListener('pointerdown', () => Kit.ses.baslat(), { once: true, capture: true });
    addEventListener('keydown', () => Kit.ses.baslat(), { once: true, capture: true });
    try { await Kit.kalem.fontBekle('Architects Daughter', 'AİŞĞÇÖÜıüöç0123456789', 2500); } catch (e) { /* yedek font */ }
    const cv = document.getElementById('tahta');
    KK.tahta.kur(cv);
    KK.tahta.oncesi.push(() => KK.isaretler.isle());
    KK.tahta.ustler.push((ctx, D, z) => KK.bitis.ciz(ctx, D, z), (ctx, D, z) => KK.ust.ciz(ctx, D, z));
    KK.giris.kur({ cv, defter: document.getElementById('defter') });
    KK.sayfa.kur();
    let zaman = 0;
    const yeniden = () => {
      cancelAnimationFrame(zaman);
      zaman = requestAnimationFrame(() => {
        KK.giris.olc();
        if (KK.oyun.ekran === 'oyun' && KK.oyun.b) KK.oyun.tahtaKur(false);
        else if (KK.oyun.ekran === 'kendi') KK.kendi.ac();
        else if (KK.oyun.ekran === 'album') KK.defterler.ac(KK.defterler.defter && document.querySelector('.resim-listesi') ? KK.defterler.defter : null);
      });
    };
    addEventListener('resize', yeniden);
    addEventListener('orientationchange', yeniden);
    if (window.visualViewport) visualViewport.addEventListener('resize', yeniden);
    Kit.bulmaca.sure.gorunurlukBagla({ get calisiyor() { return KK.oyun.kr && KK.oyun.kr.calisiyor; }, duraklat() { KK.oyun.kr && KK.oyun.kr.duraklat(); }, devam() { if (KK.oyun.ekran === 'oyun' && !KK.oyun.bitti && !KK.oyun.izle) KK.oyun.kr.devam(); } }, () => KK.oyun.kaydet());
    if (/[?&]olc=1/.test(location.search)) { KK.olcumDenemesi(); } else yonlendir();
    addEventListener('hashchange', yonlendir);
    window.KK_HAZIR = true;
  }

  // #ornek: yarısı çözülmüş 15×15 (ekran görüntüsü ve karşılaştırma için; kaydedilmez)
  KK.ornek = {
    ac() {
      const r0 = KK.resimler.bul('vapur') || KK.resimler.yukle().tum.find(r => r.en === 15);
      const r = Object.assign({}, r0, { tur: 'ornek', id: 'ornek-' + r0.id });
      KK.oyun.ac(r, { temiz: true, durgun: true });
      const O = KK.oyun, b = O.b, rnd = Kit.kalem.rastgele('ornek');
      for (let i = 0; i < O.d.length; i++) {
        const y = (i / b.en) | 0, x = i % b.en;
        if (O.kilit[i]) continue;
        if (y < 8 || (x < 5 && y < 12)) O.d[i] = b.cozum[i] ? 1 : (rnd() < .7 ? 2 : 0);
      }
      for (const [y, x] of [[9, 9], [10, 3], [11, 12]]) { const i = y * b.en + x; O.silgi[i] = 1 + (x % 2); }
      KK.isaretler.hepsiDegisti(); O.ustuGuncelle(); KK.sayfa.bilgiGuncelle();
    },
    // #boyali: aynı resim bitmiş ve boyanmış hâliyle (bitiş anı atlanmış)
    boyali() {
      const r0 = KK.resimler.bul('vapur') || KK.resimler.yukle().tum.find(r => r.en === 15);
      const r = Object.assign({}, r0, { tur: 'ornek', id: 'ornek-' + r0.id });
      KK.oyun.ac(r, { temiz: true, durgun: true });
      const O = KK.oyun, b = O.b;
      for (let i = 0; i < O.d.length; i++) O.d[i] = b.cozum[i] ? 1 : (i % 3 ? 2 : 0);
      KK.isaretler.hepsiDegisti(); O.ustuGuncelle();
      O.bitti = true; KK.bitis.baslat({ sure: 402000, hata: 0, ipucu: 1, mod: 'klasik' }); KK.bitis.atla();
    },
  };

  // Ölçüm düzeneği (?olc=1): 25×25'te satır satır sürükleyerek doldurur; kare süreleri (ort, p95, en) ve
  // yakınlaşma sonrası bütün katmanların yeniden çizilme süresi
  KK.olcumDenemesi = async function () {
    const r = KK.resimler.yukle().tum.find(x => x.en === 25) ;
    KK.oyun.ac(r, { temiz: true });
    const O = KK.oyun, t = KK.tahta, b = O.b, kare = () => new Promise(res => requestAnimationFrame(res));
    await kare(); await kare();
    Kit.tuval.olcumSifirla();
    for (let y = 0; y < b.boy; y += 2) {
      O.surukleBasla(y, 0, {});
      for (let x = 1; x < b.en; x++) { O.surukleGuncelle(y, x); t.kirli(); await kare(); }
      O.surukleBitir();
    }
    const surukle = Kit.tuval.olcumOzet();
    const a = performance.now(); t.srAyarla(t.kam.s * 1.6); t.yenidenCiz(); const yeniden = performance.now() - a;
    t.srAyarla(t.kam.s); t.yenidenCiz();
    const sonuc = { kare: surukle.n, ortMs: +surukle.ort.toFixed(2), p95Ms: +surukle.p95.toFixed(2), enMs: +surukle.en.toFixed(2), yenidenCizMs: +yeniden.toFixed(1), dpr: t.dpr };
    console.log('ölçüm', JSON.stringify(sonuc));
    KK.sayfa.duyur('Ölçüm: ' + JSON.stringify(sonuc));
    return sonuc;
  };

  function yonlendir() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('kendi=')) { const p = new URLSearchParams(h); try { return KK.oyun.ac(KK.kendi.resimden(p.get('kendi'), p.get('ad'), p.get('cizen')), { temiz: false }); } catch (e) { KK.sayfa.duyur('Bağlantıdaki resim okunamadı.'); } }
    if (h === 'ornek' && KK.ornek) return KK.ornek.ac();
    if (h === 'boyali' && KK.ornek) return KK.ornek.boyali();
    if (h.startsWith('resim=')) { const r = KK.resimler.bul(h.slice(6)); if (r) return KK.oyun.ac(r); }
    if (h === 'gunluk') return KK.gunluk.ac();
    if (h.startsWith('kilim=')) { const [boy, t] = h.slice(6).split('.'); return KK.defterler.kilimAc(+boy || 15, 'orta', +t || 214); }
    KK.defterler.ac();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla); else basla();
})();
