// ai.js — bilgisayar rakibin hamle seçimi. Saf fonksiyonlar: DOM yok. Kuralları game.js'ten alır.
//
//   SOS.ai.sec(durum, { zorluk, tamAramaBos }, r) → { i, harf, katman }
//
// Katmanlar (sırayla):
//   1. puan al      — puan getiren hamle varsa en çok SOS yapanı (fazla turla zincir dahil) oyna
//   2. güvenli oyna — rakibe yeni SOS fırsatı bırakmayan hamleler arasından seç; hamleden sonra kalan güvenli
//                     hücre sayısı ÇİFT kalsın (rakip ilk zorunlu hatayı yapsın). Yaklaşık bir sezgi.
//   3. az kaybettir — güvenli hamle yoksa rakibin alabileceği puanı (zincir dahil) en aza indir
// Zorluk: kolay = yalnız 1. katman, gerisi rastgele · orta = 1 + 2 (gerisi rastgele) · zor = 1 + 2 + 3,
// ve son tamAramaBos boş hücrede (varsayılan 12, config.ai.tamAramaBos) kesin sonucu veren tam arama.
// Durum tutmaz: her karar yalnız verilen durumdan türer.
(function () {
  'use strict';

  const G = (typeof module !== 'undefined' && module.exports) ? require('./game.js') : window.SOS.game;
  const AI = {};
  const S = 1, O = 2;
  const YON8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const EKSEN4 = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const harfAdi = (kod) => (kod === S ? 'S' : 'O');

  /* ---------- hızlı SOS sayımı (tahta boyutuna göre bir kez hazırlanan komşuluk tabloları) ---------- */

  const tablolar = new Map();
  function tablo(n) {
    let t = tablolar.get(n);
    if (t) return t;
    t = { s: [], o: [] };                                   // s[i]: S kondu → (i+d, i+2d) çiftleri · o[i]: O kondu → (i-d, i+d) çiftleri
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, s = [], o = [];
      for (const [dr, dc] of YON8) {
        const r2 = r + 2 * dr, c2 = c + 2 * dc;
        if (r2 >= 0 && c2 >= 0 && r2 < n && c2 < n) s.push((r + dr) * n + c + dc, r2 * n + c2);
      }
      for (const [dr, dc] of EKSEN4) {
        const ra = r - dr, ca = c - dc, rb = r + dr, cb = c + dc;
        if (ra >= 0 && ca >= 0 && ra < n && ca < n && rb >= 0 && cb >= 0 && rb < n && cb < n) o.push(ra * n + ca, rb * n + cb);
      }
      t.s[i] = Int16Array.from(s);
      t.o[i] = Int16Array.from(o);
    }
    tablolar.set(n, t);
    return t;
  }

  // i hücresine kod konsa kaç SOS tamamlanır (hücrenin kendi içeriğine bakılmaz)
  function say(hucre, t, i, kod) {
    let k = 0;
    if (kod === S) {
      const p = t.s[i];
      for (let j = 0; j < p.length; j += 2) if (hucre[p[j]] === O && hucre[p[j + 1]] === S) k++;
    } else {
      const p = t.o[i];
      for (let j = 0; j < p.length; j += 2) if (hucre[p[j]] === S && hucre[p[j + 1]] === S) k++;
    }
    return k;
  }

  /* ---------- zincir: bir turda yalnız puan getiren hamlelerle alınabilecek en çok puan ---------- */

  // Sıradaki oyuncunun elindeki puanlı hamleleri [i, kod, adet] üçlüleri olarak toplar.
  function puanliHamleler(hucre, t) {
    const liste = [];
    for (let i = 0; i < hucre.length; i++) {
      if (hucre[i] !== 0) continue;
      for (let kod = S; kod <= O; kod++) {
        const k = say(hucre, t, i, kod);
        if (k > 0) liste.push(i, kod, k);
      }
    }
    return liste;
  }

  // Fazla tur açıksa puan yapan aynı turda devam eder: en iyi sıralamayı arar. Aynı tahtaya farklı sıralarla varılır;
  // değer yalnız tahtaya bağlı olduğu için tahta anahtarıyla ezberlenir (sıralamalar kümeye iner). Bütçe açılan farklı
  // tahta sayısıdır: aşılınca tahta derine inmeden (alt sınırla) değerlenir; böylece çok fırsatlı konumlarda donma olmaz.
  // Sonuç hiçbir zaman gerçek değerden büyük değildir.
  function* zincir(hucre, t, fazlaTur, butce) {
    if ((++butce.adim & 63) === 0) yield;
    const l = puanliHamleler(hucre, t);
    if (!l.length) return 0;
    let en = 0;
    if (!fazlaTur) {                                         // sıra geçer: yalnız tek hamlenin en çok puanı
      for (let j = 2; j < l.length; j += 3) if (l[j] > en) en = l[j];
      return en;
    }
    const anahtar = hucre.join('');
    const b = butce.bellek.get(anahtar);
    if (b !== undefined) return b;
    const derin = butce.kalan-- > 0;
    for (let j = 0; j < l.length; j += 3) {
      const i = l[j], kod = l[j + 1], k = l[j + 2];
      let v = k;
      if (derin) {
        hucre[i] = kod;
        v += yield* zincir(hucre, t, fazlaTur, butce);
        hucre[i] = 0;
      }
      if (v > en) en = v;
    }
    butce.bellek.set(anahtar, en);
    return en;
  }
  // Bir karar boyunca tek ezber ve ortak bütçe: farklı adaylardan da aynı tahtalara varılır (değer yalnız tahtaya bağlı).
  const BUTCE = 10000;
  const yeniButce = () => ({ kalan: BUTCE, bellek: new Map(), adim: 0 });

  /* ---------- yardımcılar ---------- */

  const sec_ = (liste, r) => liste[Math.floor(r() * liste.length)];
  const enIyiler = (liste, anahtar, enBuyuk, r) => {         // en iyi değerli olanlardan rastgele biri
    let eniyi = enBuyuk ? -Infinity : Infinity, aday = [];
    for (const x of liste) {
      const v = anahtar(x);
      if (v === eniyi) aday.push(x);
      else if (enBuyuk ? v > eniyi : v < eniyi) { eniyi = v; aday = [x]; }
    }
    return sec_(aday, r);
  };

  function bosHamleler(d) {                                  // tüm (hücre, harf) çiftleri
    const l = [];
    for (let i = 0; i < d.hucre.length; i++) if (d.hucre[i] === 0) l.push({ i, kod: S }, { i, kod: O });
    return l;
  }
  const cevir = (m, katman) => ({ i: m.i, harf: harfAdi(m.kod), katman });

  /* ---------- son oyun: ezberli tam arama ---------- */

  // Kalan boş hücreler için kesin değer: f(konum) = sıradakinin (kalan puanı − rakibin kalan puanı), en iyi oyunla.
  // Değer yalnız konuma bağlıdır (kimin sırada olduğu fark etmez), bu yüzden ezber anahtarı yalnız boş hücrelerin
  // 3 tabanındaki içeriğidir. Puan yapan fazla turla devam eder: v = k + f(sonraki); yoksa v = k − f(sonraki).
  // Döner: { deger, hamleler: [{ i, harf, deger }] } — deger: bu durumdaki sıradaki oyuncu için.
  function* tamArama(d) {
    const n = d.n, t = tablo(n), hucre = Int8Array.from(d.hucre), fazla = d.fazlaTur;
    const E = [];
    for (let i = 0; i < hucre.length; i++) if (hucre[i] === 0) E.push(i);
    const m = E.length;
    if (m > 13) throw new RangeError(`Tam arama için en fazla 13 boş hücre: ${m}`);
    const us = [1];
    for (let j = 1; j <= m; j++) us[j] = us[j - 1] * 3;
    const bellek = new Int8Array(us[m]);

    // Büyük üçlü anahtardan küçüğe: her devam konumu daha önce hesaplanmıştır.
    // Özyinelemeli generator yerine bu ortak akış, pahalı çağrı yığınları kurmadan dilimlenebilir.
    for (const i of E) hucre[i] = O;
    for (let anahtar = us[m] - 1; anahtar >= 0; anahtar--) {
      let en = -127;
      for (let j = 0; j < m; j++) {
        const i = E[j];
        if (hucre[i] !== 0) continue;
        for (let kod = S; kod <= O; kod++) {
          const k = say(hucre, t, i, kod);
          const sonraki = bellek[anahtar + kod * us[j]];
          const v = k + (k > 0 && fazla ? sonraki : -sonraki);
          if (v > en) en = v;
        }
      }
      bellek[anahtar] = en === -127 ? 0 : en;
      // Ters üçlü sayaç: yalnız değişen basamakları tahtaya uygula.
      for (const i of E) {
        if (hucre[i] > 0) { hucre[i]--; break; }
        hucre[i] = O;
      }
      if ((anahtar & 255) === 0) yield;
    }
    for (const i of E) hucre[i] = 0;

    const hamleler = [];
    let deger = -127;
    for (let j = 0; j < m; j++) {
      const i = E[j];
      for (let kod = S; kod <= O; kod++) {
        const k = say(hucre, t, i, kod);
        const sonraki = bellek[kod * us[j]];
        const v = (k > 0 && fazla && m > 1) ? k + sonraki : k - sonraki;
        hamleler.push({ i, harf: harfAdi(kod), deger: v });
        if (v > deger) deger = v;
      }
    }
    return { deger, hamleler };
  };

  /* ---------- hamle seçimi ---------- */

  function* secim(d, secenek = {}, r = Math.random) {
    if (d.bitti || d.bos === 0) throw new Error('Oynanacak hücre kalmadı');
    const zorluk = secenek.zorluk || 'orta';
    const n = d.n, t = tablo(n);
    const hucre = Int8Array.from(d.hucre);                   // arama kopya üzerinde çalışır; d değişmez

    // Zor: son hamlelerde kesin arama
    if (zorluk === 'zor' && d.bos <= Math.min(secenek.tamAramaBos ?? 12, 13)) {
      const { deger, hamleler } = yield* tamArama(d);
      const m = sec_(hamleler.filter(h => h.deger === deger), r);
      return { i: m.i, harf: m.harf, katman: 'son-oyun' };
    }

    // 1. Puan al
    const l = puanliHamleler(hucre, t);
    if (l.length) {
      const puanli = [];
      for (let j = 0; j < l.length; j += 3) puanli.push({ i: l[j], kod: l[j + 1], adet: l[j + 2] });
      if (zorluk === 'kolay') return cevir(enIyiler(puanli, m => m.adet, true, r), 'puan');
      const butce = yeniButce();
      const olcu = new Map();
      for (const m of puanli) {
        let v = m.adet;
        if (d.fazlaTur) { hucre[m.i] = m.kod; v += yield* zincir(hucre, t, true, butce); hucre[m.i] = 0; }
        olcu.set(m, v);
        yield;
      }
      const eniyi = Math.max(...olcu.values());
      const adaylar = puanli.filter(m => olcu.get(m) === eniyi);
      return cevir(enIyiler(adaylar, m => m.adet, true, r), 'puan');
    }

    const hepsi = bosHamleler(d);
    if (zorluk === 'kolay') return cevir(sec_(hepsi, r), 'rastgele');

    // 2. Güvenli oyna (+ parite)
    const guvenli = hepsi.filter(m => G.isSafe(d, Math.floor(m.i / n), m.i % n, harfAdi(m.kod)));
    if (guvenli.length) {
      const cift = [];
      for (const m of guvenli) {
        hucre[m.i] = m.kod;
        const kalan = G.guvenliSayisi({ n, hucre });
        hucre[m.i] = 0;
        if (kalan % 2 === 0) cift.push(m);
        yield;
      }
      return cevir(sec_(cift.length ? cift : guvenli, r), 'guvenli');
    }
    if (zorluk === 'orta') return cevir(sec_(hepsi, r), 'rastgele');

    // 3. Mecbur kalınca en az kaybettir: rakibin o turda alabileceği toplam (zincir dahil) en küçük olan
    const butce = yeniButce();
    const kayip = new Map();
    for (const m of hepsi) {
      hucre[m.i] = m.kod;
      kayip.set(m, yield* zincir(hucre, t, d.fazlaTur, butce));
      hucre[m.i] = 0;
      yield;
    }
    return cevir(enIyiler(hepsi, m => kayip.get(m), false, r), 'az-kayip');
  }

  // İki API aynı hesaplama akışını tüketir; rastgele seçim sırası ve kararlar aynıdır.
  function bitir(akis) {
    let adim;
    do { adim = akis.next(); } while (!adim.done);
    return adim.value;
  }
  AI.tamArama = d => bitir(tamArama(d));
  AI.sec = (d, secenek, r) => bitir(secim(d, secenek, r));

  AI.secAsync = async function (d, secenek = {}, r = Math.random, { signal } = {}) {
    const akis = secim(d, secenek, r);
    function iptalKontrol() {
      if (signal && signal.aborted) {
        const hata = new Error('Hamle hesabı iptal edildi');
        hata.name = 'AbortError';
        throw hata;
      }
    }
    try {
      for (;;) {
        iptalKontrol();
        const son = performance.now() + 8;
        do {
          const adim = akis.next();
          if (adim.done) return adim.value;
        } while (performance.now() < son);
        // Mikro görevler çizime fırsat vermez; yeni bir görevde devam et.
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally { akis.return(); }
  };

  // Test ve hata ayıklama için
  AI.zincir = function (d) { return bitir(zincir(Int8Array.from(d.hucre), tablo(d.n), d.fazlaTur, yeniButce())); };
  AI.ZINCIR_BUTCE = BUTCE;

  if (typeof window !== 'undefined') (window.SOS = window.SOS || {}).ai = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})();
