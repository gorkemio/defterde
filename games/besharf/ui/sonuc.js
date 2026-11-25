// ui/sonuc.js — oyun sonu: kayıpta cevap kırmızı şeritle basılır; kâğıt makineden çekilir (cırcır, kâğıt uzar), altına anlam
// basılır; günün kelimesinde geri sayım ve istatistik fişi. Paylaşım: Web Share → pano → metin kutusu.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const D = () => BH.daily, G = () => BH.game;
  let bitisNo = 0; // Mod değişince bekleyen bitiş animasyonu yeni oyuna dokunmasın.
  let zamanlayici = 0, geriY = null, yeniGun = null, sonDurum = null;

  // o: { anlik, anlam, gunun, yeniGun(), satirlar: [metin] (anlamdan önce), komutlar: [[metin, fn, id]] (kâğıdın dibine) }
  async function bitir(d, o = {}) {
    const buBitis = ++bitisNo;
    const anlik = !!o.anlik;
    sonDurum = d;
    yeniGun = o.yeniGun || null;
    clearInterval(zamanlayici);
    geriY = null;
    if (o.gunun) BH.depo.istatistikEkle(d.tarih, d.sonuc === 'kazandi', d.tahminler.length, D().gunEkle(d.tarih, -1));
    if (d.sonuc === 'kaybetti') {
      const r = BH.kagit.altSatir(d.cevap, { serit: 'kirmizi', anlik, ses: !anlik, gecikme: 150 });
      BH.sahne.duyur('Bulunamadı. Cevap: ' + d.cevap);
      if (!anlik) await Kit.kalem.bekle(r.sure + 650);
    } else {
      BH.sahne.duyur(`Buldun: ${d.cevap}, ${d.tahminler.length}. tahminde`);
      if (!anlik) await Kit.kalem.bekle(350);
    }
    if (buBitis !== bitisNo) return;
    // kâğıt makineden çekilir: tuşlar kalkar, kâğıt onların yerine aşağı uzar
    BH.klavye.gizle(true, { anlik });
    if (!anlik) BH.ses.cal('cekme');
    await BH.kagit.uzat(BH.sahne.olcu.uzanti, { anlik });
    if (buBitis !== bitisNo) return;
    const boy = Math.max(11, Math.round(BH.sahne.olcu.s * .3)), satirAra = boy * 1.5;
    let y = BH.kagit.uzantiY() + boy, gec = anlik ? 0 : 200;
    for (const m of o.satirlar || []) {
      const p = BH.kagit.paragraf(m, { y, boyut: boy, anlik, gecikme: gec, aralikMs: 18, hiza: 'orta', yan: 14 });
      y = p.sonY + satirAra; gec += p.sure;
    }
    if (o.satirlar && o.satirlar.length) y += boy * .4;
    if (o.anlam) {
      const p = BH.kagit.paragraf(`${d.cevap}: ${o.anlam}`, { y, boyut: boy, anlik, gecikme: gec, aralikMs: 18 });
      y = p.sonY + boy * 1.25;
      BH.kagit.paragraf('Tanımlar: TDK Güncel Türkçe Sözlük', { y, boyut: Math.max(9, boy - 3), anlik: true, opaklik: .62 });
      y += satirAra;
      gec += p.sure;
    }
    if (o.gunun) {
      const s = BH.depo.istatistik(), bugun = D().istanbulTarih();
      const oran = s.oynanan ? Math.round(100 * s.kazanilan / s.oynanan) : 0;
      const p = BH.kagit.paragraf(`Oynanan ${s.oynanan} · Kazanma %${oran} · Seri ${BH.depo.guncelSeri(s, bugun, D().gunEkle(bugun, -1))}`,
        { y: y + boy * .3, boyut: boy, anlik: true, hiza: 'orta', yan: 14 });
      geriY = p.sonY + satirAra;
      geriSayimBaslat();
    }
    BH.kagit.komutlar(o.komutlar, { anlik });
    if (!anlik) await Kit.kalem.bekle(Math.min(2200, gec));
  }

  /* ---------- geri sayım ---------- */

  const geriMetin = () => `Yeni kelime ${D().geriSayimYazi(D().sonrakiGuneKalanMs())} sonra`;
  function geriSayimBaslat() {
    clearInterval(zamanlayici);
    const tik = () => {
      const kalan = D().sonrakiGuneKalanMs();
      if (geriY != null && BH.kagit.ek) BH.kagit.tekSatir('geri', geriMetin(), { y: geriY, boyut: Math.max(11, Math.round(BH.sahne.olcu.s * .3)), hiza: 'orta', yan: 14 });
      const f = document.getElementById('fis-geri');
      if (f) Kit.daktilo.metin(f, geriMetin(), { anlik: true, tohum: ['geri'] });
      if (kalan > 86398000 && yeniGun) { clearInterval(zamanlayici); yeniGun(); }      // gece yarısı geçti
    };
    tik();
    zamanlayici = setInterval(tik, 1000);
  }
  const durdur = () => { bitisNo++; clearInterval(zamanlayici); geriY = null; };

  /* ---------- istatistik fişi ---------- */

  function istatistikNotu() {
    const s = BH.depo.istatistik();
    const bugun = D().istanbulTarih();
    const seri = BH.depo.guncelSeri(s, bugun, D().gunEkle(bugun, -1));
    BH.not.ac({
      baslik: 'İstatistik',
      ciz(ic, y) {
        const tablo = document.createElement('div');
        tablo.className = 'fis-tablo';
        ic.appendChild(tablo);
        const oran = s.oynanan ? Math.round(100 * s.kazanilan / s.oynanan) : 0;
        for (const [ad, deger] of [['Oynanan', s.oynanan], ['Kazanma', '%' + oran], ['Seri', seri], ['En uzun seri', s.enIyiSeri]]) {
          y.satir(ad.padEnd(13, ' ') + String(deger).padStart(4, ' '), { kap: tablo, sinif: 'fis-sayi' });
        }
        y.satir('Tahmin dağılımı', { sinif: 'fis-ara' });
        const cubuk = document.createElement('div');
        cubuk.className = 'fis-cubuklar';
        cubuk.id = 'fis-cubuklar';
        ic.appendChild(cubuk);
        if (!s.oynanan) y.satir('Henüz oyun yok.', { sinif: 'fis-ara' });
        const g = document.createElement('p');
        g.className = 'not-satir fis-geri';
        g.id = 'fis-geri';
        ic.appendChild(g);
        Kit.daktilo.metin(g, geriMetin(), { anlik: true, tohum: ['geri'] });
        const k = document.createElement('p');
        k.className = 'not-komut';
        ic.appendChild(k);
        const d = sonDurum && sonDurum.mod === 'gunun' && G().bitti(sonDurum) ? sonDurum : null;
        if (d) y.komut('Paylaş', () => paylas(d, document.getElementById('fis-durum')), 'fis-paylas', { kap: k });
        const durum = document.createElement('p');
        durum.className = 'not-satir fis-durum';
        durum.id = 'fis-durum';
        durum.setAttribute('role', 'status');
        ic.appendChild(durum);
      },
      sonra() { cubuklariCiz(s); },
    });
  }

  // Tahmin dağılımı: kopya kalemiyle taranmış çubuklar (bugünkü tahmin sayısının çubuğu kutu içinde)
  function cubuklariCiz(s) {
    const kap = document.getElementById('fis-cubuklar');
    if (!kap) return;
    const w = kap.clientWidth, satirH = 19, h = 6 * satirH;
    const svg = Kit.kalem.svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' }, kap);
    const K = Kit.kalem.kalemYap(svg);
    const enCok = Math.max(1, ...s.dagilim);
    const bugunku = sonDurum && sonDurum.mod === 'gunun' && sonDurum.sonuc === 'kazandi' ? sonDurum.tahminler.length : 0;
    const etiket = [];
    s.dagilim.forEach((n, i) => {
      const y = i * satirH + 3, boy = 12;
      Kit.daktilo.yaz(svg, String(i + 1), { x: 8, y: y + 11, boyut: 13, hiza: 'orta', anlik: true, tohum: ['dag', i] });
      const gen = n ? Math.max(14, (w - 60) * n / enCok) : 4;
      if (n) Kit.kopyakalemi.tara(K, svg, { x: 18, y, w: gen, h: boy }, { tohum: ['cubuk', i, n], ic: 1, aralik: 3, anlik: false, gecikme: i * 90 });
      else K.cizgi(svg, [18, y + boy / 2, 22, y + boy / 2], { stroke: Kit.kopyakalemi.RENK.acik, strokeWidth: 1.2 }, ['cubuk0', i], { anlik: true });
      if (i + 1 === bugunku) Kit.kalem.kutu(K, svg, 16, y - 2, gen + 4, boy + 4, { tohum: ['bugun', i], tasma: 2, cizgi: { strokeWidth: 1.1 }, gecikme: 700 });
      Kit.daktilo.yaz(svg, String(n), { x: 18 + gen + 8, y: y + 11, boyut: 12, anlik: true, tohum: ['dagn', i, n] });
      etiket.push(`${i + 1} tahminde ${n}`);
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Tahmin dağılımı: ' + etiket.join(', '));
    svg.removeAttribute('aria-hidden');
  }

  /* ---------- paylaşım ---------- */

  async function kopyala(metin) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(metin); return true; } } catch (e) { /* yedek */ }
    const t = document.createElement('textarea');
    t.value = metin;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    t.remove();
    return ok;
  }

  // d: bitmiş oyun. durumEl: kısa bilgi satırı (yoksa ekran okuyucu duyurusu)
  async function paylas(d, durumEl, metin) {
    const bildir = (m) => { BH.sahne.duyur(m); if (durumEl) Kit.daktilo.metin(durumEl, m, { anlik: true, tohum: ['durum', m] }); };
    if (!metin) {
      if (!d || !G().bitti(d)) { bildir('Oyun bitince paylaşılır.'); return; }
      metin = G().paylasimMetni(d, { renkli: BH.depo.ayar().renkliPaylasim });
    }
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try { await navigator.share({ text: metin }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    bildir((await kopyala(metin)) ? 'Kopyalandı.' : 'Kopyalanamadı.');
  }

  BH.sonuc = { bitir, istatistikNotu, paylas, kopyala, durdur, get durum() { return sonDurum; } };
})();
