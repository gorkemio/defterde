// ui/ayarlar.js — Ayarlar fişi (klavye düzeni, zor mod, tuş sesi, diğer sesler, renkli paylaşım, azaltılmış hareket, düello
// seviyesi), Nasıl oynanır fişi (üç daktilo satırı + her işaret için örnek kutu) ve Ses sözcüğü (ana anahtar; kapalıyken
// sözcüğün üstü kopya kalemiyle çizilir).
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const G = () => BH.game;

  /* ---------- uygulama ---------- */

  // Azaltılmış hareket: sistem ayarına ek olarak oyunun kendi anahtarı (vuruş, kâğıt çekme, çizim animasyonu kapanır)
  function hareketUygula() {
    const az = BH.depo.ayar().azHareket;
    Kit.kalem.ayarla({ animasyon: !az });
    document.documentElement.toggleAttribute('data-az-hareket', az);
  }

  function sesGoster() {
    const b = document.getElementById('k-ses');
    if (!b) return;
    const kapali = Kit.ses.sessiz;
    b.setAttribute('aria-pressed', String(!kapali));
    b.setAttribute('aria-label', kapali ? 'Ses kapalı' : 'Ses açık');
    let svg = b.querySelector(':scope > svg.ses-cizik');
    if (svg) svg.remove();
    if (!kapali) return;
    const w = b.offsetWidth, h = b.offsetHeight, y = b.querySelector('.yazi');
    if (!w || !y) return;
    svg = Kit.kalem.svgEl('svg', { class: 'ses-cizik', width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    b.appendChild(svg);
    const bb = y.getBoundingClientRect(), kb = b.getBoundingClientRect();
    const x1 = bb.left - kb.left - 2, x2 = bb.right - kb.left + 2, orta = bb.top - kb.top + bb.height * .55;
    Kit.kopyakalemi.ustunuCiz(Kit.kalem.kalemYap(svg), svg, { x1, y1: orta + 3, x2, y2: orta - 3 }, { tohum: ['ses'], renk: Kit.kopyakalemi.RENK.grafit, kalinlik: 1.6 });
  }

  function sesDegistir() {
    Kit.ses.sessizYap(!Kit.ses.sessiz);
    if (!Kit.ses.sessiz) { Kit.ses.baslat(); BH.ses.cal('zil'); }
    sesGoster();
    BH.sahne.duyur(Kit.ses.sessiz ? 'Ses kapalı' : 'Ses açık');
  }

  /* ---------- Ayarlar ---------- */

  function ac() {
    BH.not.ac({
      baslik: 'Ayarlar', genis: true,
      ciz(ic, y) {
        const secenek = (ad, anahtar, liste, sonra) => {
          const p = document.createElement('p'); p.className = 'not-komut secim'; ic.appendChild(p);
          y.satir(ad, { kap: p, etiket: 'span', sinif: 'secim-ad' });
          const dugmeler = liste.map(([v, metin]) => {
            const b = y.komut(metin, () => {
              BH.depo.ayarYaz({ [anahtar]: v });
              isaretle();
              if (sonra) sonra(v);
            }, `ay-${anahtar}-${v}`, { kap: p });
            b.dataset.deger = String(v);
            return b;
          });
          const isaretle = () => dugmeler.forEach((b) => {
            const sec = b.dataset.deger === String(BH.depo.ayar()[anahtar]);
            BH.not.secim(b, sec);
          });
          requestAnimationFrame(isaretle);
        };
        const acKapa = [[true, 'açık'], [false, 'kapalı']];
        secenek('Klavye', 'duzen', [['q', 'Q'], ['f', 'F'], ['abc', 'Alfabe']], () => {
          BH.sahne.olc(BH.depo.ayar().duzen);
          if (BH.akis.durum) BH.akis.ciz({ anlik: true });
        });
        y.satir('F: Türkçe için daktilo çağında geliştirilmiş düzen. Alfabe: çocuklar için.', { sinif: 'secim-aciklama' });
        secenek('Zor mod', 'zor', acKapa, (v) => {
          const d = BH.akis.durum;
          const not = document.getElementById('ay-zor-not');
          if (d && !d.tahminler.length && !G().bitti(d)) {
            d.zor = v;
            const o = BH.akis.secenek;
            if (o && o.kaydet) o.kaydet(d);
            Kit.daktilo.metin(not, 'Bu oyunda geçerli.', { anlik: true });
          } else Kit.daktilo.metin(not, 'Başlamış oyunda değişmez; sonraki oyundan geçerli.', { anlik: true });
        });
        const zn = y.satir('Bulunan harfler sonraki tahminlerde kullanılmalı; paylaşımda 4/6*.', { sinif: 'secim-aciklama' });
        zn.id = 'ay-zor-not';
        secenek('Tuş sesi', 'tusSesi', acKapa);
        secenek('Diğer sesler', 'digerSes', acKapa);
        secenek('Paylaşım', 'renkliPaylasim', [[false, '▩▧□'], [true, 'renkli kare']]);
        secenek('Hareket', 'azHareket', [[false, 'tam'], [true, 'azaltılmış']], hareketUygula);
        secenek('Düello', 'duelloSeviye', [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']]);
      },
    });
  }

  /* ---------- Nasıl oynanır ---------- */

  function nasil() {
    BH.not.ac({
      baslik: 'Nasıl oynanır?',
      ciz(ic, y) {
        y.satir('Beş harfli kelimeyi altı tahminde bul.');
        y.satir('Her tahmin listede olan bir kelime olmalı; Enter ile gönder.');
        y.satir('Kopya kalemi her harfi işaretler:');
        const ornek = document.createElement('div');
        ornek.className = 'nasil-ornekler';
        ornek.id = 'nasil-ornekler';
        ic.appendChild(ornek);
        y.satir('Her gün herkese aynı kelime; yenisi Türkiye saatiyle 00:00\'da.', { sinif: 'secim-aciklama' });
      },
      sonra() {
        const kap = document.getElementById('nasil-ornekler');
        if (!kap) return;
        const ORNEK = [['K', 2, 'doğru yerde'], ['A', 1, 'kelimede var, başka yerde'], ['Z', 0, 'kelimede yok']];
        const s = 38, w = kap.clientWidth, h = ORNEK.length * (s + 10);
        const svg = Kit.kalem.svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: 'img',
          'aria-label': 'Örnekler: taranmış kutu doğru yerde, çember başka yerde, üstü çizili kelimede yok' }, kap);
        const K = Kit.kalem.kalemYap(svg), KK = Kit.kopyakalemi;
        ORNEK.forEach(([h0, d, metin], i) => {
          const x = 6, y0 = i * (s + 10) + 4, cx = x + s / 2, cy = y0 + s / 2;
          Kit.kalem.kutu(K, svg, x, y0, s, s, { tohum: ['nasil', i], tasma: 2.5, anlik: true, cizgi: { strokeWidth: 1.1, stroke: KK.RENK.grafit } });
          const harf = Kit.daktilo.harf(svg, h0, { x: cx, y: Kit.daktilo.ortaTaban(cy, 22), boyut: 22, anlik: true, tohum: ['nasil-h', i] });
          const gec = 250 + i * 450;
          if (d === 2) KK.tara(K, svg, { x, y: y0, w: s, h: s }, { oyuk: harf.node, bosluk: 2, tohum: ['nasil-t'], gecikme: gec });
          else if (d === 1) KK.cember(K, svg, { cx, cy, r: s * .37 }, { tohum: ['nasil-c'], gecikme: gec });
          else KK.ustunuCiz(K, svg, { x1: x + s * .15, y1: cy + 4, x2: x + s * .85, y2: cy - 4 }, { tohum: ['nasil-x'], gecikme: gec });
          Kit.daktilo.yaz(svg, metin, { x: x + s + 14, y: cy + 5, boyut: 14, anlik: true, tohum: ['nasil-m', i] });
        });
      },
    });
  }

  function kur() {
    hareketUygula();
    requestAnimationFrame(sesGoster);
  }

  BH.ayarlar = { ac, nasil, sesDegistir, sesGoster, kur };
})();
