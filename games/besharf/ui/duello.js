// ui/duello.js — Düello: aynı gizli kelimeyi sen ve bilgisayar ararsınız. Sen bir satır gönderdiğinde bilgisayar da bir satır
// oynar; onun kâğıdında yalnız işaretler görünür (paylaşım ızgarası gibi), harfler kelime bitince fişte açılır.
// Daha az tahminde bulan kelimeyi alır; eşitse berabere. Maç 3 ya da 5 kelime. Kayıt: bh-duello (sayfa yenilense de sürer).
// Bilgisayarın k. hamlesi tohumdan türer (BH.solver.hamleRng): sürdürülen maçta aynı hamleler.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const G = () => BH.game, S = () => BH.solver;
  const SEVIYE_ADI = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' };
  let m = null;

  const kaydet = () => BH.depo.yaz('duello', m);
  const satirlar = () => m.bilgisayar.satirlar;
  const bilgisayarBitti = () => satirlar().length >= 6 || (satirlar().length && satirlar()[satirlar().length - 1].kod === S().HEPSI_DOGRU);
  const altSatir = () => `${m.indeks + 1}/${m.uzunluk} · Sen ${m.skor.sen} – ${m.skor.bilgisayar}`;

  function yukle() {
    const k = BH.depo.oku('duello');
    if (!k || !Array.isArray(k.kelimeler) || !k.kelimeler.length || !k.bilgisayar || !k.skor) return null;
    if (k.oyuncu && !G().yukle(k.oyuncu)) k.oyuncu = null;
    return k;
  }

  /* ---------- maç seçimi ---------- */

  function notu() {
    const sure = yukle();
    const a = BH.depo.ayar();
    let uzunluk = a.duelloUzunluk, seviye = a.duelloSeviye;
    BH.not.ac({
      baslik: 'Düello',
      ciz(ic, y) {
        y.satir('Aynı gizli kelimeyi bilgisayarla ararsınız. Sen bir satır gönderdikçe o da bir satır oynar; onun kâğıdında yalnız işaretler görünür. Daha az tahminde bulan kelimeyi alır.');
        if (sure && !sure.bitti) {
          y.satir(`Süren maç: ${sure.indeks + 1}/${sure.uzunluk} · Sen ${sure.skor.sen} – ${sure.skor.bilgisayar} · ${SEVIYE_ADI[sure.seviye]}`, { sinif: 'fis-ara' });
          const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
          y.komut('Sürdür', () => { BH.not.kapat(); m = sure; oyna(); }, 'du-surdur', { kap: p });
        }
        const secim = (ad, liste, deger, ata) => {
          const p = document.createElement('p'); p.className = 'not-komut secim'; ic.appendChild(p);
          y.satir(ad, { kap: p, etiket: 'span', sinif: 'secim-ad' });
          const dugmeler = liste.map(([v, metin]) => {
            const b = y.komut(metin, () => { ata(v); isaretle(); }, `du-${ad}-${v}`, { kap: p });
            b.dataset.deger = v;
            return b;
          });
          const isaretle = () => dugmeler.forEach((b) => {
            const sec = String(b.dataset.deger) === String(deger());
            BH.not.secim(b, sec);
          });
          requestAnimationFrame(isaretle);
        };
        secim('Maç', [[3, '3 kelime'], [5, '5 kelime']], () => uzunluk, (v) => { uzunluk = v; });
        secim('Seviye', [['kolay', 'Kolay'], ['orta', 'Orta'], ['zor', 'Zor']], () => seviye, (v) => { seviye = v; });
        const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
        y.komut(sure && !sure.bitti ? 'Yeni maç' : 'Başla', () => { BH.not.kapat(); baslat(uzunluk, seviye); }, 'du-basla', { kap: p });
      },
    });
  }

  function baslat(uzunluk, seviye) {
    BH.depo.ayarYaz({ duelloUzunluk: uzunluk, duelloSeviye: seviye });
    const tohum = (Math.random() * 4294967296) >>> 0;
    const r = S().rng(tohum);
    const kelimeler = Array.from({ length: uzunluk }, () => BH.modlar.rastgeleCevap(r));
    m = { tohum, uzunluk, seviye, kelimeler, indeks: 0, skor: { sen: 0, bilgisayar: 0, berabere: 0 }, oyuncu: null,
      bilgisayar: { satirlar: [] }, turlar: [], bitti: false };
    kaydet();
    oyna();
  }

  /* ---------- oyun ---------- */

  function oyna() {
    BH.sonuc.durdur();
    BH.modlar.modAyarla('duello');
    const cevap = m.kelimeler[m.indeks];
    const d = m.oyuncu ? G().yukle(m.oyuncu) : G().yeni({ mod: 'duello', cevap, tohum: m.tohum });
    BH.akis.kur({
      durum: d, kume: BH.modlar.veri.kume, baslik: 'DÜELLO', alt: altSatir(), tohum: ['duello', m.tohum, m.indeks],
      kaydet: (x) => { m.oyuncu = x; kaydet(); },
      cizince: () => miniCiz({ anlik: true }),
      satirSonu: async () => { if (!bilgisayarBitti()) await bilgisayarHamle(); },
      bitince: async (x, o) => {
        if (!o.anlik) while (!bilgisayarBitti()) await bilgisayarHamle({ hizli: true });
        await turBitir(x, o);
      },
    });
    BH.sahne.duyur(`Düello, ${m.indeks + 1}. kelime. Seviye ${SEVIYE_ADI[m.seviye]}.`);
  }

  // Bilgisayarın aday kümesi kendi satırlarından yeniden kurulur
  function bilgisayarAdaylari() {
    const C = BH.modlar.solver();
    let A = C.cevapIdx;
    for (const s of satirlar()) A = C.suz(A, s.kelime, s.kod);
    return A;
  }

  async function bilgisayarHamle(o = {}) {
    const C = BH.modlar.solver();
    const k = satirlar().length;
    const ci = C.dizin(m.kelimeler[m.indeks]);
    const A = bilgisayarAdaylari();
    const t = C.duelloHamle(m.seviye, A, S().hamleRng((m.tohum + m.indeks * 7919) >>> 0, k), { gecmis: satirlar() });
    const kod = C.oruntu(t.idx, ci);
    satirlar().push({ kelime: t.kelime, kod });
    kaydet();
    await Kit.kalem.bekle(o.hizli ? 120 : 260);
    const sure = miniSatir(k, kod, { anlik: false });
    BH.ses.cal('kalem', 0, sure);
    await Kit.kalem.bekle(sure + (o.hizli ? 60 : 120));
    if (kod === S().HEPSI_DOGRU) BH.sahne.duyur(`Bilgisayar kelimeyi ${k + 1}. tahminde buldu.`);
  }

  /* ---------- bilgisayarın küçük ızgarası (kâğıdın sağ üstü) ---------- */

  // Ana ızgaranın sağındaki boşluğa sığar (ana ızgaraya binmez); hücre 5–11 px
  function miniOlcu() {
    const o = BH.sahne.olcu, ara = 1.5;
    const sag = o.izgaraX + o.izgaraW + Math.max(6, o.g);
    const alan = o.kagitW - 6 - sag;
    const c = Math.max(5, Math.min(11, Math.floor((alan - 4 * ara) / 5)));
    const gw = 5 * c + 4 * ara;
    return { c, ara, gw, x0: sag + Math.max(0, (alan - gw) / 2), y0: o.dar ? 22 : 28 };
  }

  function miniCiz(o = {}) {
    const svg = BH.kagit.svg;
    if (!svg || !m) return;
    const eski = svg.querySelector('#mini');
    if (eski) eski.remove();
    const g = Kit.kalem.svgEl('g', { id: 'mini', class: 'mini-izgara' }, svg);
    const mo = miniOlcu();
    Kit.daktilo.yaz(g, 'bilgisayar', { x: mo.x0 + mo.gw / 2, y: mo.y0 - 4, boyut: Math.max(7, mo.c * .95), hiza: 'orta', anlik: true, tohum: ['mini'] });
    const K = Kit.kalem.kalemYap(svg);
    K.dikdortgen(g, [mo.x0 - 2.5, mo.y0 - 1.5, mo.gw + 5, 6 * mo.c + 5 * mo.ara + 3], { stroke: Kit.kopyakalemi.RENK.acik, strokeWidth: .8, roughness: .6 },
      ['mini-cerceve'], { anlik: true });
    satirlar().forEach((s, k) => miniSatir(k, s.kod, { anlik: true }));
  }

  function miniSatir(k, kod, o = {}) {
    const svg = BH.kagit.svg, g = svg && svg.querySelector('#mini');
    if (!g) return 0;
    const K = Kit.kalem.kalemYap(svg), KK = Kit.kopyakalemi, mo = miniOlcu();
    const isaret = S().oruntuAc(kod);
    let sure = 0;
    isaret.forEach((d, i) => {
      const x = mo.x0 + i * (mo.c + mo.ara), y = mo.y0 + k * (mo.c + mo.ara), an = ['mini', m.tohum, m.indeks, k, i];
      const gec = o.anlik ? 0 : i * 70;
      let s;
      if (d === 2) s = KK.tara(K, g, { x, y, w: mo.c, h: mo.c }, { ic: .4, aralik: Math.max(1.5, mo.c * .28), tohum: an, anlik: o.anlik, gecikme: gec });
      else if (d === 1) s = KK.cember(K, g, { cx: x + mo.c / 2, cy: y + mo.c / 2, r: mo.c * .4 }, { kalinlik: .9, tohum: an, anlik: o.anlik, gecikme: gec });
      else s = KK.ustunuCiz(K, g, { x1: x + 1, y1: y + mo.c - 1.5, x2: x + mo.c - 1, y2: y + 1.5 }, { kalinlik: .9, tohum: an, anlik: o.anlik, gecikme: gec });
      sure = Math.max(sure, gec + (s.sure || 0));
    });
    const kutu = document.getElementById('kagit');
    kutu.dataset.bilgisayar = `${satirlar().length}`;
    return sure;
  }

  /* ---------- kelime ve maç sonu ---------- */

  async function turBitir(x, o) {
    if (!m.turlar[m.indeks]) {
      const sen = x.sonuc === 'kazandi' ? x.tahminler.length : null;
      const sb = satirlar(), bulundu = sb.length && sb[sb.length - 1].kod === S().HEPSI_DOGRU;
      const bil = bulundu ? sb.length : null;
      const kazanan = sen == null && bil == null ? 'berabere' : sen == null ? 'bilgisayar' : bil == null ? 'sen' : sen < bil ? 'sen' : bil < sen ? 'bilgisayar' : 'berabere';
      m.skor[kazanan]++;
      m.turlar[m.indeks] = { cevap: x.cevap, sen, bilgisayar: bil, kazanan, bTahminler: sb.map((s) => s.kelime) };
      if (m.turlar.length >= m.uzunluk) m.bitti = true;
      kaydet();
    }
    const t = m.turlar[m.indeks];
    const tah = (n) => (n ? n + ' tahmin' : 'bulamadı');
    const kim = { sen: 'kelime senin', bilgisayar: 'kelime bilgisayarın', berabere: 'berabere' }[t.kazanan];
    const ozet = [`Sen ${tah(t.sen)} · Bilgisayar ${tah(t.bilgisayar)} — ${kim}`];
    if (m.bitti) {
      const s1 = m.skor.sen, b1 = m.skor.bilgisayar;
      ozet.push(`Maç bitti: Sen ${s1} – ${b1} Bilgisayar · ${s1 > b1 ? 'maçı sen aldın' : b1 > s1 ? 'maçı bilgisayar aldı' : 'berabere'}`);
    }
    const komutlar = m.bitti
      ? [['Yeni maç', () => notu(), 'du-yeni'], ['Paylaş', () => BH.sonuc.paylas(null, null, paylasimMetni()), 'du-paylas'], ['Ayrıntı', turNotu, 'du-ayrinti']]
      : [['Sonraki kelime', sonraki, 'du-sonraki'], ['Ayrıntı', turNotu, 'du-ayrinti']];
    await BH.sonuc.bitir(x, { anlik: o.anlik, anlam: BH.modlar.veri.anlam.get(x.cevap), satirlar: ozet, komutlar });
    if (!o.anlik) BH.sahne.duyur(ozet.join('. '));
  }

  function turNotu() {
    const t = m.turlar[m.indeks];
    if (!t) return;
    const sonuc = { sen: 'Kelimeyi sen aldın.', bilgisayar: 'Kelimeyi bilgisayar aldı.', berabere: 'Berabere.' }[t.kazanan];
    BH.not.ac({
      baslik: m.bitti ? 'Maç sonu' : `${m.indeks + 1}. kelime`,
      ciz(ic, y) {
        y.satir(`Kelime: ${t.cevap}`);
        y.satir(`Sen: ${t.sen ? t.sen + ' tahmin' : 'bulamadın'}`);
        y.satir(`Bilgisayar (${SEVIYE_ADI[m.seviye]}): ${t.bilgisayar ? t.bilgisayar + ' tahmin' : 'bulamadı'}`);
        y.satir(`Bilgisayarın tahminleri: ${t.bTahminler.join(', ')}`, { sinif: 'analiz-oneri' });
        y.satir(sonuc, { sinif: 'fis-ara' });
        y.satir(`Skor: Sen ${m.skor.sen} – ${m.skor.bilgisayar} Bilgisayar${m.skor.berabere ? ` (${m.skor.berabere} berabere)` : ''}`);
        if (m.bitti) {
          const s = m.skor.sen, b = m.skor.bilgisayar;
          y.satir(s > b ? 'Maçı sen kazandın.' : b > s ? 'Maçı bilgisayar kazandı.' : 'Maç berabere.', { sinif: 'fis-ara' });
        }
        const p = document.createElement('p'); p.className = 'not-komut'; ic.appendChild(p);
        y.komut('Analiz', () => BH.analiz.ac(), 'du-analiz', { kap: p });
        const d = document.createElement('p'); d.className = 'not-satir fis-durum'; d.id = 'du-durum'; d.setAttribute('role', 'status'); ic.appendChild(d);
      },
    });
  }

  function sonraki() {
    if (m.bitti) return notu();
    m.indeks++;
    m.oyuncu = null;
    m.bilgisayar = { satirlar: [] };
    kaydet();
    oyna();
  }

  function paylasimMetni() {
    const satir = m.turlar.map((t, i) => `${i + 1}. sen ${t.sen ?? 'X'}/6 · bilgisayar ${t.bilgisayar ?? 'X'}/6`);
    return [`Beş Harf · düello ${m.skor.sen}–${m.skor.bilgisayar} · ${SEVIYE_ADI[m.seviye]}`, ...satir].join('\n');
  }

  BH.duello = { notu, baslat, sonraki, turNotu, paylasimMetni, get mac() { return m; } };
})();
