// board.js — saha grafı ve kural motoru. DOM'a dokunmaz; tarayıcıda window.KF.board, node'da require('./board.js').
// Koordinatlar tam sayı: x = 0..W, y = 0..H; kale içi noktaları y = −1 ve y = H+1. Oyuncu 0 (ben) üst kaleye (y=−1),
// oyuncu 1 (rakip) alt kaleye (y=H+1) gol atar. Kurallar istekteki §3–4 tanımına birebir uyar (bkz. PLAN.md, kararlar).
//
//   const G = B.kur({ W: 8, H: 10, kesisme: true, agizSeker: true });   // graf bir kez kurulur
//   const d = B.baslangic(G, 0);                         // durum; 0 başlar
//   const r = B.yap(G, d, B.kenarXY(G, 4, 5, 4, 4));    // { gol, sikisti, sekti, siraGecti }
//   B.geriAl(G, d);                                      // değiştir-geri-al: arama için kopyasız
(function () {
  'use strict';

  const KF = typeof window !== 'undefined' ? (window.KF = window.KF || {}) : {};

  // 8 yön: ilk dördü ileri (kenar tablosu bunlarla kurulur), karşıtı (y+4)%8
  const DX = [1, 0, 1, -1, -1, 0, -1, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  const YON = [];                                    // (dx+1)*3 + (dy+1) → yön
  for (let y = 0; y < 8; y++) YON[(DX[y] + 1) * 3 + (DY[y] + 1)] = y;

  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- saha grafı ---------- */

  // ayar: { W, H, kesisme = true, agizSeker = true }
  //   agizSeker: kale ağzı ortası (W/2, 0) ve (W/2, H) baştan ziyaretli sayılır (top oraya varınca seker). false: temiz.
  //   H tek sayı olabilir; o zaman başlangıç noktası başlayana göre değişir (baslangicNoktasi).
  function kur(ayar) {
    const W = ayar.W, H = ayar.H, kesisme = ayar.kesisme !== false, agizSeker = ayar.agizSeker !== false;
    if (!Number.isInteger(W) || W < 4 || W % 2) throw new Error('W çift ve en az 4 olmalı: ' + W);
    if (!Number.isInteger(H) || H < 2) throw new Error('H en az 2 olmalı: ' + H);
    const m = W / 2, GW = W + 1, P = GW * (H + 3);
    const pid = (x, y) => (y + 1) * GW + x;          // sınır kutusu: y ∈ [−1, H+1]

    const nx = new Int8Array(P), ny = new Int8Array(P);
    const gecerli = new Uint8Array(P);
    const golKazanan = new Int8Array(P).fill(-1);    // kale içi noktaya top girince kazanan oyuncu
    const onZiyaret = new Uint8Array(P);             // sınır noktaları baştan ziyaret edilmiş (ağız ortası dahil)
    for (let y = -1; y <= H + 1; y++) {
      for (let x = 0; x <= W; x++) {
        const p = pid(x, y);
        nx[p] = x; ny[p] = y;
        const saha = y >= 0 && y <= H;
        const kaleIci = (y === -1 || y === H + 1) && x >= m - 1 && x <= m + 1;
        gecerli[p] = saha || kaleIci ? 1 : 0;
        if (kaleIci) { golKazanan[p] = y === -1 ? 0 : 1; onZiyaret[p] = 1; }
        const agizOrtasi = x === m && (y === 0 || y === H);
        if (saha && (x === 0 || x === W || y === 0 || y === H) && (agizSeker || !agizOrtasi)) onZiyaret[p] = 1;
      }
    }

    // Kenarlar: her noktadan 4 ileri yön. Orta nokta (2 katıyla, kesirsiz) kapalı saha ya da kapalı kale dikdörtgeninde olmalı.
    const ea = [], eb = [], eyon = [], ecizili = [];
    for (let p = 0; p < P; p++) {
      if (!gecerli[p]) continue;
      const x = nx[p], y = ny[p];
      for (let yon = 0; yon < 4; yon++) {
        const x2 = x + DX[yon], y2 = y + DY[yon];
        if (x2 < 0 || x2 > W || y2 < -1 || y2 > H + 1) continue;
        const q = pid(x2, y2);
        if (!gecerli[q]) continue;
        const mx = 2 * x + DX[yon], my = 2 * y + DY[yon];
        const sahada = mx >= 0 && mx <= 2 * W && my >= 0 && my <= 2 * H;
        const ustKale = mx >= 2 * (m - 1) && mx <= 2 * (m + 1) && my >= -2 && my <= 0;
        const altKale = mx >= 2 * (m - 1) && mx <= 2 * (m + 1) && my >= 2 * H && my <= 2 * H + 2;
        if (!(sahada || ustKale || altKale)) continue;
        let cizili = false;
        if (yon === 0) {                              // yatay: arka çizgiler ve sınır (ağız kenarları hariç)
          cizili = y === -1 || y === H + 1 || ((y === 0 || y === H) && !(x >= m - 1 && x2 <= m + 1));
        } else if (yon === 1) {                       // dikey: yan sınırlar ve kale yan kenarları (ortadaki dikey açık)
          cizili = x === 0 || x === W || ((y === -1 || y2 === H + 1) && (x === m - 1 || x === m + 1));
        }
        ea.push(p); eb.push(q); eyon.push(yon); ecizili.push(cizili ? 1 : 0);
      }
    }
    const E = ea.length;
    const komKenar = new Int16Array(P * 8).fill(-1), komNokta = new Int16Array(P * 8).fill(-1);
    for (let e = 0; e < E; e++) {
      komKenar[ea[e] * 8 + eyon[e]] = e; komNokta[ea[e] * 8 + eyon[e]] = eb[e];
      const ters = (eyon[e] + 4) % 8;
      komKenar[eb[e] * 8 + ters] = e; komNokta[eb[e] * 8 + ters] = ea[e];
    }
    // Kesişen çift: aynı birim karenin iki çaprazı. Dik kenarlar hiçbir şeyi kesmez.
    const kesisen = new Int16Array(E).fill(-1);
    for (let e = 0; e < E; e++) {
      const a = ea[e];
      if (eyon[e] === 2) {                            // (x,y)-(x+1,y+1) ↔ (x+1,y)-(x,y+1)
        const y = ny[a] , x = nx[a];
        if (x + 1 <= W) kesisen[e] = komKenar[pid(x + 1, y) * 8 + 3];
      } else if (eyon[e] === 3) {                     // (x,y)-(x−1,y+1) ↔ (x−1,y)-(x,y+1)
        const y = ny[a], x = nx[a];
        if (x - 1 >= 0) kesisen[e] = komKenar[pid(x - 1, y) * 8 + 2];
      }
    }

    // Zobrist: kenar, top konumu ve sıra için ikişer 32 bit (anahtar = 53 bit)
    const r = mulberry32(0x6B6B6B);
    const rast = (n) => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = (r() * 4294967296) >>> 0; return a; };

    const BITTI = [0, 1].map(k => [{ kazanan: k, sebep: 'gol' }, { kazanan: k, sebep: 'sikisma' }]);
    let nCizili = 0;
    for (let e = 0; e < E; e++) nCizili += ecizili[e];
    let nNokta = 0;
    for (let p = 0; p < P; p++) nNokta += gecerli[p];

    return {
      W, H, m, P, E, kesisme, agizSeker, GW, nw: (E + 31) >>> 5,
      nx, ny, gecerli, golKazanan, onZiyaret,
      ea: Int16Array.from(ea), eb: Int16Array.from(eb), eyon: Int8Array.from(eyon), onCizili: Uint8Array.from(ecizili),
      kesisen, komKenar, komNokta,
      zE1: rast(E), zE2: rast(E), zT1: rast(P), zT2: rast(P), zS: rast(2),
      BITTI, gecici: new Int16Array(8),
      sayilar: { nokta: nNokta, kenar: E, cizili: nCizili, oynanabilir: E - nCizili },
    };
  }

  const nokta = (G, x, y) => (x < 0 || x > G.W || y < -1 || y > G.H + 1) ? -1 : (G.gecerli[(y + 1) * G.GW + x] ? (y + 1) * G.GW + x : -1);
  const koordinat = (G, p) => [G.nx[p], G.ny[p]];

  // p ile q bitişik ve aralarında geçerli kenar varsa kenar indeksi, yoksa −1
  function kenarAra(G, p, q) {
    if (p < 0 || q < 0) return -1;
    const dx = G.nx[q] - G.nx[p], dy = G.ny[q] - G.ny[p];
    if (dx < -1 || dx > 1 || dy < -1 || dy > 1 || (!dx && !dy)) return -1;
    return G.komKenar[p * 8 + YON[(dx + 1) * 3 + (dy + 1)]];
  }
  const kenarXY = (G, x1, y1, x2, y2) => kenarAra(G, nokta(G, x1, y1), nokta(G, x2, y2));

  /* ---------- durum ---------- */

  const kullanildi = (d, e) => (d.kullanilan[e >>> 5] >>> (e & 31)) & 1;
  const ziyaretli = (G, d, p) => d.derece[p] > 0 || G.onZiyaret[p] === 1;

  function hashHesapla(G, d) {
    let h1 = 0, h2 = 0;
    for (let e = 0; e < G.E; e++) if (kullanildi(d, e)) { h1 ^= G.zE1[e]; h2 ^= G.zE2[e]; }
    h1 ^= G.zT1[d.top]; h2 ^= G.zT2[d.top];
    if (d.sira) { h1 ^= G.zS[0]; h2 ^= G.zS[1]; }
    d.h1 = h1 >>> 0; d.h2 = h2 >>> 0;
  }
  // Transposition table / tekilleştirme anahtarı: 21 + 32 = 53 bit, tam sayı
  const anahtar = (d) => (d.h2 & 0x1FFFFF) * 4294967296 + d.h1;

  function isaretle(G, d, e) {
    d.kullanilan[e >>> 5] |= (1 << (e & 31));
    d.derece[G.ea[e]]++; d.derece[G.eb[e]]++;
  }

  // Başlangıç noktası: H çiftse tam orta. H tekse orta iki satırdan başlayanın KENDİ kalesine yakın olanı
  // (oyuncu 0 alttaki kaleyi savunur → (H+1)/2; oyuncu 1 üsttekini → (H−1)/2): ilk hamle avantajı dengelenir.
  function baslangicNoktasi(G, baslayan = 0) {
    const y = G.H % 2 === 0 ? G.H / 2 : (baslayan === 1 ? (G.H - 1) / 2 : (G.H + 1) / 2);
    return nokta(G, G.m, y);
  }

  function yeniDurum(G, sira) {
    return { top: baslangicNoktasi(G, sira), kullanilan: new Uint32Array(G.nw), derece: new Uint8Array(G.P),
      sira, bitti: null, zincir: 0, h1: 0, h2: 0, gecmis: [] };
  }

  // Başlangıç: top ortada, baştan çizili kenarlar işli
  function baslangic(G, baslayan = 0) {
    const d = yeniDurum(G, baslayan);
    for (let e = 0; e < G.E; e++) if (G.onCizili[e]) isaretle(G, d, e);
    hashHesapla(G, d);
    return d;
  }

  // Test ve konum kurma: o = { top: [x,y], kenarlar: [[[x1,y1],[x2,y2]], ...], sira }
  function kurulum(G, o) {
    const d = baslangic(G, o.sira || 0);
    for (const [[x1, y1], [x2, y2]] of (o.kenarlar || [])) {
      const e = kenarXY(G, x1, y1, x2, y2);
      if (e < 0) throw new Error(`geçersiz kenar: (${x1},${y1})-(${x2},${y2})`);
      if (!kullanildi(d, e)) isaretle(G, d, e);
    }
    const p = nokta(G, o.top[0], o.top[1]);
    if (p < 0) throw new Error('geçersiz top noktası');
    d.top = p;
    hashHesapla(G, d);
    return d;
  }

  const kopyala = (d) => ({ top: d.top, kullanilan: d.kullanilan.slice(), derece: d.derece.slice(), sira: d.sira,
    bitti: d.bitti, zincir: d.zincir, h1: d.h1, h2: d.h2, gecmis: [] });

  /* ---------- hamle ---------- */

  // Toptan çıkan, kullanılmamış geçerli kenarlar (kesişme kapalıysa çaprazın eşi de boş olmalı). out'a yazar, sayıyı döner.
  function yasalKenarlar(G, d, out) {
    if (d.bitti) return 0;
    let n = 0;
    const taban = d.top * 8, k = d.kullanilan;
    for (let y = 0; y < 8; y++) {
      const e = G.komKenar[taban + y];
      if (e < 0 || ((k[e >>> 5] >>> (e & 31)) & 1)) continue;
      if (!G.kesisme) { const c = G.kesisen[e]; if (c >= 0 && ((k[c >>> 5] >>> (c & 31)) & 1)) continue; }
      out[n++] = e;
    }
    return n;
  }
  function yasalListe(G, d) {
    const n = yasalKenarlar(G, d, G.gecici);
    return Array.from(G.gecici.subarray(0, n));
  }
  const yasalMi = (G, d, e) => yasalListe(G, d).includes(e);

  // Çekirdek: kenarı çiz, topu taşı, sonucu çöz. Dönüş bitleri: 1 sekti · 2 sıra geçti · 4 gol · 8 sıkışma.
  // Öncelik: gol > sekme > sıkışma. Sekme testi hedefe varmadan ÖNCEKİ durumdadır.
  function yapIc(G, d, e) {
    const a = G.ea[e], b = G.eb[e];
    const eski = d.top, hedef = eski === a ? b : a;
    const sekti = d.derece[hedef] > 0 || G.onZiyaret[hedef] === 1;
    d.gecmis.push(e, eski, d.sira, d.zincir);
    isaretle(G, d, e);
    d.h1 = (d.h1 ^ G.zE1[e] ^ G.zT1[eski] ^ G.zT1[hedef]) >>> 0;
    d.h2 = (d.h2 ^ G.zE2[e] ^ G.zT2[eski] ^ G.zT2[hedef]) >>> 0;
    d.top = hedef;
    const gk = G.golKazanan[hedef];
    if (gk >= 0) { d.bitti = G.BITTI[gk][0]; d.zincir++; return 4; }
    let kod;
    if (sekti) { d.zincir++; kod = 1; }
    else { d.sira ^= 1; d.h1 = (d.h1 ^ G.zS[0]) >>> 0; d.h2 = (d.h2 ^ G.zS[1]) >>> 0; d.zincir = 0; kod = 2; }
    if (yasalKenarlar(G, d, G.gecici) === 0) { d.bitti = G.BITTI[d.sira ^ 1][1]; kod |= 8; }   // sırası gelen oyuncu sıkıştı
    return kod;
  }

  function geriAl(G, d) {
    const z = d.gecmis;
    if (!z.length) throw new Error('geri alınacak hamle yok');
    const zincir = z.pop(), sira = z.pop(), eski = z.pop(), e = z.pop();
    const hedef = d.top;
    d.kullanilan[e >>> 5] &= ~(1 << (e & 31));
    d.derece[G.ea[e]]--; d.derece[G.eb[e]]--;
    d.h1 = (d.h1 ^ G.zE1[e] ^ G.zT1[eski] ^ G.zT1[hedef]) >>> 0;
    d.h2 = (d.h2 ^ G.zE2[e] ^ G.zT2[eski] ^ G.zT2[hedef]) >>> 0;
    if (d.sira !== sira) { d.h1 = (d.h1 ^ G.zS[0]) >>> 0; d.h2 = (d.h2 ^ G.zS[1]) >>> 0; }
    d.sira = sira; d.top = eski; d.zincir = zincir; d.bitti = null;
  }

  // Dışa açık adım: { gol: kazanan | null, sikisti: kaybeden | null, sekti, siraGecti }
  function yap(G, d, e) {
    if (d.bitti) throw new Error('oyun bitti');
    if (!yasalMi(G, d, e)) throw new Error('yasal olmayan kenar: ' + e);
    const k = yapIc(G, d, e);
    return {
      gol: (k & 4) ? d.bitti.kazanan : null,
      sikisti: (k & 8) ? 1 - d.bitti.kazanan : null,
      sekti: !!(k & 1),
      siraGecti: !!(k & 2),
    };
  }

  // Bir turu (kenar listesi) uygular / geri alır
  function uygulaTur(G, d, kenarlar) { let k = 0; for (const e of kenarlar) k = yapIc(G, d, e); return k; }
  function turuGeriAl(G, d, n) { while (n-- > 0) geriAl(G, d); }

  /* ---------- tur üretimi ---------- */

  // Sırası gelen oyuncunun tam turları. DFS: temiz noktaya varınca tur biter, gol/sıkışma terminal, ziyaretli noktada zincir sürer.
  // sinir: { enCokTur: 3000, enUzunZincir: 40, enCokDugum: 50000, sonTarih, golBulundaDur, ilkGuvenliDeDur, sadeceGol }
  // Tekilleştirme (kenar kümesi + top + sıra hash'i): hem tur sonlarında hem zincir ortasında (üstel patlamayı önler).
  // Dönüş: { turlar: [{ kenarlar, bitis, sonuc: 'temiz'|'gol'|'sikisma'|'kesildi', kazanan, anahtar }], kesildiMi, dugum, durdu }
  function turlarUret(G, d, sinir) {
    const s = Object.assign({ enCokTur: 3000, enUzunZincir: 40, enCokDugum: 50000, sonTarih: Infinity,
      golBulundaDur: false, ilkGuvenliDeDur: false, sadeceGol: false }, sinir);
    const turlar = [], yol = [], gorulen = new Set(), tamponlar = [];
    const oyuncu = d.sira;
    let dugum = 0, kesildi = false, dur = false, zincirK = false, sinirK = false;
    if (d.bitti) return { turlar, kesildiMi: false, dugum: 0, durdu: false };

    function kaydet(sonuc, kazanan) {
      if (s.sadeceGol && !(sonuc === 'gol' && kazanan === oyuncu)) return;    // gol aramasında yalnız sırası gelenin golü sayılır
      const k = anahtar(d);
      if (gorulen.has(k)) return;
      gorulen.add(k);
      turlar.push({ kenarlar: yol.slice(), bitis: d.top, sonuc, kazanan, anahtar: k });
      if (turlar.length >= s.enCokTur) { kesildi = true; sinirK = true; dur = true; }
      const lehte = sonuc === 'temiz' || kazanan === oyuncu;
      if (s.golBulundaDur && sonuc === 'gol' && kazanan === oyuncu) dur = true;
      if (s.ilkGuvenliDeDur && lehte && sonuc !== 'kesildi') dur = true;
    }

    function ic(derinlik) {
      const tampon = tamponlar[derinlik] || (tamponlar[derinlik] = new Int16Array(8));
      const n = yasalKenarlar(G, d, tampon);
      for (let i = 0; i < n && !dur; i++) {
        if (++dugum > s.enCokDugum || ((dugum & 255) === 0 && simdi() > s.sonTarih)) { kesildi = true; sinirK = true; dur = true; return; }
        const kod = yapIc(G, d, tampon[i]);
        yol.push(tampon[i]);
        if (kod & 4) kaydet('gol', d.bitti.kazanan);
        else if (kod & 8) kaydet('sikisma', d.bitti.kazanan);
        else if (kod & 2) kaydet('temiz', -1);
        else if (yol.length >= s.enUzunZincir) { kesildi = true; zincirK = true; kaydet('kesildi', -1); }
        else {
          const k = anahtar(d);
          if (!gorulen.has(k)) { gorulen.add(k); ic(derinlik + 1); }
        }
        yol.pop();
        geriAl(G, d);
      }
    }
    ic(0);
    return { turlar, kesildiMi: kesildi, zincirKesildi: zincirK, sinirKesildi: sinirK, dugum, durdu: dur && !kesildi };
  }

  // Sırası gelen oyuncu bu turda gol atabilir mi? Atabiliyorsa kenar listesi (en kısa zincirli bulunan), yoksa null.
  // Zincir uzunluğu kademeli artırılır (4, 10, 24, sinir.enUzunZincir): kısa goller derin zincir ağaçlarında kaybolmaz.
  // Bütçe (düğüm/süre) dolarsa "bulunamadı" döner.
  function golTuruBul(G, d, sinir) {
    const son = (sinir && sinir.enUzunZincir) || 40;
    for (const L of [4, 10, 24, son]) {
      if (L > son) break;
      const r = turlarUret(G, d, Object.assign({ golBulundaDur: true, sadeceGol: true }, sinir, { enUzunZincir: L }));
      if (r.turlar.length) return r.turlar[0].kenarlar;
      if (r.sinirKesildi || !r.zincirKesildi) return null;
    }
    return null;
  }

  // Kaybettirmeyen bir turu var mı (temiz bitiş ya da lehte gol/sıkıştırma)? İlk bulunca durur.
  function guvenliTurVar(G, d, sinir) {
    const oyuncu = d.sira;
    const r = turlarUret(G, d, Object.assign({ ilkGuvenliDeDur: true }, sinir));
    return r.turlar.some(t => t.sonuc === 'temiz' || (t.sonuc !== 'kesildi' && t.kazanan === oyuncu));
  }

  /* ---------- hata ayıklama ---------- */

  // ASCII çizim: . temiz · o ziyaretli · B top; kullanılmış kenarlar - | \ / (iki çapraz: X)
  function yazdir(G, d) {
    const gen = 2 * G.W + 1, yuk = 2 * (G.H + 2) + 1;
    const m = Array.from({ length: yuk }, () => Array(gen).fill(' '));
    for (let p = 0; p < G.P; p++) {
      if (!G.gecerli[p]) continue;
      m[2 * (G.ny[p] + 1)][2 * G.nx[p]] = p === d.top ? 'B' : ziyaretli(G, d, p) ? 'o' : '.';
    }
    for (let e = 0; e < G.E; e++) {
      if (!kullanildi(d, e)) continue;
      const a = G.ea[e], b = G.eb[e];
      const c = G.nx[a] + G.nx[b], r = G.ny[a] + G.ny[b] + 2;
      const ch = G.eyon[e] === 0 ? '-' : G.eyon[e] === 1 ? '|' : G.eyon[e] === 2 ? '\\' : '/';
      m[r][c] = (m[r][c] === '\\' && ch === '/') || (m[r][c] === '/' && ch === '\\') ? 'X' : ch;
    }
    return m.map(s => s.join('')).join('\n');
  }

  const B = {
    kur, nokta, koordinat, kenarAra, kenarXY, baslangicNoktasi,
    baslangic, kurulum, kopyala, kullanildi, ziyaretli, anahtar, hashHesapla,
    yasalKenarlar, yasalListe, yasalMi, yap, yapIc, geriAl, uygulaTur, turuGeriAl,
    turlarUret, golTuruBul, guvenliTurVar, yazdir,
  };
  KF.board = B;
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})();
