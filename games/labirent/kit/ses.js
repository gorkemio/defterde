// kit/ses.js — Web Audio ile sentezlenen sesler (ses dosyası yok). Hangi oyun olduğunu bilmez.
// (amiralbatti/ses.js'ten çıkarıldı.) Ortak sesler: kalem hışırtısı, kısa "çıt", üç notalık kazanma / kaybetme melodisi.
// Oyun kendi seslerini Kit.ses.sentez'e ekleyebilir: Kit.ses.sentez.pat = (c, hedef, t0) => { ... }
//
//   Kit.ses.kur({ anahtar: 'sos-sessiz' })   // sessiz ayarının localStorage anahtarı; ilk kullanımdan önce
//   Kit.ses.baslat()                          // ilk dokunuşta çağrılır (tarayıcılar izin vermeden ses çaldırmaz)
//   Kit.ses.cal('kalem', 150)                 // 150 ms sonra çal
//   Kit.ses.sessizYap(true)
//   Kit.ses.seviye(0.35)                      // ana ses düzeyi
//   Kit.ses.durdur()                          // gecikmeli sesleri iptal eder
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const S = {};
  let anahtar = 'kit-sessiz';

  let ctx = null, master = null, duzey = 0.6;
  const bekleyen = new Set();

  function cikisKur() {
    master = ctx.createGain();
    master.gain.value = S.sessiz ? 0 : duzey;
    master.connect(ctx.destination);
  }
  // Eski çıkışı ayırmak, aç/kapa sonrasında eski ve ileri zamanlı notaların geri gelmesini de önler.
  S.durdur = function () {
    bekleyen.forEach(clearTimeout); bekleyen.clear();
    if (master) { master.disconnect(); cikisKur(); }
  };

  /* ---------- sessiz ayarı (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  let bellek = null;
  function oku() { try { return localStorage.getItem(anahtar); } catch (e) { return bellek; } }
  function yaz(v) { bellek = v; try { localStorage.setItem(anahtar, v); } catch (e) { /* yoksay */ } }

  S.sessiz = false;
  S.kur = function (o = {}) {
    if (o.anahtar) anahtar = o.anahtar;
    S.sessiz = oku() === '1';
    return S;
  };
  S.sessizYap = function (v) {
    S.sessiz = !!v;
    yaz(S.sessiz ? '1' : '0');
    S.durdur();
  };

  /* ---------- sentez parçaları (c: AudioContext ya da OfflineAudioContext, hedef: düğüm, t0: saniye) ---------- */

  const gurultuler = new WeakMap();                  // bağlam başına bir kez üretilen beyaz gürültü
  function gurultuTamponu(c) {
    let b = gurultuler.get(c);
    if (!b) {
      b = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      gurultuler.set(c, b);
    }
    return b;
  }

  // Hızlı çıkış, üstel sönüm: "tık" gibi kısa sesler için
  function zarf(g, t0, tepe, sure) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(tepe, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
  }

  function nota(c, hedef, t0, tur, f0, f1, sure, tepe) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = tur;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + sure);
    zarf(g, t0, tepe, sure);
    o.connect(g); g.connect(hedef);
    o.start(t0); o.stop(t0 + sure + 0.03);
  }

  function parazit(c, hedef, t0, tip, f0, f1, q, sure, tepe) {
    const s = c.createBufferSource();
    s.buffer = gurultuTamponu(c);
    const f = c.createBiquadFilter();
    f.type = tip; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(f1, t0 + sure);
    const g = c.createGain();
    zarf(g, t0, tepe, sure);
    s.connect(f); f.connect(g); g.connect(hedef);
    s.start(t0, Math.random() * 0.5, sure + 0.03);
  }

  S.nota = nota;
  S.parazit = parazit;

  S.sentez = {
    // Tükenmez kalemin kâğıtta hışırtısı: bandı süpürülen gürültü
    kalem(c, h, t0) {
      const f = 2400 + Math.random() * 1200;
      parazit(c, h, t0, 'bandpass', f, f * 1.8, 0.9, 0.09, 0.2);
      parazit(c, h, t0 + 0.04, 'highpass', 5000, 7000, 0.7, 0.05, 0.05);
    },
    // Tamamlanan SOS: kısa, keskin bir "çıt" (kalem kapağı gibi)
    cit(c, h, t0) {
      nota(c, h, t0, 'square', 2100, 950, 0.04, 0.2);
      parazit(c, h, t0, 'bandpass', 3800, 2200, 1.4, 0.035, 0.22);
    },
    // Üç notalık mini melodiler: yükselen (kazandın) ve alçalan (kaybettin)
    kazan(c, h, t0) {
      [[523.25, 0.2], [659.25, 0.2], [783.99, 0.5]].forEach(([f, s], i) => nota(c, h, t0 + i * 0.14, 'triangle', f, f * 0.998, s, 0.3));
    },
    kaybet(c, h, t0) {
      [[392, 0.3], [329.63, 0.3], [261.63, 0.55]].forEach(([f, s], i) => nota(c, h, t0 + i * 0.22, 'triangle', f, f * 0.99, s, 0.26));
    },
  };

  /* ---------- çalma ---------- */

  // İlk dokunuşta çağrılır; sonraki çağrılar askıdaki bağlamı (iOS kesintisi gibi) yeniden başlatır.
  S.baslat = function () {
    try {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      cikisKur();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) {
      ctx = null;
    }
  };

  S.durum = () => (ctx ? ctx.state : 'yok');

  // Ana ses düzeyi (0–1, varsayılan 0.6). Malzeme kendi düzeyini verir (kurşun kalem: kısık).
  S.seviye = function (v) {
    if (typeof v === 'number' && v >= 0) duzey = Math.min(1, v);
    if (master && !S.sessiz) master.gain.value = duzey;
    return duzey;
  };

  // gecikmeMs: şimdiden kaç ms sonra çalsın
  // arg: sentez fonksiyonuna 4. argüman olarak verilir (ör. çizgi uzunluğu)
  S.cal = function (ad, gecikmeMs = 0, arg) {
    if (S.sessiz || !ctx || !S.sentez[ad]) return;
    if (gecikmeMs > 0) {
      const t = setTimeout(() => { bekleyen.delete(t); S.cal(ad, 0, arg); }, gecikmeMs);
      bekleyen.add(t);
      return;
    }
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      S.sentez[ad](ctx, master, ctx.currentTime + gecikmeMs / 1000, arg);
    } catch (e) { /* ses hiçbir zaman oyunu durdurmamalı */ }
  };

  Kit.ses = S;
})();
