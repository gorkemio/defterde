// ses.js — Web Audio ile sentezlenen sesler (ses dosyası yok). Oyun mantığını bilmez.
// Sesler: kalem hışırtısı, isabette "pat", ıskada "plop", batışta kabarcıklar, oyun sonu melodisi.
// AudioContext ilk dokunuşta açılır (tarayıcılar izin vermeden ses çaldırmaz).
(function () {
  'use strict';

  const AB = (window.AB = window.AB || {});
  const S = {};
  const ANAHTAR = 'amiralbatti-sessiz';

  let ctx = null, master = null;

  /* ---------- sessiz ayarı (Safari file://'da localStorage fırlatabilir: bellek yedeği) ---------- */

  let bellek = null;
  function oku() { try { return localStorage.getItem(ANAHTAR); } catch (e) { return bellek; } }
  function yaz(v) { bellek = v; try { localStorage.setItem(ANAHTAR, v); } catch (e) { /* yoksay */ } }

  S.sessiz = oku() === '1';
  S.sessizYap = function (v) { S.sessiz = !!v; yaz(S.sessiz ? '1' : '0'); };

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

  // Hızlı çıkış, üstel sönüm: "tık"/"pat" gibi kısa sesler için
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

  S.sentez = {
    // Tükenmez kalemin kâğıtta hışırtısı: bandı süpürülen gürültü
    kalem(c, h, t0) {
      const f = 2400 + Math.random() * 1200;
      parazit(c, h, t0, 'bandpass', f, f * 1.8, 0.9, 0.09, 0.2);
      parazit(c, h, t0 + 0.04, 'highpass', 5000, 7000, 0.7, 0.05, 0.05);
    },
    // İsabet: kısa, tok bir "pat"
    pat(c, h, t0) {
      nota(c, h, t0, 'triangle', 190, 55, 0.13, 0.6);
      parazit(c, h, t0, 'lowpass', 900, 250, 0.7, 0.08, 0.3);
    },
    // Iska: suya düşen damla
    plop(c, h, t0) {
      nota(c, h, t0, 'sine', 720, 230, 0.15, 0.3);
    },
    // Batış: yükselen kabarcıklar ve alçalan su gürültüsü
    bati(c, h, t0) {
      parazit(c, h, t0, 'lowpass', 1300, 180, 0.8, 0.55, 0.14);
      for (let i = 0; i < 5; i++) {
        const f = 260 + Math.random() * 520;
        nota(c, h, t0 + i * 0.09 + Math.random() * 0.03, 'sine', f, f * 1.7, 0.09, 0.18);
      }
    },
    kazan(c, h, t0) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(c, h, t0 + i * 0.13, 'triangle', f, f * 0.998, 0.26, 0.28));
    },
    kaybet(c, h, t0) {
      [392, 349.23, 293.66, 261.63].forEach((f, i) => nota(c, h, t0 + i * 0.2, 'triangle', f, f * 0.99, 0.34, 0.26));
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
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (e) {
      ctx = null;
    }
  };

  S.durum = () => (ctx ? ctx.state : 'yok');

  // gecikmeMs: şimdiden kaç ms sonra çalsın
  S.cal = function (ad, gecikmeMs = 0) {
    if (S.sessiz || !ctx || !S.sentez[ad]) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      S.sentez[ad](ctx, master, ctx.currentTime + gecikmeMs / 1000);
    } catch (e) { /* ses hiçbir zaman oyunu durdurmamalı */ }
  };

  AB.ses = S;
})();
