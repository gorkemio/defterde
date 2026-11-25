// ses.js — Web Audio ile sentezlenen sesler (ses dosyası yok). Oyun mantığını bilmez.
// Sesler: kalem hışırtısı, zar tıkırtısı, doğru cevapta "tık", yanlışta pes vızıltı, pas, oyun sonu melodileri.
// AudioContext ilk dokunuşta açılır (tarayıcılar izin vermeden ses çaldırmaz).
(function () {
  'use strict';

  const AB = typeof window !== 'undefined' ? (window.AB = window.AB || {}) : {};
  const S = {};
  const ANAHTAR = 'alankapmaca-sessiz';

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

  S.sentez = {
    // Tükenmez kalemin kâğıtta hışırtısı: bandı süpürülen gürültü
    kalem(c, h, t0) {
      const f = 2400 + Math.random() * 1200;
      parazit(c, h, t0, 'bandpass', f, f * 1.8, 0.9, 0.09, 0.2);
      parazit(c, h, t0 + 0.04, 'highpass', 5000, 7000, 0.7, 0.05, 0.05);
    },
    // Sayfa çevirme: yukarı süpürülen geniş bantlı kâğıt hışırtısı ve sonunda kısa bir şıklama
    sayfa(c, h, t0) {
      parazit(c, h, t0, 'bandpass', 700, 2600, 0.6, 0.38, 0.14);
      parazit(c, h, t0 + 0.12, 'highpass', 3000, 6500, 0.7, 0.22, 0.05);
      parazit(c, h, t0 + 0.42, 'bandpass', 1800, 900, 1.2, 0.06, 0.1);
    },
    // Zar yuvarlanması: aralıkları açılan kısa tıkırtılar (zar yüzleri değişirken olduğu gibi), her biri gürültü + tok vuruş. ~0,75 sn
    zar(c, h, t0) {
      let t = t0, ara = 0.055;
      for (let i = 0; i < 8; i++) {
        const f = 1800 + Math.random() * 2200;
        parazit(c, h, t, 'bandpass', f, f * 0.7, 2.2, 0.035, 0.32);
        nota(c, h, t, 'triangle', 220 + Math.random() * 80, 90, 0.05, 0.22);
        t += ara;
        ara = Math.min(ara * 1.2, 0.15);
      }
    },
    // Doğru cevap: kısa, parlak iki notalı "tık"
    tik(c, h, t0) {
      nota(c, h, t0, 'sine', 1175, 1175, 0.07, 0.28);
      nota(c, h, t0 + 0.075, 'sine', 1760, 1760, 0.12, 0.26);
    },
    // Yanlış cevap: kısa, pes iki vızıltı
    yanlis(c, h, t0) {
      nota(c, h, t0, 'sawtooth', 170, 120, 0.2, 0.15);
      nota(c, h, t0 + 0.22, 'sawtooth', 140, 90, 0.28, 0.15);
    },
    // Pas: yumuşak, alçalan tek nota
    pas(c, h, t0) {
      nota(c, h, t0, 'triangle', 330, 220, 0.18, 0.2);
    },
    kazan(c, h, t0) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(c, h, t0 + i * 0.13, 'triangle', f, f * 0.998, 0.26, 0.28));
    },
    kaybet(c, h, t0) {
      [392, 349.23, 293.66, 261.63].forEach((f, i) => nota(c, h, t0 + i * 0.2, 'triangle', f, f * 0.99, 0.34, 0.26));
    },
    berabere(c, h, t0) {
      [392, 392].forEach((f, i) => nota(c, h, t0 + i * 0.2, 'triangle', f, f * 0.995, 0.3, 0.24));
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
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
