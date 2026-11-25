// Katlama motoru: kağıt = dışbükey poligon yığını (0 = en alt). DOM'suz, değişmez (her adım yeni durum döndürür).
//
// Poligon = { id, noktalar (o anki düzlem, ccw), T (o anki → düz kağıt izometrisi), yuz: 'on'|'arka',
//             etiketler: ['h:3', 'kanat:sag', ...] }
// Durum   = { poligonlar, kirisiklar: [{ hareket, adim, tip, kat, yuz, p1, p2 }] (DÜZ kağıt koordinatı), sonId, hareketNo,
//             kagit: { en, boy } }  (varsayılan dikey A4: en 1, boy 1.414; yatay A4: en 1.41422, boy 1)
//           kat: vadi|dag (o anki üst yüze göre), yuz: kırışığın oluştuğu katmanda üstte duran yüz
// Hareket = tasarım adımının motor birimi; `ayna: true` adım iki hareket olur.
import * as G from './geom.js';

export const A4 = 1.414;
export const DIKEY = { en: 1, boy: A4 };
export const kagitOlcusu = (tasarim) => ({ ...DIKEY, ...((tasarim && tasarim.kagit) || {}) });

export class KatlamaHatasi extends Error {
  constructor(kod, mesaj) { super(`${kod}: ${mesaj || ''}`); this.kod = kod; }
}

export function baslangic(kagit = DIKEY) {
  const { en, boy } = kagit;
  return {
    poligonlar: [{ id: 1, noktalar: G.ccw([[0, 0], [en, 0], [en, boy], [0, boy]]), T: G.BIRIM, yuz: 'on', etiketler: [] }],
    kirisiklar: [], sonId: 1, hareketNo: 0, kagit: { en, boy },
  };
}

const ters = (yuz) => (yuz === 'on' ? 'arka' : 'on');

// "cizgi": [[x,y],[x,y]] ya da { nokta, hedef } (motor orta dikmeyi hesaplar).
export function cizgiCoz(c) {
  if (Array.isArray(c)) return c;
  if (c && c.nokta && c.hedef) return G.ortaDikme(c.nokta, c.hedef);
  throw new KatlamaHatasi('CizgiYok', 'adımda katlama çizgisi yok');
}

// Tasarım adımlarını harekete açar (ayna → iki hareket, kağıdın orta çizgisine göre).
export function hareketleriAc(tasarim) {
  const liste = [];
  const en = kagitOlcusu(tasarim).en;
  tasarim.adimlar.forEach((a, i) => {
    if (a.tip === 'cevir') {
      if (a.ayna || a.poz != null) throw new KatlamaHatasi('Desteklenmiyor', `adım ${i + 1}: çevir'de ayna/poz olmaz`);
      liste.push({ no: liste.length, adim: i, tip: 'cevir' });
      return;
    }
    if (a.tip !== 'vadi' && a.tip !== 'dag') throw new KatlamaHatasi('Desteklenmiyor', `adım ${i + 1}: tip ${a.tip}`);
    const katman = a.katman ?? 'hepsi';
    if (katman !== 'hepsi' && katman !== 'ust') throw new KatlamaHatasi('Desteklenmiyor', `adım ${i + 1}: katman ${katman}`);
    if (a.ayna && a.poz != null) throw new KatlamaHatasi('AynaPoz', `adım ${i + 1}: ayna adımına poz verilemez`);
    const cizgi = cizgiCoz(a.cizgi);
    const tut = a.tut ?? (a.cizgi && a.cizgi.nokta);
    if (!tut) throw new KatlamaHatasi('TutYok', `adım ${i + 1}`);
    const temel = { adim: i, tip: a.tip, cizgi, tut, katman, ac: !!a.ac, kanat: a.kanat ?? null, poz: a.poz ?? null };
    liste.push({ ...temel, no: liste.length, parca: 0 });
    if (a.ayna) {
      liste.push({
        ...temel, no: liste.length, parca: 1,
        cizgi: cizgi.map(([x, y]) => [en - x, y]), tut: [en - tut[0], tut[1]],
      });
    }
  });
  return liste;
}

export const hedef = (h) => G.yansit(h.cizgi, h.tut);

// Katlamanın hazırlığı: hangi parçalar hareket eder, nereden kesilir. Animasyon da bunu kullanır.
// Dönüş: { h, isaret, R, sabitler (yığın sırasıyla), hareketEdenler: [{ kaynak, indeks, noktalar }], kirisikler }
export function hazirla(durum, h) {
  const dTut = G.taraf(h.cizgi, h.tut);
  if (Math.abs(dTut) < 1e-6) throw new KatlamaHatasi('TutCizgiUstunde', `hareket ${h.no}`);
  const isaret = Math.sign(dTut);
  const P = durum.poligonlar;

  const bilgi = P.map((p) => {
    let mp = G.kes(p.noktalar, h.cizgi, isaret);
    let sp = G.kes(p.noktalar, h.cizgi, -isaret);
    const aM = mp.length ? Math.abs(G.alan(mp)) : 0;
    const aS = sp.length ? Math.abs(G.alan(sp)) : 0;
    const aday = aM > G.ALAN_EPS;
    if (aday && aS <= G.ALAN_EPS) { mp = p.noktalar; sp = []; }      // kıymık kalmasın: bütün olarak taşı
    return { mp, sp, aday, duz: aday ? mp.map(q => G.donustur(p.T, q)) : null };
  });

  const M = new Set();
  if (h.katman === 'hepsi') {
    bilgi.forEach((b, i) => { if (b.aday) M.add(i); });
  } else {
    let ust = -1;
    for (let i = P.length - 1; i >= 0; i--) {
      if (bilgi[i].aday && G.icinde(P[i].noktalar, h.tut, 1e-6)) { ust = i; break; }
    }
    if (ust < 0) throw new KatlamaHatasi('TutKagitDisinda', `hareket ${h.no}: tut bir katmanın üstünde değil`);
    // tut'un katmanından kırışıklar üzerinden ulaşılan bileşen (yalnız hareket eden taraftaki parçalarla)
    const bilesen = (bas) => {
      const yigin = [bas];
      M.add(bas);
      while (yigin.length) {
        const i = yigin.pop();
        bilgi.forEach((b, j) => {
          if (M.has(j) || !b.aday) return;
          if (G.kenarPaylasir(bilgi[i].duz, b.duz)) { M.add(j); yigin.push(j); }
        });
      }
    };
    bilesen(ust);
    // kapanış: hareket eden bir katmanın üstünde (vadi) / altında (dağ) duran, örtüşen katman da gitmek zorunda
    const vadi = h.tip === 'vadi';
    let degisti = true;
    while (degisti) {
      degisti = false;
      for (let j = 0; j < P.length && !degisti; j++) {
        if (M.has(j) || !bilgi[j].aday) continue;
        for (const i of M) {
          if ((vadi ? j > i : j < i) && G.kesisimAlani(bilgi[i].mp, bilgi[j].mp) > 1e-9) {
            bilesen(j);
            degisti = true;
            break;
          }
        }
      }
    }
  }
  if (!M.size) throw new KatlamaHatasi('HareketEdenYok', `hareket ${h.no}`);

  const sabitler = [], hareketEdenler = [], kirisikler = [];
  const yon = G.fark(h.cizgi[1], h.cizgi[0]);
  P.forEach((p, i) => {
    const b = bilgi[i];
    if (!M.has(i)) { sabitler.push(p); return; }
    if (b.sp.length) sabitler.push({ ...p, noktalar: b.sp });
    hareketEdenler.push({ kaynak: p, indeks: i, noktalar: b.mp });
    const ust = b.mp.filter(q => Math.abs(G.taraf(h.cizgi, q)) < 1e-7)
      .sort((u, v) => G.ic(u, yon) - G.ic(v, yon));
    if (ust.length >= 2 && G.uzaklik(ust[0], ust[ust.length - 1]) > 1e-6) {
      kirisikler.push({
        hareket: h.no, adim: h.adim, tip: h.ac ? 'ac' : h.tip, kat: h.tip, yuz: p.yuz,
        p1: G.donustur(p.T, ust[0]), p2: G.donustur(p.T, ust[ust.length - 1]),
      });
    }
  });
  return { h, isaret, R: G.yansimaT(h.cizgi), sabitler, hareketEdenler, kirisikler };
}

// Kağıdı ters çevir: kağıdın orijinal orta çizgisine göre x → en − x (sonraki adımların koordinatı öngörülebilir).
export function cevir(durum) {
  const Mx = [-1, 0, 0, 1, (durum.kagit || DIKEY).en, 0];
  return {
    ...durum,
    poligonlar: durum.poligonlar.map(p => ({
      ...p, noktalar: G.ccw(p.noktalar.map(q => G.donustur(Mx, q))), T: G.birlestir(p.T, Mx), yuz: ters(p.yuz),
    })).reverse(),
    hareketNo: durum.hareketNo + 1,
  };
}

export function katla(durum, h) {
  if (h.tip === 'cevir') return cevir(durum);
  const hz = hazirla(durum, h);
  let sonId = durum.sonId;
  const yeni = hz.hareketEdenler.map(({ kaynak, noktalar }) => ({
    id: ++sonId,
    noktalar: G.ccw(noktalar.map(q => G.donustur(hz.R, q))),
    T: G.birlestir(kaynak.T, hz.R),
    yuz: ters(kaynak.yuz),
    etiketler: [...kaynak.etiketler, 'h:' + h.no, ...(h.kanat ? ['kanat:' + h.kanat] : [])],
  })).reverse();
  const kirisiklar = [...durum.kirisiklar, ...hz.kirisikler];
  if (h.ac) return { ...durum, kirisiklar, hareketNo: durum.hareketNo + 1 };
  const poligonlar = h.tip === 'dag' ? [...yeni, ...hz.sabitler] : [...hz.sabitler, ...yeni];
  for (const p of poligonlar) {
    if (Math.abs(Math.abs(G.detT(p.T)) - 1) > 1e-6) throw new KatlamaHatasi('Izometri', `poligon ${p.id}`);
  }
  return { poligonlar, kirisiklar, sonId, hareketNo: durum.hareketNo + 1, kagit: durum.kagit };
}

// Bütün tasarımı uygula. anlar[k] = k. hareketten ÖNCEKİ durum; anlar[son] = bitmiş uçak.
export function uygula(tasarim) {
  const hareketler = hareketleriAc(tasarim);
  const kagit = kagitOlcusu(tasarim);
  const anlar = [baslangic(kagit)];
  for (const h of hareketler) anlar.push(katla(anlar[anlar.length - 1], h));
  const adimlar = tasarim.adimlar.map((a, i) => {
    const hs = hareketler.filter(h => h.adim === i);
    return { adim: a, no: i, hareketler: hs, once: hs[0].no, sonra: hs[hs.length - 1].no + 1 };
  });
  return { hareketler, anlar, adimlar, son: anlar[anlar.length - 1], kagit };
}

// Bütün adımları (ara durumlar, tut noktaları, hedefler) kapsayan kutu: atölye/not görünüm çerçevesi için.
export function tasarimKutusu(katlama) {
  let [x0, y0, x1, y1] = [0, 0, katlama.kagit.en, katlama.kagit.boy];
  const ekle = ([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const d of katlama.anlar) { const k = kutu(d); ekle([k[0], k[1]]); ekle([k[2], k[3]]); }
  for (const h of katlama.hareketler) if (h.tip !== 'cevir') { ekle(h.tut); ekle(hedef(h)); }
  return [x0, y0, x1, y1];
}

/* ---------- sorgular ---------- */

export function kutu(durum) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of durum.poligonlar) for (const [x, y] of p.noktalar) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

export const alanToplami = (durum) => durum.poligonlar.reduce((s, p) => s + Math.abs(G.alan(p.noktalar)), 0);

export function ustPoligon(durum, nokta) {
  for (let i = durum.poligonlar.length - 1; i >= 0; i--) {
    if (G.icinde(durum.poligonlar[i].noktalar, nokta, 1e-9)) return durum.poligonlar[i];
  }
  return null;
}

// En kalın yerdeki katman sayısı (0.01 aralıklı ızgarada).
export function enKalin(durum, adim = 0.01) {
  let enCok = 0;
  const [, , xs, ys] = kutu(durum);
  for (let x = adim / 2; x < xs; x += adim) {
    for (let y = adim / 2; y < ys; y += adim) {
      let n = 0;
      for (const p of durum.poligonlar) if (G.icinde(p.noktalar, [x, y], -1e-9)) n++;
      if (n > enCok) enCok = n;
    }
  }
  return enCok;
}

// Bir poligonun üstünde görünen kırışıklar (o anki koordinatta). Varsayılan: yalnız ön kırışıklar ('ac').
export function kirisikler(durum, p, tipler = ['ac']) {
  const duz = G.ccw(p.noktalar.map(q => G.donustur(p.T, q)));     // yansımış T yönü çevirir
  const Ti = G.tersT(p.T);
  const sonuc = [];
  for (const k of durum.kirisiklar) {
    if (tipler && !tipler.includes(k.tip)) continue;
    const s = G.parcaKirp([k.p1, k.p2], duz);
    if (s) sonuc.push([G.donustur(Ti, s[0]), G.donustur(Ti, s[1])]);
  }
  return sonuc;
}

export const kirisikDeseni = (durum) => durum.kirisiklar;
