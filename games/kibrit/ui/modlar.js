// ui/modlar.js — modların denetçisi. Ortak tur sürücüsü: alıştırma kutusu + etkileşim + süre + bilgisayarın planı (çentikler, BULDU) +
// damgalar + ipuçları + puan. Modlar: Maç (varsayılan), Hepsini Bul, Boz ve Düzelt, Kitaplar, Sonsuz, Günün bulmacası, İki kişi.
// Kural: bilgisayarın çözümü (plan.gizli) yalnız tur bitince okunur; tur bitmeden hiçbir yerde çözüm gösterilmez.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const Mo = KB.model, So = KB.solver, Ai = KB.ai, D = KB.difficulty, Ra = KB.rating, G = KB.generator, C = KB.config;
  const $ = (id) => document.getElementById(id);
  const ses = (ad, g, arg) => { try { Kit.ses.cal(ad, g || 0, arg); } catch (e) { /* yoksay */ } };
  const bekle = (ms) => new Promise(r => setTimeout(r, ms));
  const M = KB.marj;

  const O = { mod: null, jeton: 0, tur: null, kutu: null, aralik: null, mac: null, son: null };
  KB.oyun = O;

  /* ================= ortak: tur ================= */
  function kutuHazirla(acik) {
    if (!O.kutu) O.kutu = Kit.kibrit.kutu($('kutu-yer'), { tohum: ['kutu'], acik: false });
    if (acik !== O.kutu.acik()) { if (acik) O.kutu.ac(); else O.kutu.kapa(); ses('cekmece'); }
  }
  const kategoriHak = (k) => (k === 'romen' || k === 'hepsini' || k === 'boz' ? 'tek' : k);
  const gecen = (tur) => (performance.now() - tur.t0) / 1000;

  function turTemizle() {
    const t = O.tur;
    if (t) { t.bitti = true; if (t.etk) t.etk.temizle(); }
    clearInterval(O.aralik); O.aralik = null;
    KB.kupur.isaretSil($('kenar-damga'));
    O.tur = null;
  }

  // Bir tur kur. o: { kayit, kategori, durum, rakip: { seviye, tohum } | null, sureS, talimat, alt, hepsini, boz, ogretici,
  //                   onCoz(tur, t), onAiBuldu(tur, t), onSure(tur), onPes(tur), onBoz(tur, durum), ipucuIzin, ceza }
  async function turKur(o) {
    turTemizle();
    const jeton = ++O.jeton;
    const kategori = o.kategori;
    const durum0 = o.durum || o.kayit.durum();
    const tur = { o, kayit: o.kayit, kategori, hakKat: kategoriHak(kategori), durum0: Mo.kopya(durum0), ipucu: 0, ceza: 0, denemeler: 0, bitti: false, jeton, t0: performance.now() };
    O.tur = tur;
    if (O.mod !== 'kitap') $('kitap-sayfa').hidden = true;
    $('defter').classList.toggle('tek-kisi', !o.rakip);
    $('rakip').hidden = !o.rakip;
    KB.sahne.olc({ tekKisi: !o.rakip });
    kupurCiz(tur, durum0);
    kutuHazirla(kategori === 'ekle' || kategori === 'cikar');
    if (o.rakip) rakipKur(tur);
    KB.sahne.ekAyarla();
    const h = Mo.hakOf(tur.hakKat);
    M.hamle(0, h.k, false);
    M.notlarTemizle('olmadi');
    tur.t0 = performance.now();
    clearInterval(O.aralik);
    O.aralik = setInterval(() => tik(tur), 100);
    tik(tur);
    ses('hisirti');
    KB.sahne.duyur(`Yeni bulmaca. ${tur.kupur.talimatEl.textContent} ${Mo.sesli(Mo.oku(durum0))}.`);
    return tur;
  }
  function kupurCiz(tur, durum, yigin) {
    const o = tur.o;
    const L = KB.sahne.L(durum.sablon.id);
    tur.kupur = KB.kupur.olustur($('kupur'), {
      kayit: o.kayit, durum, L, tohum: ['kupur', o.kayit ? o.kayit.kimlik : Mo.kanonikDize(tur.durum0)],
      kilavuz: KB.depo.kilavuz(KB.depo.ayar()), talimat: o.talimat, alt: o.alt, efsaneKap: $('rakamlar'),
    });
    if (L < KB.sahne.enAzL() - .5 && KB.sahne.O.duzen === 'dar') M.not('Bu bulmaca geniş: telefonu yan çevirirsen çöpler büyür.', { anahtar: 'genis', sure: 5000 });
    if (tur.etk) tur.etk.temizle();
    tur.etk = new KB.Etkilesim(tur.kupur, { kategori: tur.hakKat, kutuEl: $('kutu-yer'), degisti: (d, ek) => degisti(tur, d, ek) });
    tur.etk.bas = Mo.kopya(tur.durum0);
    if (yigin) tur.etk.yigin = yigin;
    if (tur.bitti) tur.etk.kilitle(true);
  }

  function degisti(tur, d) {
    if (tur.bitti || tur !== O.tur) return;
    const f = Mo.fark(tur.durum0, d), h = Mo.hamle(f, tur.hakKat);
    M.hamle(h.sayac, h.hak, h.asildi);
    const ok = Mo.oku(d), p = Mo.degerlendir(ok);
    KB.sahne.duyur(`${Mo.sesli(ok)}${ok.gecerli ? (p.dogru ? ', doğru' : ', yanlış') : ''}. Hamle ${h.sayac} / ${h.hak}.`);
    if (tur.o.boz) return tur.o.onBoz(tur, d, h, ok, p);
    if (!h.dolu) return;
    tur.denemeler++;
    if (tur.o.onDeneme) tur.o.onDeneme(tur, p.dogru);
    if (p.dogru) return tur.o.onCoz(tur, gecen(tur) + tur.ceza, ok.metin);
    M.not('olmadı', { kirmizi: true, sure: C.notSureMs, anahtar: 'olmadi' });
    KB.sahne.duyur('Olmadı: eşitlik yanlış.');
  }

  function tik(tur) {
    if (tur !== O.tur || tur.bitti) return;
    const t = gecen(tur);
    M.sure(t + tur.ceza, tur.o.sureS && t > tur.o.sureS - 10);
    if (tur.ai && !tur.ai.durdu) {
      const p = tur.ai.plan;
      let yeni = false;
      while (tur.ai.i < p.centikler.length && p.centikler[tur.ai.i] <= t) { tur.ai.i++; yeni = true; }
      if (yeni) { centikCiz(tur); ses('centik'); }
      if (tur.o.hepsini) {
        for (const c of p.gizli.cozumler) if (c.t <= t && !tur.ai.goruldu.has(c.metin)) { tur.ai.goruldu.add(c.metin); tur.o.onAiCozum(tur, c); }
      } else if (p.buldu !== null && t >= p.buldu) { tur.ai.durdu = true; return tur.o.onAiBuldu(tur, p.buldu); }
    }
    if (tur.o.sureS && t >= tur.o.sureS) return tur.o.onSure(tur);
  }

  /* ---------- bilgisayarın alıştırma kutusu ---------- */
  function rakipKur(tur) {
    const o = tur.o;
    const O2 = KB.sahne.O;
    const dar = O2.duzen === 'dar';
    const kart = $('rakip-kart');
    // açık defterde bilgisayarın kutusu seninkiyle aynı boyda (tur sonunda çözümler yan yana); telefonda yalnız ad ve çentikler
    kart.hidden = dar;
    tur.rakipKart = null;
    if (!dar) {
      const tohum = ['rakip', o.kayit ? o.kayit.kimlik : Mo.kanonikDize(tur.durum0)];
      tur.rakipKart = KB.kupur.olustur(kart, {
        kayit: o.kayit, durum: o.rakipDurum || tur.durum0, L: KB.sahne.L(tur.durum0.sablon.id), tohum, efsane: false,
        baslik: o.rakipBaslik || 'Bilgisayarın kopyası', talimat: o.rakipTalimat || 'Aynı bulmaca; bilgisayar burada arıyor.',
      });
      tur.rakipKart.sahne.svg.classList.add('kilitli');
    } else kart.innerHTML = '';
    $('rakip-ad').textContent = o.rakipAd || 'Bilgisayar';
    const s = $('centik'); s.innerHTML = ''; s.removeAttribute('width');
    $('rakip-durum').textContent = '';
    tur.ai = null;
    if (o.ogretici || !o.rakip.plan) return;
    tur.ai = { plan: o.rakip.plan, i: 0, durdu: false, goruldu: new Set() };
  }
  function centikCiz(tur) {
    const svg = $('centik');
    M.cetele(svg, tur.ai.i, ['centik', tur.jeton]);
    svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
    $('rakip-durum').textContent = `bilgisayar ${tur.ai.i} deneme yaptı`;
  }
  // Tur sonu: bilgisayar bulduysa kutusundaki çöpler gözünün önünde çözüme kayar ve kırmızı kalemle işaretlenir;
  // bulamadıysa kutunun altına kurşun kalemle not düşülür. Telefonda bilgisayarın kutusu yok: çözüm senin kutunda.
  async function rakipAc(tur, bayt, isaret) {
    const kart = tur.rakipKart || (bayt ? tur.kupur : null);
    if (!kart || (!bayt && !tur.ai)) return;          // ısınma turunda bilgisayar aramadı
    if (bayt) { kart.sahne.ipucuTemizle(); await kart.sahne.uygula(bayt, 560); }
    if (tur !== O.tur) return;
    if (isaret) { ses('damga'); kart.damga(tur.rakipKart ? isaret : 'bilgisayar ' + isaret); }
    else if (tur.rakipKart) tur.rakipKart.altEl.textContent = bayt ? '' : 'bulamadı';
  }

  /* ---------- çözüm gösterme ---------- */
  function cozumBayt(durum, hakKat) {
    const c = So.coz(durum, Mo.hakOf(hakKat));
    if (!c.length) return null;
    const v = c[0].varyantlar.find(x => Mo.kanonikMi({ sablon: durum.sablon, bayt: x.bayt })) || c[0].varyantlar[0];
    return { bayt: v.bayt, metin: c[0].metin, hamleler: v.hamleler, hepsi: c.map(x => x.metin) };
  }
  async function cozumGoster(tur) {
    const c = cozumBayt(tur.durum0, tur.hakKat);
    if (!c) return;
    tur.kupur.sahne.ipucuTemizle();
    await tur.kupur.sahne.uygula(c.bayt, 420);
    return c;
  }

  /* ---------- ipucu: hücre → çöp → çözüm ---------- */
  async function ipucu() {
    const tur = O.tur;
    if (!tur || tur.bitti || !tur.o.ipucuIzin) return;
    const c = tur.cozum || (tur.cozum = cozumBayt(tur.durum0, tur.hakKat));
    if (!c) return;
    tur.ipucu++;
    if (tur.o.ceza) { tur.ceza += tur.o.ceza; M.not(`ipucu: +${tur.o.ceza} sn`, { kirmizi: true, sure: 2400, anahtar: 'ceza' }); }
    const s = tur.kupur.sahne;
    s.ipucuTemizle();
    if (tur.ipucu === 1) {
      const hucreler = new Set();
      c.hamleler.forEach(h => { if (h.den !== null) hucreler.add(h.den >> 3); if (h.ye !== null) hucreler.add(h.ye >> 3); });
      hucreler.forEach(hc => s.ipucuHucre(hc));
      M.not('İpucu 1: değişecek hücre işaretli.', { sure: 4000, anahtar: 'ipucu' });
      KB.sahne.duyur('İpucu: değişecek hücreler ' + [...hucreler].map(x => KB.kupur.HUCRE_AD(tur.durum0.sablon, x)).join(', '));
    } else if (tur.ipucu === 2) {
      // çöp başlangıçtaki yerinde işaretlenir; oyuncu oynattıysa önce başa dönülür
      if (Mo.maske(tur.etk.durum()) !== Mo.maske(tur.durum0)) await tur.etk.bastan();
      c.hamleler.forEach(h => { if (h.den !== null) s.ipucuCop(h.den); if (h.ye !== null) s.ipucuYuva(h.ye); });
      M.not('İpucu 2: oynayacak çöp ve gideceği yuva işaretli.', { sure: 4000, anahtar: 'ipucu' });
      KB.sahne.duyur('İpucu: ' + c.hamleler.map(h => `${h.den !== null ? KB.kupur.yuvaAdi(tur.durum0.sablon, h.den) : 'kutu'} → ${h.ye !== null ? KB.kupur.yuvaAdi(tur.durum0.sablon, h.ye) : 'kutu'}`).join('; '));
    } else {
      M.not('İpucu 3: çözüm gösterildi.', { anahtar: 'ipucu' });
      if (tur.o.onPes) tur.o.onPes(tur, { ipucu: true });
    }
  }

  /* ---------- puan ---------- */
  function puanGuncelle(kayit, s, sureS, ek = {}) {
    const oy = KB.depo.oyuncu();
    const once = oy.puan;
    oy.puan = Ra.guncelle(oy.puan, kayit.puan, s);
    oy.oynanan++;
    KB.depo.oyuncuYaz(oy);
    KB.depo.gecmisEkle({ kimlik: kayit.kimlik, s, t: Math.round(sureS * 10) / 10, k: kayit.kategori, tarih: Mo.yerelTarih(), ...ek });
    M.puan(oy.puan);
    const d = oy.puan - once;
    if (d) M.not(`puan ${d > 0 ? '+' : '−'}${Math.abs(d)}`, { sure: 3200, anahtar: 'puan', kirmizi: d < 0 });
    return oy;
  }

  /* ---------- komutlar ---------- */
  function komutlar(goster, yeniAd) { M.komutlar(goster, yeniAd); }
  function sonrakiGoster(metin, f) {
    const b = $('k-sonraki');
    b.querySelector('.yazi').textContent = metin; b.querySelector('.yazi').dataset.metin = metin; delete b.querySelector('.yazi').dataset.cizili;
    O.sonraki = f;
    b.hidden = false;
    M.ciz(true);
    M.vurgula('k-sonraki', true);
    setTimeout(() => { if (!b.hidden) b.focus({ preventScroll: true }); }, 50);
  }
  function sonrakiGizle() { $('k-sonraki').hidden = true; O.sonraki = null; M.ciz(true); }
  function baslikNotu(metin) { $('mod-notu').textContent = metin; }

  KB.modlar = {
    O, turKur, turTemizle, kupurCiz, degisti, tik, rakipAc, cozumBayt, cozumGoster, ipucu, puanGuncelle,
    komutlar, sonrakiGoster, sonrakiGizle, baslikNotu, kutuHazirla, gecen, kategoriHak, bekle, ses, centikCiz,
  };
})();

/* ================= modlar ================= */
(function () {
  'use strict';
  const KB = window.KB;
  const Mo = KB.model, So = KB.solver, Ai = KB.ai, D = KB.difficulty, Ra = KB.rating, G = KB.generator, C = KB.config;
  const X = KB.modlar, O = X.O, M = KB.marj;
  const $ = (id) => document.getElementById(id);
  const { ses, bekle } = X;
  const K = KB.kupur;
  const sevAd = (s) => Ai.SEVIYE[s].ad;

  /* ---------- Maç ---------- */
  const Mac = {
    async basla() {
      X.turTemizle();
      const a = KB.depo.ayar();
      O.mod = 'mac';
      O.mac = { n: a.macTur, seviye: a.seviye, i: 0, skor: [0, 0], sure: [0, 0], tohum: Math.floor(Math.random() * 1e9), ipucu: a.macIpucu, ogretici: !KB.depo.ogretici(), bitti: false };
      X.baslikNotu(`Maç · ${a.macTur} tur · ${sevAd(a.seviye)}`);
      M.kur({ cetele: ['Sen', 'Bilgisayar'], sure: true, tur: true, puan: true, hamle: true });
      M.ceteleYaz(0, 0, 'Sen'); M.ceteleYaz(1, 0, 'Bilgisayar');
      M.puan(KB.depo.oyuncu().puan);
      M.notlarTemizle();
      M.gecmisKur('Maç defteri');
      X.komutlar({ 'k-ipucu': true, 'k-pes': true }, 'Yeni maç');
      await Mac.tur();
    },
    async tur() {
      const mac = O.mac;
      X.sonrakiGizle();
      M.notlarTemizle();
      const ogr = mac.ogretici;
      M.tur(ogr ? 0 : mac.i + 1, mac.n);
      const r = Mo.rng(['mac', mac.tohum, mac.i, ogr ? 1 : 0]);
      let kat = 'tek';
      if (!ogr && (C.mac.ozelTur[mac.n] || []).includes(mac.i)) kat = ['iki', 'ekle', 'cikar'][Math.floor(r() * 3)];
      const R = KB.depo.oyuncu().puan;
      const hedef = ogr ? Math.min(R - 150, 850) : Ra.turHedefi(R, mac.i, mac.n);
      const kayit = await KB.havuz.sec({ kategori: kat, hedef, r, tohum: mac.tohum + mac.i });
      if (!kayit) return M.not('Bulmaca bulunamadı.', { kirmizi: true });
      const plan = ogr ? null : Ai.plan(kayit.durum(), { kategori: kat, seviye: mac.seviye, tohum: Mo.karma('plan', mac.tohum, mac.i) });
      $('k-ipucu').hidden = !(mac.ipucu || ogr); M.ciz(true);
      const tur = await X.turKur({
        kayit, kategori: kat, rakip: { seviye: mac.seviye, plan }, sureS: ogr ? null : C.mac.sureS, ogretici: ogr, rakipAd: ogr ? 'Bilgisayar bekliyor' : null,
        ipucuIzin: mac.ipucu || ogr, ceza: ogr ? 0 : (mac.ipucu ? C.mac.ipucuCezaS : 0),
        onCoz: Mac.cozdu, onAiBuldu: Mac.aiBuldu, onSure: Mac.sureDoldu, onPes: Mac.pes,
      });
      if (ogr) Mac.ogretici(tur);
    },
    async ogretici(tur) {
      const notlar = [
        'Isınma turu: bilgisayar bekliyor.',
        'Bir çöpü sürükle; ya da çöpe dokun, sonra boş bir yuvaya dokun.',
        'Hamle hakkın dolunca eşitlik kendiliğinden kontrol edilir.',
        'Maçta bilgisayar aynı bulmacayı kendi kopyasında arar; her denemesi bir çentik. Önce çözen turu alır.',
      ];
      for (let i = 0; i < notlar.length; i++) {
        if (tur !== O.tur || tur.bitti) return;
        M.not(notlar[i], { anahtar: 'ogr' + i });
        await bekle(2600);
      }
    },
    cozdu(tur, t, metin) {
      if (tur.bitti) return;
      const mac = O.mac;
      const plan = tur.ai && tur.ai.plan;
      if (plan && plan.buldu !== null && plan.buldu <= t) return Mac.aiBuldu(tur, plan.buldu);
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Çözüldü'); ses('damga');
      KB.sahne.duyur(`Çözdün: ${Mo.sesli(Mo.oku(tur.etk.durum()))}. ${Math.round(t)} saniye.`);
      if (tur.o.ogretici) {
        KB.depo.ogreticiBitti(); mac.ogretici = false;
        M.not('Güzel. Şimdi maç başlıyor.', { anahtar: 'ogr-son' });
        X.rakipAc(tur, null, null);
        return X.sonrakiGoster('maça başla', () => Mac.tur());
      }
      mac.skor[0]++; mac.sure[0] += t; mac.sure[1] += C.mac.sureS;
      M.ceteleYaz(0, mac.skor[0], 'Sen');
      M.gecmisEkle({ no: `${mac.i + 1}. tur`, ne: `sen · <span class="matbaa">${Mo.gorunum(metin || Mo.oku(tur.etk.durum()).metin)}</span>`, sure: M.sureMetin(t), sinif: 'kazandi' });
      X.puanGuncelle(tur.kayit, Ra.sonuc(t, tur.kayit.bant, { ipucu: tur.ipucu }), t);
      X.rakipAc(tur, null, null);
      $('rakip-durum').textContent = 'bilgisayar bulamadı';
      Mac.sonu(tur);
    },
    async aiBuldu(tur, t) {
      if (tur.bitti) return;
      const mac = O.mac;
      tur.bitti = true; tur.etk.kilitle(true);
      KB.sahne.duyur(`Bilgisayar buldu, ${Math.round(t)} saniyede.`);
      mac.skor[1]++; mac.sure[1] += t; mac.sure[0] += C.mac.sureS;
      M.ceteleYaz(1, mac.skor[1], 'Bilgisayar');
      X.puanGuncelle(tur.kayit, 0, t);
      await X.rakipAc(tur, tur.ai.plan.gizli.bayt, 'buldu');
      if (tur !== O.tur) return;
      M.not(`Bilgisayarın çözümü: ${Mo.gorunum(tur.ai.plan.gizli.metin)}`, { anahtar: 'cozum' });
      M.gecmisEkle({ no: `${mac.i + 1}. tur`, ne: `bilgisayar · <span class="matbaa">${Mo.gorunum(tur.ai.plan.gizli.metin)}</span>`, sure: M.sureMetin(t), sinif: 'kaybetti' });
      Mac.sonu(tur);
    },
    async sureDoldu(tur) {
      if (tur.bitti) return;
      const mac = O.mac;
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Süre doldu'); ses('damga');
      mac.sure[0] += C.mac.sureS; mac.sure[1] += C.mac.sureS;
      X.puanGuncelle(tur.kayit, 0, C.mac.sureS);
      M.not('Tur boş geçti.', { anahtar: 'cozum' });
      M.gecmisEkle({ no: `${mac.i + 1}. tur`, ne: 'boş geçti · süre doldu', sure: '' });
      KB.sahne.duyur('Süre doldu, tur boş geçti. Çözüm gösteriliyor.');
      await X.cozumGoster(tur);
      X.rakipAc(tur, null, null);
      Mac.sonu(tur);
    },
    async pes(tur, o = {}) {
      if (tur.bitti) return;
      if (tur.o.ogretici) {
        tur.bitti = true; tur.etk.kilitle(true);
        await X.cozumGoster(tur);
        KB.depo.ogreticiBitti(); O.mac.ogretici = false;
        return X.sonrakiGoster('maça başla', () => Mac.tur());
      }
      const plan = tur.ai && tur.ai.plan;
      if (plan && plan.buldu !== null) {
        // bilgisayar 90 saniye içinde bulacaktı: çentikler hızla tamamlanır
        tur.ai.i = plan.centikler.length; X.centikCiz(tur);
        await X.cozumGoster(tur);
        return Mac.aiBuldu(tur, plan.buldu);
      }
      tur.bitti = true; tur.etk.kilitle(true);
      O.mac.sure[0] += C.mac.sureS; O.mac.sure[1] += C.mac.sureS;
      X.puanGuncelle(tur.kayit, 0, C.mac.sureS);
      await X.cozumGoster(tur);
      M.not(o.ipucu ? 'Çözüm gösterildi.' : 'Pes ettin; tur boş geçti.', { anahtar: 'cozum' });
      M.gecmisEkle({ no: `${O.mac.i + 1}. tur`, ne: 'boş geçti · pes', sure: '' });
      X.rakipAc(tur, null, null);
      Mac.sonu(tur);
    },
    sonu() {
      const mac = O.mac;
      mac.i++;
      if (mac.i >= mac.n) return Mac.bitti();
      X.sonrakiGoster('sonraki tur', () => Mac.tur());
    },
    bitti() {
      const mac = O.mac;
      mac.bitti = true;
      let sonuc;
      if (mac.skor[0] !== mac.skor[1]) sonuc = mac.skor[0] > mac.skor[1] ? 'sen' : 'o';
      else if (Math.abs(mac.sure[0] - mac.sure[1]) >= .05) sonuc = mac.sure[0] < mac.sure[1] ? 'sen' : 'o';
      else sonuc = 'berabere';
      const metin = sonuc === 'sen' ? 'Maç senin' : sonuc === 'o' ? 'Maç bilgisayarın' : 'Berabere';
      sonDamga(metin);
      if (mac.skor[0] === mac.skor[1]) M.not(`Eşit skor; toplam süre: sen ${M.sureMetin(mac.sure[0])}, bilgisayar ${M.sureMetin(mac.sure[1])}.`, { anahtar: 'mac-son' });
      M.gecmisEkle({ no: 'sonuç', ne: `${metin.toLocaleLowerCase('tr-TR')} · ${mac.skor[0]}–${mac.skor[1]}`, sure: '', sinif: sonuc === 'sen' ? 'kazandi' : sonuc === 'o' ? 'kaybetti' : '' });
      KB.depo.macEkle({ tarih: Mo.yerelTarih(), n: mac.n, seviye: mac.seviye, skor: mac.skor, sure: mac.sure.map(x => Math.round(x)), sonuc });
      KB.sahne.duyur(`${metin}. Skor ${mac.skor[0]}–${mac.skor[1]}.`);
      X.sonrakiGoster('rövanş', () => Mac.basla());
    },
  };
  // Maç sonu: senin sayfana, notlarla efsane arasındaki boşluğa kırmızı kalemle büyük yazı (yer yoksa efsanenin üstüne)
  function sonDamga(metin) {
    const kap = $('kenar-damga');
    KB.kupur.isaretSil(kap);
    const dar = document.body.dataset.duzen === 'dar';
    const kr = kap.getBoundingClientRect(), alt = document.querySelector('#oyun-alani > .oyun-alt').getBoundingClientRect();
    const ef = $('rakamlar').getBoundingClientRect();
    const bant = ef.top - alt.bottom, sigar = bant > (dar ? 80 : 90);
    const y = (sigar ? (alt.bottom + ef.top) / 2 : ef.top + ef.height / 2) - kr.top;
    const x = alt.left + alt.width / 2 - kr.left;
    const boyut = dar ? 34 : sigar ? Math.max(34, Math.min(52, bant * .48)) : 46;
    KB.kupur.isaret(kap, metin + '!', { x, y, boyut, kalin: 2.6, tohum: ['son', metin, Date.now() % 97], aci: -5 });
    ses('damga');
  }


  /* ---------- Hepsini Bul ---------- */
  const Hep = {
    async basla() {
      X.turTemizle();
      O.mod = 'hepsini';
      const a = KB.depo.ayar();
      X.baslikNotu(`Hepsini Bul · ${C.hepsini.sureS} saniye · ${sevAd(a.seviye)}`);
      X.komutlar({ 'k-ipucu': false, 'k-pes': true }, 'Yeni bulmaca');
      await Hep.tur();
    },
    async tur() {
      X.sonrakiGizle();
      const a = KB.depo.ayar();
      M.kur({ cetele: ['Sen', 'Bilgisayar'], sure: true, cozum: true, puan: true, hamle: true });
      M.ceteleYaz(0, 0, 'Sen'); M.ceteleYaz(1, 0, 'Bilgisayar'); M.puan(KB.depo.oyuncu().puan);
      M.notlarTemizle();
      const tohum = Math.floor(Math.random() * 1e9);
      const r = Mo.rng(['hep', tohum]);
      const kayit = await KB.havuz.sec({ kategori: 'hepsini', hedef: KB.depo.oyuncu().puan, r, tohum });
      if (!kayit) return;
      const durum = kayit.durum();
      const tum = So.coz(durum, { k: 1 }).map(g => g.metin);
      const plan = Ai.plan(durum, { kategori: 'tek', seviye: a.seviye, tohum, hepsini: true, sureS: C.hepsini.sureS });
      const tur = await X.turKur({
        kayit, kategori: 'hepsini', rakip: { seviye: a.seviye, plan }, sureS: C.hepsini.sureS, hepsini: true,
        talimat: `${K.TALIMAT.hepsini} Bu bulmacanın <b>${tum.length} çözümü</b> var.`,
        onCoz: Hep.buldu, onAiCozum: Hep.ai, onSure: Hep.bitti, onPes: Hep.bitti,
      });
      tur.hep = { tum, sen: new Set(), o: new Set(), ilk: {}, puan: [0, 0] };
      M.cozum(0, tum.length);
      M.gecmisKur('Bulunan çözümler');
      $('rakip-ad').textContent = 'Bilgisayar · 0 çözüm';
    },
    buldu(tur, t, metin) {
      const h = tur.hep;
      if (h.sen.has(metin)) { M.not('Bunu bulmuştun.', { sure: 1800, anahtar: 'olmadi' }); return tur.etk.sifirla(); }
      h.sen.add(metin); h.puan[0]++;
      let ilk = false;
      if (!h.ilk[metin]) { h.ilk[metin] = 'sen'; h.puan[0]++; ilk = true; }
      M.ceteleYaz(0, h.puan[0], 'Sen');
      M.cozum(h.sen.size, h.tum.length);
      M.gecmisEkle({ no: 'sen', ne: `<span class="matbaa">${Mo.gorunum(metin)}</span>${ilk ? ' · ilk' : ''}`, sure: M.sureMetin(t), sinif: 'kazandi' });
      ses('damga', 0);
      KB.sahne.duyur(`Bir çözüm buldun: ${metin}. ${h.sen.size} / ${h.tum.length}.`);
      if (h.sen.size === h.tum.length) return Hep.bitti(tur);
      setTimeout(() => { if (!tur.bitti) { tur.etk.sifirla(); M.hamle(0, 1, false); } }, 650);
    },
    ai(tur, c) {
      const h = tur.hep;
      h.o.add(c.metin); h.puan[1]++;
      if (!h.ilk[c.metin]) { h.ilk[c.metin] = 'o'; h.puan[1]++; }
      M.ceteleYaz(1, h.puan[1], 'Bilgisayar');
      $('rakip-ad').textContent = `Bilgisayar · ${h.o.size} çözüm`;
      $('rakip-durum').textContent = `bilgisayar ${h.o.size} çözüm buldu`;
      if (h.o.size === h.tum.length) tur.ai.durdu = true;
    },
    async bitti(tur) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      const h = tur.hep;
      M.notlarTemizle();
      M.gecmisKur('Bütün çözümler');
      for (const m of h.tum) {
        const kim = [h.sen.has(m) ? 'sen' : null, h.o.has(m) ? 'bilgisayar' : null].filter(Boolean).join(' · ') || 'kimse';
        const ilk = h.ilk[m] ? `ilk: ${h.ilk[m] === 'sen' ? 'sen' : 'bilgisayar'}` : '';
        M.gecmisEkle({ no: kim, ne: `<span class="matbaa">${Mo.gorunum(m)}</span>`, sure: ilk, sinif: h.ilk[m] === 'sen' ? 'kazandi' : h.ilk[m] === 'o' ? 'kaybetti' : '' });
      }
      if (h.sen.size < h.tum.length) tur.kupur.damga('Süre doldu');
      X.rakipAc(tur, null, null);
      const sonuc = h.puan[0] === h.puan[1] ? 'Berabere' : h.puan[0] > h.puan[1] ? 'Maç senin' : 'Maç bilgisayarın';
      M.not(`Puan: sen ${h.puan[0]}, bilgisayar ${h.puan[1]}.`, { anahtar: 'hep-son' });
      sonDamga(sonuc);
      KB.sahne.duyur(`${sonuc}. Sen ${h.puan[0]}, bilgisayar ${h.puan[1]} puan.`);
      X.sonrakiGoster('yeni bulmaca', () => Hep.tur());
    },
  };

  /* ---------- Boz ve Düzelt (bilgisayara karşı) ---------- */
  function dogruEsitlikSec(r, sigar) {
    const sablonlar = Mo.SABLONLAR.filter(id => sigar(id) && Mo.sablon(id).hucreSayisi <= 8);
    for (let i = 0; i < 80; i++) {
      const id = sablonlar[Math.floor(r() * sablonlar.length)];
      const d = G.rastgeleEsitlik(id, r, 80);
      if (!d) continue;
      const b = Ai.bozmalar(d);
      if (b.length >= 3 && b.some(x => So.cozumSayisi(x, { k: 1 }) === 1)) return d;
    }
    return Mo.yaz('1+1=2', '5+3=8');
  }
  const bozKayit = (d, z) => {
    const kimlik = Mo.kanonikDize(d);
    return { kimlik, puan: z ? z.puan : 1000, bant: z ? z.bant : 'orta', kategori: 'tek', no: KB.havuz.noOf(kimlik), durum: () => Mo.kopya(d) };
  };
  function bozKontrol(tur, d, h, ok, p) {
    if (tur.bozuldu) return;
    if (!h.dolu) { if (h.asildi) M.not('Yalnız bir çöp oynatılır; geri al.', { kirmizi: true, sure: 2400, anahtar: 'olmadi' }); return null; }
    if (!ok.gecerli) { M.not('Geçersiz: rakamlar böyle yazılmaz.', { kirmizi: true, sure: 2400, anahtar: 'olmadi' }); return null; }
    if (p.dogru) { M.not('Bu da doğru bir eşitlik; başka bir çöp dene.', { kirmizi: true, sure: 2600, anahtar: 'olmadi' }); return null; }
    return d;
  }
  const Boz = {
    async basla() {
      X.turTemizle();
      O.mod = 'boz';
      const a = KB.depo.ayar();
      O.boz = { n: C.boz.tur, i: 0, skor: [0, 0], sure: [0, 0], tohum: Math.floor(Math.random() * 1e9), seviye: a.seviye };
      X.baslikNotu(`Boz ve Düzelt · ${C.boz.tur} tur · ${sevAd(a.seviye)}`);
      M.kur({ cetele: ['Sen', 'Bilgisayar'], sure: true, tur: true, puan: true, hamle: true });
      M.ceteleYaz(0, 0, 'Sen'); M.ceteleYaz(1, 0, 'Bilgisayar'); M.puan(KB.depo.oyuncu().puan);
      M.gecmisKur('Maç defteri');
      X.komutlar({ 'k-ipucu': false, 'k-pes': true }, 'Yeni maç');
      await Boz.tur();
    },
    async tur() {
      const B = O.boz;
      X.sonrakiGizle();
      M.notlarTemizle();
      M.tur(B.i + 1, B.n);
      const r = Mo.rng(['boz', B.tohum, B.i]);
      KB.sahne.olc({ tekKisi: false });
      const d = dogruEsitlikSec(r, KB.sahne.sigar);
      const tur = await X.turKur({
        kayit: bozKayit(d), kategori: 'boz', durum: d, rakip: { seviye: B.seviye, plan: null }, ogretici: true,
        talimat: K.TALIMAT.boz, rakipTalimat: 'Bilgisayar da aynı eşitliği bozuyor.', rakipBaslik: 'Bilgisayarın kopyası', boz: true,
        onBoz: (t, dd, h, ok, p) => Boz.oyuncuBozdu(t, dd, h, ok, p), onPes: () => Boz.pesBoz(),
      });
      M.sure(0);
      clearInterval(O.aralik);            // bozma süresiz
      $('rakip-durum').textContent = 'bilgisayar bozuyor';
      M.not('İkiniz de aynı doğru eşitliği tek çöple bozuyorsunuz.', { anahtar: 'boz' });
      const [a, b] = C.boz.dusunmeMs;
      setTimeout(() => {
        if (tur !== O.tur) return;
        tur.aiBozma = Ai.bozmaSec(d, B.seviye, r);
        $('rakip-ad').textContent = 'Bilgisayar · bozdu';
        if (tur.rakipKart) tur.rakipKart.damga('bozdu', { boyut: 22 });
        ses('koy');
        if (tur.oyuncuBozma) Boz.duzelt(tur);
      }, a + r() * (b - a));
    },
    oyuncuBozdu(tur, d, h, ok, p) {
      const kabul = bozKontrol(tur, d, h, ok, p);
      if (!kabul) return;
      tur.bozuldu = true;
      tur.oyuncuBozma = Mo.kopya(kabul);
      tur.etk.kilitle(true);
      tur.kupur.damga('Bozuldu', { boyut: 26 });
      ses('damga');
      M.not('Bozdun. Sıra düzeltmede.', { anahtar: 'boz' });
      if (tur.aiBozma) setTimeout(() => Boz.duzelt(tur), 900);
      else M.not('Bilgisayar bozmayı bitirmedi…', { anahtar: 'boz-bekle', sure: 3000 });
    },
    pesBoz() { /* bozma aşamasında pes yok */ },
    async duzelt(onceki) {
      if (onceki !== O.tur) return;
      const B = O.boz;
      const aiB = onceki.aiBozma, senB = onceki.oyuncuBozma;
      const z = D.hesapla(aiB, 'tek');
      const plan = Ai.plan(senB, { kategori: 'tek', seviye: B.seviye, tohum: Mo.karma('bozplan', B.tohum, B.i) });
      const nSen = So.cozumSayisi(senB, { k: 1 }), nO = So.cozumSayisi(aiB, { k: 1 });
      await bekle(400);
      const tur = await X.turKur({
        kayit: bozKayit(aiB, z), kategori: 'tek', durum: aiB, rakip: { seviye: B.seviye, plan }, rakipDurum: senB,
        sureS: C.boz.sureS, talimat: 'Bilgisayarın bozduğu eşitliği tek çöple düzeltin.', rakipTalimat: 'Senin bozduğun eşitliği düzeltmeye çalışıyor.', rakipBaslik: 'Bilgisayar düzeltiyor',
        onCoz: Boz.cozdu, onAiBuldu: Boz.aiBuldu, onSure: Boz.sureDoldu, onPes: Boz.pes,
      });
      tur.nSen = nSen; tur.nO = nO;
      M.not('Değiş tokuş: sen onunkini, o seninkini düzeltiyor.', { anahtar: 'boz' });
    },
    notYaz(tur, kim, t) {
      M.not(`Senin bozmanın ${tur.nSen} çözümü vardı; onunkinin ${tur.nO}.`, { anahtar: 'boz-son' });
      M.gecmisEkle({ no: `${O.boz.i + 1}. tur`, ne: kim === 'sen' ? 'sen düzelttin' : kim === 'o' ? 'bilgisayar düzeltti' : 'kimse düzeltemedi', sure: t ? M.sureMetin(t) : '', sinif: kim === 'sen' ? 'kazandi' : kim === 'o' ? 'kaybetti' : '' });
    },
    cozdu(tur, t) {
      if (tur.bitti) return;
      const B = O.boz, plan = tur.ai.plan;
      if (plan.buldu !== null && plan.buldu <= t) return Boz.aiBuldu(tur, plan.buldu);
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Çözüldü'); ses('damga');
      B.skor[0]++; B.sure[0] += t; B.sure[1] += C.boz.sureS;
      M.ceteleYaz(0, B.skor[0], 'Sen');
      X.puanGuncelle(tur.kayit, Ra.sonuc(t, tur.kayit.bant), t);
      X.rakipAc(tur, null, null);
      Boz.notYaz(tur, 'sen', t); Boz.sonu();
    },
    async aiBuldu(tur, t) {
      if (tur.bitti) return;
      const B = O.boz;
      tur.bitti = true; tur.etk.kilitle(true);
      B.skor[1]++; B.sure[1] += t; B.sure[0] += C.boz.sureS;
      M.ceteleYaz(1, B.skor[1], 'Bilgisayar');
      X.puanGuncelle(tur.kayit, 0, t);
      await X.rakipAc(tur, tur.ai.plan.gizli.bayt, 'buldu');
      if (tur !== O.tur) return;
      Boz.notYaz(tur, 'o', t); Boz.sonu();
    },
    async sureDoldu(tur) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Süre doldu'); ses('damga');
      O.boz.sure[0] += C.boz.sureS; O.boz.sure[1] += C.boz.sureS;
      X.puanGuncelle(tur.kayit, 0, C.boz.sureS);
      await X.cozumGoster(tur);
      X.rakipAc(tur, null, null);
      Boz.notYaz(tur, null); Boz.sonu();
    },
    async pes(tur) {
      if (tur.bitti) return;
      const plan = tur.ai && tur.ai.plan;
      if (plan && plan.buldu !== null) { tur.ai.i = plan.centikler.length; X.centikCiz(tur); await X.cozumGoster(tur); return Boz.aiBuldu(tur, plan.buldu); }
      return Boz.sureDoldu(tur);
    },
    sonu() {
      const B = O.boz;
      B.i++;
      if (B.i < B.n) return X.sonrakiGoster('sonraki tur', () => Boz.tur());
      let sonuc;
      if (B.skor[0] !== B.skor[1]) sonuc = B.skor[0] > B.skor[1] ? 'Maç senin' : 'Maç bilgisayarın';
      else if (Math.abs(B.sure[0] - B.sure[1]) >= .05) sonuc = B.sure[0] < B.sure[1] ? 'Maç senin' : 'Maç bilgisayarın';
      else sonuc = 'Berabere';
      sonDamga(sonuc);
      X.sonrakiGoster('rövanş', () => Boz.basla());
    },
  };

  /* ---------- Sonsuz ---------- */
  const Sonsuz = {
    async basla() {
      X.turTemizle();
      O.mod = 'sonsuz';
      X.baslikNotu('Sonsuz · puanına göre sıradaki');
      M.kur({ seri: true, sure: true, puan: true, hamle: true });
      M.seri(KB.depo.oyuncu().seri || 0); M.puan(KB.depo.oyuncu().puan);
      M.notlarTemizle();
      M.gecmisKur('Son bulmacalar');
      X.komutlar({ 'k-ipucu': true, 'k-pes': true }, 'Yeni bulmaca');
      const KAT = { tek: 'tek çöp', iki: 'iki çöp', ekle: 'ekle', cikar: 'çıkar', hepsini: 'hepsini bul', romen: 'romen' };
      KB.depo.gecmis().slice(-8).forEach(x => M.gecmisEkle({ no: x.tarih ? Mo.tarihYazi(x.tarih) : '', ne: `${KAT[x.k] || ''} · ${x.s > 0 ? 'çözdün' : 'çözülmedi'}`, sure: x.s > 0 ? M.sureMetin(x.t) : '', sinif: x.s > 0 ? 'kazandi' : 'kaybetti', basa: true }));
      await Sonsuz.sonraki();
    },
    async sonraki() {
      X.sonrakiGizle();
      M.notlarTemizle('olmadi');
      const oy = KB.depo.oyuncu();
      const r = Mo.rng(['sonsuz', Date.now()]);
      let x = r(), kat = 'tek';
      for (const [k, p] of Object.entries(C.sonsuz.karisim)) { if (x < p) { kat = k; break; } x -= p; }
      const hedef = oy.puan - 100 + Math.round(r() * 250);
      const kayit = await KB.havuz.sec({ kategori: kat, hedef, r, tohum: Date.now() });
      if (!kayit) return;
      await X.turKur({ kayit, kategori: kat, rakip: null, ipucuIzin: true, onCoz: Sonsuz.cozdu, onPes: Sonsuz.pes });
    },
    cozdu(tur, t) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Çözüldü'); ses('damga');
      const s = Ra.sonuc(t, tur.kayit.bant, { ipucu: tur.ipucu });
      const oy = X.puanGuncelle(tur.kayit, s, t);
      oy.seri = (oy.seri || 0) + 1; oy.enIyiSeri = Math.max(oy.enIyiSeri || 0, oy.seri);
      KB.depo.oyuncuYaz(oy); M.seri(oy.seri);
      M.gecmisEkle({ no: 'şimdi', ne: `<span class="matbaa">${Mo.gorunum(Mo.oku(tur.etk.durum()).metin)}</span>`, sure: M.sureMetin(t), sinif: 'kazandi', basa: true });
      KB.sahne.duyur(`Çözdün, ${Math.round(t)} saniye. Seri ${oy.seri}.`);
      X.sonrakiGoster('sonraki bulmaca', () => Sonsuz.sonraki());
    },
    async pes(tur, o = {}) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      const oy = X.puanGuncelle(tur.kayit, 0, X.gecen(tur));
      oy.seri = 0; KB.depo.oyuncuYaz(oy); M.seri(0);
      const c = await X.cozumGoster(tur);
      M.gecmisEkle({ no: 'şimdi', ne: `pes · <span class="matbaa">${c ? Mo.gorunum(c.metin) : ''}</span>`, sure: '', sinif: 'kaybetti', basa: true });
      M.not(o.ipucu ? 'Çözüm gösterildi; seri sıfırlandı.' : 'Pes ettin; seri sıfırlandı.', { anahtar: 'cozum' });
      X.sonrakiGoster('sonraki bulmaca', () => Sonsuz.sonraki());
    },
  };

  KB.modlar.Mac = Mac; KB.modlar.Hep = Hep; KB.modlar.Boz = Boz; KB.modlar.Sonsuz = Sonsuz;
  KB.modlar.sonDamga = sonDamga; KB.modlar.bozKontrol = bozKontrol; KB.modlar.dogruEsitlikSec = dogruEsitlikSec; KB.modlar.bozKayit = bozKayit;
})();

/* ================= Kitaplar, Günün bulmacası, İki kişi ================= */
(function () {
  'use strict';
  const KB = window.KB;
  const Mo = KB.model, So = KB.solver, Ai = KB.ai, D = KB.difficulty, Ra = KB.rating, G = KB.generator, C = KB.config;
  const X = KB.modlar, O = X.O, M = KB.marj;
  const $ = (id) => document.getElementById(id);
  const { ses, bekle } = X;
  const K = KB.kupur;
  const h = (ad, sinif, eb, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin !== undefined) e.textContent = metin; if (eb) eb.appendChild(e); return e; };
  function sozcuk(eb, metin, f, sinif) {
    const b = h('button', 'dugme sozcuk' + (sinif ? ' ' + sinif : ''), eb);
    b.type = 'button';
    const y = h('span', 'yazi', b, metin);
    void y;
    b.addEventListener('click', f);
    requestAnimationFrame(() => { Kit.kalem.harfle(b.querySelector('.yazi'), metin, { tohum: ['s', metin], anlik: true }); Kit.kalem.dugmeAltiCiz(b, 0, true, { stroke: '#4a4a4a', strokeWidth: 1.2 }); });
    return b;
  }
  // Kalem notları (Modlar, Ayarlar, Kitaplar, İki kişi devri) ekranın ortasında, arkada hafif gölgeyle. Açılınca odak notun
  // ilk düğmesine geçer, son not kapanınca açan düğmeye döner.
  const NOTLAR = ['modlar', 'ayarlar', 'kitaplar', 'devir'];
  let notAcan = null;
  const acikNot = () => NOTLAR.find(x => !$(x).hidden) || null;
  function notAc(id) {
    if (!acikNot()) notAcan = document.activeElement;
    NOTLAR.forEach(x => { if (x !== id) $(x).hidden = true; });
    const n = $(id);
    n.hidden = false;
    $('not-katman').classList.add('acik');
    document.querySelectorAll('[aria-controls]').forEach(b => b.setAttribute('aria-expanded', String(b.getAttribute('aria-controls') === id)));
    requestAnimationFrame(() => {
      if (n.hidden || n.contains(document.activeElement)) return;
      const ilk = [...n.querySelectorAll('button, input, textarea')].find(x => !x.hidden && x.offsetParent !== null);
      if (ilk) ilk.focus({ preventScroll: true });
    });
  }
  function notKapat(id) {
    $(id).hidden = true;
    const b = document.querySelector(`[aria-controls="${id}"]`);
    if (b) b.setAttribute('aria-expanded', 'false');
    if (acikNot()) return;
    $('not-katman').classList.remove('acik');
    if (notAcan && notAcan.isConnected && notAcan !== document.body) notAcan.focus({ preventScroll: true });
    notAcan = null;
  }
  function sahneBosalt() { X.turTemizle(); $('kupur').innerHTML = ''; $('rakip').hidden = true; $('kitap-sayfa').hidden = true; $('defter').classList.add('tek-kisi'); }

  /* ---------- Kitaplar ---------- */
  const KAT_SIRA = ['tek', 'iki', 'ekle', 'cikar', 'hepsini', 'romen'];
  const Kitap = {
    async basla() {
      sahneBosalt();
      O.mod = 'kitap';
      X.baslikNotu('Kitaplar · içindekilerden bir kitap seç');
      M.kur({ sure: true, puan: true, hamle: true });
      M.puan(KB.depo.oyuncu().puan); M.notlarTemizle();
      M.gecmisKur('Bu oturumda');
      X.komutlar({ 'k-ipucu': true, 'k-pes': true }, 'İçindekiler');
      await Kitap.icindekiler();
    },
    async icindekiler() {
      notAc('kitaplar');
      $('kitaplar-baslik').textContent = 'İçindekiler';
      const kap = $('kitap-icerik');
      kap.innerHTML = '';
      h('p', '', kap, 'Her kitap yüz bulmaca; kolaydan zora gider. Bitirdiğin kitaba kalemle tik atılır.');
      const cozulen = new Set(KB.depo.kitap().cozulen);
      for (const kat of KAT_SIRA) {
        const sec = h('section', 'kitap-kategori', kap);
        h('h3', '', sec, G.KAT_AD[kat]);
        const n = h('div', 'kitap-numaralar', sec, 'yükleniyor…');
        KB.havuz.kitaplar(kat).then(kitaplar => {
          n.textContent = '';
          kitaplar.forEach((k, i) => {
            const b = h('button', 'kitap-no', n, String(i + 1));
            b.type = 'button';
            const c = k.filter(x => cozulen.has(x.kimlik)).length;
            if (c === k.length) b.classList.add('bitti'); else if (c) b.classList.add('basladi');
            b.setAttribute('aria-label', `${G.KAT_AD[kat]} ${i + 1}: ${c} / ${k.length} çözüldü`);
            b.addEventListener('click', () => Kitap.ac(kat, i));
          });
        }).catch(() => { n.textContent = 'yüklenemedi'; });
      }
    },
    async ac(kat, no) {
      notAc('kitaplar');
      const kitaplar = await KB.havuz.kitaplar(kat);
      const k = kitaplar[no];
      $('kitaplar-baslik').textContent = `${G.KAT_AD[kat]} ${no + 1}`;
      const kap = $('kitap-icerik');
      kap.innerHTML = '';
      const cozulen = new Set(KB.depo.kitap().cozulen);
      h('p', '', kap, `${k.filter(x => cozulen.has(x.kimlik)).length} / ${k.length} çözüldü.`);
      Kitap.izgara(h('div', 'bulmaca-izgara', kap), kat, no, k, cozulen, null);
      const geri = h('p', 'not-komut', kap);
      sozcuk(geri, 'içindekiler', () => Kitap.icindekiler());
    },
    // Kitabın yüz numarası: çözülenlere tik, şimdiki kırmızı kalemle halkalı; numaraya basınca o bulmaca açılır
    izgara(kap, kat, no, k, cozulen, simdi) {
      kap.innerHTML = '';
      k.forEach((x, i) => {
        const c = cozulen.has(x.kimlik);
        const b = h('button', 'bulmaca-no' + (c ? ' cozuldu' : '') + (i === simdi ? ' simdi' : ''), kap, String(i + 1));
        b.type = 'button';
        b.setAttribute('aria-label', `bulmaca ${i + 1}${c ? ', çözüldü' : ''}${i === simdi ? ', şimdi açık' : ''}`);
        if (i === simdi) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => Kitap.oyna(kat, no, i));
      });
    },
    // Sağ sayfada açık kitap (açık defterde; telefonda içindekiler notu yeter)
    sayfaCiz() {
      const { kat, no } = O.kitap;
      KB.havuz.kitaplar(kat).then(kitaplar => {
        if (O.mod !== 'kitap' || O.kitap.kat !== kat || O.kitap.no !== no) return;
        const k = kitaplar[no], cozulen = new Set(KB.depo.kitap().cozulen);
        $('kitap-sayfa-baslik').textContent = `${G.KAT_AD[kat]} ${no + 1} · ${k.filter(x => cozulen.has(x.kimlik)).length} / ${k.length} çözüldü`;
        Kitap.izgara($('kitap-izgara'), kat, no, k, cozulen, O.kitap.sira);
        $('kitap-sayfa').hidden = false;
      });
    },
    async oyna(kat, no, sira) {
      notKapat('kitaplar');
      const kitaplar = await KB.havuz.kitaplar(kat);
      const x = kitaplar[no][sira];
      O.kitap = { kat, no, sira };
      const kayit = Object.assign({}, x, { no: `${no + 1}.${sira + 1}`, durum: x.durum });
      X.baslikNotu(`${G.KAT_AD[kat]} ${no + 1} · bulmaca ${sira + 1}`);
      X.sonrakiGizle();
      M.notlarTemizle();
      const hepsini = kat === 'hepsini';
      const tur = await X.turKur({
        kayit, kategori: kat, rakip: null, ipucuIzin: !hepsini, hepsini,
        talimat: hepsini ? `${K.TALIMAT.hepsini} Bu bulmacanın <b>${So.cozumSayisi(x.durum(), { k: 1 })} çözümü</b> var.` : undefined,
        onCoz: hepsini ? Kitap.hepsiniBuldu : Kitap.cozdu, onPes: Kitap.pes,
      });
      if (hepsini) { tur.hep = { tum: So.coz(tur.durum0, { k: 1 }).map(g => g.metin), sen: new Set() }; M.not(`0 / ${tur.hep.tum.length} çözüm`, { anahtar: 'hep-say' }); }
      Kitap.sayfaCiz();
    },
    hepsiniBuldu(tur, t, metin) {
      const hp = tur.hep;
      if (hp.sen.has(metin)) { M.not('Bunu bulmuştun.', { sure: 1800, anahtar: 'olmadi' }); return tur.etk.sifirla(); }
      hp.sen.add(metin);
      M.not(`${Mo.gorunum(metin)}`, { matbaa: true });
      M.not(`${hp.sen.size} / ${hp.tum.length} çözüm`, { anahtar: 'hep-say' });
      if (hp.sen.size === hp.tum.length) return Kitap.cozdu(tur, t);
      setTimeout(() => { if (!tur.bitti) { tur.etk.sifirla(); M.hamle(0, 1, false); } }, 650);
    },
    cozdu(tur, t) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Çözüldü'); ses('damga');
      KB.depo.kitapCozuldu(tur.kayit.kimlik);
      Kitap.sayfaCiz();
      X.puanGuncelle(tur.kayit, Ra.sonuc(t, tur.kayit.bant, { ipucu: tur.ipucu }), t);
      M.gecmisEkle({ no: `No. ${tur.kayit.no}`, ne: `<span class="matbaa">${Mo.gorunum(Mo.oku(tur.etk.durum()).metin)}</span>`, sure: M.sureMetin(t), sinif: 'kazandi', basa: true });
      Kitap.sonraki();
    },
    async pes(tur, o = {}) {
      if (tur.bitti) return;
      tur.bitti = true; tur.etk.kilitle(true);
      X.puanGuncelle(tur.kayit, 0, X.gecen(tur));
      if (tur.hep) { for (const m of tur.hep.tum) if (!tur.hep.sen.has(m)) M.not(Mo.gorunum(m), { matbaa: true }); }
      else await X.cozumGoster(tur);
      M.not(o.ipucu ? 'Çözüm gösterildi.' : 'Çözüm gösterildi; bu bulmaca çözülmedi sayılır.', { anahtar: 'cozum' });
      Kitap.sonraki();
    },
    async sonraki() {
      const { kat, no, sira } = O.kitap;
      const k = (await KB.havuz.kitaplar(kat))[no];
      const cozulen = new Set(KB.depo.kitap().cozulen);
      let j = -1;
      for (let i = 1; i <= k.length; i++) { const q = (sira + i) % k.length; if (!cozulen.has(k[q].kimlik)) { j = q; break; } }
      if (j < 0) { M.not('Kitap bitti!', { anahtar: 'kitap-son' }); return X.sonrakiGoster('içindekiler', () => Kitap.icindekiler()); }
      X.sonrakiGoster('sonraki bulmaca', () => Kitap.oyna(kat, no, j));
    },
  };

  /* ---------- Günün bulmacası ---------- */
  const dunOf = (tarih) => { const d = new Date(tarih + 'T12:00:00'); d.setDate(d.getDate() - 1); return Mo.yerelTarih(d); };
  const Gun = {
    async basla() {
      X.turTemizle();
      O.mod = 'gunun';
      const tarih = Mo.yerelTarih();
      const kayit = await KB.havuz.gunun(tarih);
      const kDun = await KB.havuz.gunun(dunOf(tarih));
      const cDun = X.cozumBayt(kDun.durum(), 'tek');
      X.baslikNotu(`Günün bulmacası · ${Mo.tarihYazi(tarih)}`);
      M.kur({ sure: true, puan: true, hamle: true });
      M.puan(KB.depo.oyuncu().puan); M.notlarTemizle();
      M.gecmisKur('Günün bulmacası');
      for (let i = 1; i <= 6; i++) {
        const t = dunOf(i === 1 ? tarih : Mo.yerelTarih(new Date(Date.now() - (i - 1) * 86400000)));
        const k = KB.depo.gun(t);
        if (k) M.gecmisEkle({ no: Mo.tarihYazi(t), ne: k.cozdu ? `${k.deneme}. denemede` : 'çözülmedi', sure: k.cozdu ? M.sureMetin(k.sure) : '', sinif: k.cozdu ? 'kazandi' : 'kaybetti' });
      }
      X.komutlar({ 'k-ipucu': true, 'k-pes': true, 'k-yeni': false }, 'Yeni');
      const kay = Object.assign({ deneme: 0, sure: 0, cozdu: false, bitti: false, ipucu: 0, yarin: false, gosterildi: false }, KB.depo.gun(tarih) || {});
      const altDun = cDun ? `Dünkü bulmacanın (No. ${kDun.no}) çözümü: <b>${Mo.gorunum(cDun.metin)}</b>` : '';
      const tur = await X.turKur({
        kayit, kategori: 'tek', rakip: null, ipucuIzin: true, alt: altDun,
        onCoz: Gun.cozdu, onPes: Gun.pes, onDeneme: (t) => { kay.deneme = t.denemeler; Gun.kaydet(); },
      });
      O.gun = { tarih, kay, tur, kayit, altDun };
      tur.t0 -= kay.sure * 1000;
      tur.denemeler = kay.deneme; tur.ipucu = kay.ipucu;
      if (kay.bitti) {
        tur.bitti = true; tur.etk.kilitle(true);
        clearInterval(O.aralik);
        M.sure(kay.sure);
        if (kay.cozdu) { await X.cozumGoster(tur); tur.kupur.damga('Çözüldü', { anlik: true }); Gun.paylasGoster(); }
        else if (kay.yarin) Gun.yarinYaz();
        else { await X.cozumGoster(tur); M.not('Bugünkü bulmacanın çözümü gösterildi.', { anahtar: 'cozum' }); }
        M.not('Yarın yeni bulmaca.', { anahtar: 'yarin' });
      }
    },
    kaydet() {
      const g = O.gun;
      if (!g) return;
      if (!g.kay.bitti && g.tur === O.tur && !g.tur.bitti) g.kay.sure = Math.round(X.gecen(g.tur));
      g.kay.ipucu = g.tur.ipucu;
      KB.depo.gunYaz(g.tarih, g.kay);
    },
    cozdu(tur, t) {
      if (tur.bitti) return;
      const g = O.gun;
      tur.bitti = true; tur.etk.kilitle(true);
      tur.kupur.damga('Çözüldü'); ses('damga');
      Object.assign(g.kay, { cozdu: true, bitti: true, sure: Math.round(t), deneme: tur.denemeler, ipucu: tur.ipucu });
      KB.depo.gunYaz(g.tarih, g.kay);
      X.puanGuncelle(tur.kayit, Ra.sonuc(t, tur.kayit.bant, { ipucu: tur.ipucu }), t, { gun: g.tarih });
      M.not(`${g.kay.deneme}. denemede · ${M.sureMetin(g.kay.sure)}`, { anahtar: 'gun' });
      M.gecmisEkle({ no: 'bugün', ne: `${g.kay.deneme}. denemede`, sure: M.sureMetin(g.kay.sure), sinif: 'kazandi', basa: true });
      Gun.paylasGoster();
    },
    pes(tur, o = {}) {
      if (tur.bitti) return;
      if (o.ipucu) return Gun.cozumAc(tur);
      // seçim: çözümü şimdi gör ya da yarınki sayıya bırak
      const li = M.not('Çözüm:', { anahtar: 'secim' });
      sozcuk(li, 'şimdi göster', () => { li.remove(); Gun.cozumAc(tur); });
      sozcuk(li, 'yarınki sayıya bırak', () => { li.remove(); Gun.yarin(tur); });
    },
    async cozumAc(tur) {
      const g = O.gun;
      tur.bitti = true; tur.etk.kilitle(true);
      Object.assign(g.kay, { bitti: true, cozdu: false, sure: Math.round(X.gecen(tur)), gosterildi: true });
      KB.depo.gunYaz(g.tarih, g.kay);
      X.puanGuncelle(tur.kayit, 0, X.gecen(tur), { gun: g.tarih });
      await X.cozumGoster(tur);
    },
    yarin(tur) {
      const g = O.gun;
      tur.bitti = true; tur.etk.kilitle(true);
      Object.assign(g.kay, { bitti: true, cozdu: false, yarin: true, sure: Math.round(X.gecen(tur)) });
      KB.depo.gunYaz(g.tarih, g.kay);
      X.puanGuncelle(tur.kayit, 0, X.gecen(tur), { gun: g.tarih });
      Gun.yarinYaz();
    },
    yarinYaz() { const g = O.gun; g.tur.kupur.altEl.innerHTML = `${g.altDun ? g.altDun + '<br>' : ''}Çözüm yarınki sayımızda.`; },
    metin() {
      const g = O.gun;
      return `Kibrit · ${Mo.tarihYazi(g.tarih)} · ${g.kay.deneme}. denemede · ${M.sureMetin(g.kay.sure)}${g.kay.ipucu ? ` · ${g.kay.ipucu} ipucu` : ''}`;
    },
    paylasGoster() { $('k-paylas').hidden = false; M.ciz(true); },
    async paylas() {
      const metin = Gun.metin();
      try { if (navigator.share) { await navigator.share({ text: metin }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(metin); M.not('Kopyalandı.', { sure: 2200, anahtar: 'paylas' }); return; } catch (e) { /* yedek */ }
      const li = M.not('', { anahtar: 'paylas' });
      const ta = h('textarea', 'paylas-metin', li); ta.value = metin; ta.rows = 2; ta.readOnly = true; ta.select();
    },
  };
  addEventListener('visibilitychange', () => { if (document.hidden && O.mod === 'gunun') Gun.kaydet(); });
  addEventListener('pagehide', () => { if (O.mod === 'gunun') Gun.kaydet(); });

  /* ---------- İki kişi ---------- */
  function devir(baslik, metin, secenekler) {
    return new Promise(res => {
      notAc('devir');
      $('devir-baslik').textContent = baslik;
      $('devir-metin').textContent = metin || '';
      const sec = $('devir-secim'); sec.innerHTML = '';
      const tamam = $('devir-tamam');
      if (secenekler) {
        tamam.hidden = true;
        secenekler.forEach(([ad, deger]) => sozcuk(sec, ad, () => { notKapat('devir'); res(deger); }));
      } else {
        tamam.hidden = false;
        Kit.kalem.harfle(tamam.querySelector('.yazi'), 'hazırım', { tohum: ['hazir'], anlik: true });
        requestAnimationFrame(() => Kit.kalem.dugmeAltiCiz(tamam, 0, true, { stroke: '#4a4a4a', strokeWidth: 1.3 }));
        tamam.onclick = () => { notKapat('devir'); res(true); };
        setTimeout(() => tamam.focus({ preventScroll: true }), 30);
      }
    });
  }
  const Iki = {
    async basla() {
      sahneBosalt();
      O.mod = 'ikiKisi';
      X.baslikNotu('İki kişi · aynı cihaz');
      M.kur({ sure: true }); M.notlarTemizle(); M.gecmisKur('Maç defteri');
      X.komutlar({ 'k-ipucu': false, 'k-pes': false, 'k-geri': true, 'k-bastan': true }, 'Yeni oyun');
      const s = await devir('İki kişi', 'Aynı cihazda iki oyuncu. Nasıl oynayalım?', [['sırayla boz ve düzelt', 'sira'], ['karşılıklı yarış (masadaki tablet)', 'yaris']]);
      if (s === 'yaris') return Yaris.basla();
      return Sira.basla();
    },
  };
  const AD = ['1. oyuncu', '2. oyuncu'];
  const ADA = ['1. oyuncuya', '2. oyuncuya'];
  const ADIN = ['1. oyuncunun', '2. oyuncunun'];
  const Sira = {
    async basla() {
      O.sira = { n: C.boz.tur, i: 0, skor: [0, 0], sure: [0, 0], tohum: Math.floor(Math.random() * 1e9) };
      X.baslikNotu(`İki kişi · Boz ve Düzelt · ${O.sira.n} tur`);
      M.kur({ cetele: AD, sure: true, tur: true, hamle: true });
      M.ceteleYaz(0, 0, AD[0]); M.ceteleYaz(1, 0, AD[1]);
      await Sira.tur();
    },
    bozAsama(d, kim) {
      return new Promise(async res => {
        const tur = await X.turKur({ kayit: X.bozKayit ? KB.modlar.bozKayit(d) : null, kategori: 'boz', durum: d, rakip: null, boz: true, talimat: `${AD[kim]}: ${K.TALIMAT.boz}`,
          onBoz: (t, dd, hm, ok, p) => {
            const kabul = KB.modlar.bozKontrol(t, dd, hm, ok, p);
            if (!kabul) return;
            t.bozuldu = true; t.etk.kilitle(true); t.kupur.damga('Bozuldu', { boyut: 26 }); ses('damga');
            setTimeout(() => res(Mo.kopya(kabul)), 900);
          } });
        clearInterval(O.aralik); M.sure(0);
        void tur;
      });
    },
    duzeltAsama(b, kim) {
      return new Promise(async res => {
        const bitir = async (t, sure, cozdu) => {
          if (t.bitti) return; t.bitti = true; t.etk.kilitle(true);
          t.kupur.damga(cozdu ? 'Çözüldü' : 'Süre doldu'); ses('damga');
          if (!cozdu) await X.cozumGoster(t);
          setTimeout(() => res(cozdu ? sure : null), 1400);
        };
        await X.turKur({ kayit: KB.modlar.bozKayit(b), kategori: 'tek', durum: b, rakip: null, sureS: C.boz.sureS,
          talimat: `${AD[kim]}: ${ADIN[1 - kim]} bozduğu eşitliği tek çöple düzelt.`,
          onCoz: (t, s) => bitir(t, s, true), onSure: (t) => bitir(t, C.boz.sureS, false), onPes: (t) => bitir(t, C.boz.sureS, false) });
      });
    },
    async tur() {
      const S = O.sira;
      X.sonrakiGizle(); M.notlarTemizle();
      M.tur(S.i + 1, S.n);
      const r = Mo.rng(['sira', S.tohum, S.i]);
      KB.sahne.olc({ tekKisi: true });
      const d = KB.modlar.dogruEsitlikSec(r, KB.sahne.sigar);
      sahneBosalt();
      await devir(`${AD[0]} bozar`, `${AD[1]} bakmasın. ${AD[0]}: doğru eşitliği tek çöple boz.`);
      const b1 = await Sira.bozAsama(d, 0);
      sahneBosalt();
      await devir(`Cihazı ${ADA[1]} ver`, `${AD[0]} bakmasın. ${AD[1]}: aynı eşitliği tek çöple boz.`);
      const b2 = await Sira.bozAsama(d, 1);
      sahneBosalt();
      await devir(`Cihazı ${ADA[0]} ver`, `${AD[0]}: ${ADIN[1]} bozduğunu düzelt. Süre ${C.boz.sureS} saniye.`);
      const t1 = await Sira.duzeltAsama(b2, 0);
      sahneBosalt();
      await devir(`Cihazı ${ADA[1]} ver`, `${AD[1]}: ${ADIN[0]} bozduğunu düzelt. Süre ${C.boz.sureS} saniye.`);
      const t2 = await Sira.duzeltAsama(b1, 1);
      const s1 = t1 ?? C.boz.sureS + 1, s2 = t2 ?? C.boz.sureS + 1;
      S.sure[0] += t1 ?? C.boz.sureS; S.sure[1] += t2 ?? C.boz.sureS;
      let kazanan = null;
      if (t1 !== null || t2 !== null) { if (s1 < s2) kazanan = 0; else if (s2 < s1) kazanan = 1; }
      if (kazanan !== null) { S.skor[kazanan]++; M.ceteleYaz(kazanan, S.skor[kazanan], AD[kazanan]); }
      M.not(`${AD[0]}: ${t1 === null ? 'düzeltemedi' : M.sureMetin(t1)} · ${AD[1]}: ${t2 === null ? 'düzeltemedi' : M.sureMetin(t2)}`, { anahtar: 'sira-tur' });
      M.not(`${ADIN[0]} bozmasının ${So.cozumSayisi(b1, { k: 1 })} çözümü vardı; ${ADIN[1]} ${So.cozumSayisi(b2, { k: 1 })}.`, { anahtar: 'sira-coz' });
      M.not(kazanan === null ? 'Tur berabere.' : `Turu ${AD[kazanan]} aldı.`, { anahtar: 'sira-kaz' });
      M.gecmisEkle({ no: `${S.i + 1}. tur`, ne: kazanan === null ? 'berabere' : `${AD[kazanan]} aldı`, sure: `${t1 === null ? '—' : M.sureMetin(t1)} / ${t2 === null ? '—' : M.sureMetin(t2)}` });
      S.i++;
      if (S.i < S.n) return X.sonrakiGoster('sonraki tur', () => Sira.tur());
      let son;
      if (S.skor[0] !== S.skor[1]) son = S.skor[0] > S.skor[1] ? 0 : 1;
      else if (Math.abs(S.sure[0] - S.sure[1]) >= .05) son = S.sure[0] < S.sure[1] ? 0 : 1;
      else son = null;
      KB.modlar.sonDamga(son === null ? 'Berabere' : `Maç ${ADIN[son]}`);
      X.sonrakiGoster('yeni oyun', () => Iki.basla());
    },
  };

  /* ---------- karşılıklı yarış: ekran ikiye bölünür, üst yarı 180° döner ---------- */
  const Yaris = {
    async basla() {
      sahneBosalt();
      O.yaris = { n: 5, i: 0, skor: [0, 0], tohum: Math.floor(Math.random() * 1e9), turlar: [] };
      const y = $('yaris');
      y.hidden = false;
      document.body.style.overflow = 'hidden';
      const orta = $('yaris-orta');
      orta.innerHTML = '';
      O.yaris.skorEl = h('span', 'yaris-skor', orta);
      O.yaris.sureEl = h('span', 'yaris-skor', orta);
      O.yaris.sonraki = sozcuk(orta, 'başla', () => Yaris.tur());
      sozcuk(orta, 'çık', () => Yaris.cik());
      Yaris.skorYaz();
    },
    skorYaz() { const Y = O.yaris; Y.skorEl.textContent = `${AD[1]} ${Y.skor[1]} — ${Y.skor[0]} ${AD[0]} · tur ${Math.min(Y.i + 1, Y.n)}/${Y.n}`; },
    temizle() { const Y = O.yaris; if (!Y) return; (Y.etk || []).forEach(e => e && e.temizle()); clearInterval(Y.aralik); },
    async tur() {
      const Y = O.yaris;
      Yaris.temizle();
      Y.sonraki.hidden = true;
      const yari = [$('yaris-alt'), $('yaris-ust')];
      const W = Math.min(innerWidth - 20, 640);
      const H = (innerHeight - 52) / 2;
      // kutu: iç boşluk 28 + çerçeve; başlık, talimat (ve sığarsa efsane) 160/235 px
      const efsaneVar = H >= 380, krom = efsaneVar ? 235 : 160;
      const sigar = (id) => Math.min((W - 34) / (Mo.genislikL(id) + .8), (H - krom) / 2.56) >= 34;
      const r = Mo.rng(['yaris', Y.tohum, Y.i]);
      const kayit = await KB.havuz.sec({ kategori: 'tek', hedef: 950 + Y.i * 60, r, sigarMi: sigar, tohum: Y.tohum + Y.i, dislanan: new Set() });
      const L = Math.min((W - 34) / (Mo.genislikL(kayit.sablon) + .8), (H - krom) / 2.56, 64);
      Y.etk = []; Y.kupur = []; Y.bitti = false;
      yari.forEach((el, kim) => {
        el.innerHTML = '';
        const k = h('article', 'bulmaca', el);
        k.style.width = W + 'px';
        const kp = K.olustur(k, { kayit, durum: kayit.durum(), L, tohum: ['yaris', kayit.kimlik, kim], efsane: efsaneVar, talimat: `${AD[kim]}: ${K.TALIMAT.tek}` });
        Y.kupur[kim] = kp;
        const durum0 = Mo.kopya(kayit.durum());
        Y.etk[kim] = new KB.Etkilesim(kp, { kategori: 'tek', degisti: (d) => {
          if (Y.bitti) return;
          const hm = Mo.hamle(Mo.fark(durum0, d), 'tek');
          if (hm.dolu && Mo.dogru(d)) Yaris.bitir(kim);
        } });
      });
      Y.t0 = performance.now();
      Y.aralik = setInterval(() => {
        const t = (performance.now() - Y.t0) / 1000;
        Y.sureEl.textContent = M.sureMetin(t);
        if (t >= C.yaris.sureS && !Y.bitti) Yaris.bitir(null);
      }, 200);
      Yaris.skorYaz();
      ses('hisirti');
    },
    async bitir(kim) {
      const Y = O.yaris;
      Y.bitti = true;
      clearInterval(Y.aralik);
      Y.etk.forEach(e => e.kilitle(true));
      if (kim !== null) { Y.skor[kim]++; Y.kupur[kim].damga('Çözüldü'); }
      else { Y.kupur.forEach(k => k.damga('Süre doldu', { boyut: 26 })); const c = X.cozumBayt(Y.kupur[0].sahne.durum(), 'tek'); void c; }
      ses('damga');
      Y.i++;
      Yaris.skorYaz();
      if (Y.i >= Y.n) {
        const son = Y.skor[0] === Y.skor[1] ? null : Y.skor[0] > Y.skor[1] ? 0 : 1;
        Y.skorEl.textContent += son === null ? ' · berabere' : ` · maç ${ADIN[son]}`;
        Y.sonraki.hidden = false; Y.sonraki.querySelector('.yazi').textContent = 'yeniden';
        Y.i = 0; Y.skor = [0, 0];
        return;
      }
      Y.sonraki.hidden = false;
      Kit.kalem.harfle(Y.sonraki.querySelector('.yazi'), 'sonraki tur', { tohum: ['st'], anlik: true });
      Kit.kalem.dugmeAltiCiz(Y.sonraki, 0, true, { stroke: '#4a4a4a', strokeWidth: 1.3 });
    },
    cik() {
      Yaris.temizle();
      $('yaris').hidden = true;
      document.body.style.overflow = '';
      O.yaris = null;
      KB.modlar.Mac.basla();
    },
  };

  Object.assign(KB.modlar, { Kitap, Gun, Iki, Sira, Yaris, notAc, notKapat, acikNot, sozcuk, devir });
})();
