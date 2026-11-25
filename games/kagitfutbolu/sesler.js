// sesler.js — Kağıt Futbolu'nun sesleri. Kit.ses'in sentez tablosuna eklenir (Web Audio, ses dosyası yok).
// Çizgi hışırtısı uzunlukla orantılı (arg: saha adımı cinsinden uzunluk), sekmede kısa "tık", golde stadyum tezahüratı
// ("gooool" diyen onlarca taraftar, uğultu, alkış, stadyum yankısı), sıkışmada "aaah". kazan / kaybet kit'ten gelir.
// Gerçek bir kayıt istenirse assets/ altına konur (assets/varliklar.js → sesDosyalari); o zaman ui.js onu çalar.
(function () {
  'use strict';

  const S = window.Kit.ses;
  const { nota, parazit } = S;

  // Bağlam başına bir kez üretilen 2 sn beyaz gürültü (kit'in tamponu dışarı açık değil)
  const tamponlar = new WeakMap();
  function gurultu(c) {
    let b = tamponlar.get(c);
    if (!b) {
      const n = c.sampleRate * 2;
      b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      tamponlar.set(c, b);
    }
    return b;
  }

  // Kalabalığın bir katmanı: bant geçiren gürültü ("ooo"ya yakın), yavaş kabarır, kısa tutar, üstel söner.
  // Çok ses etkisi için ayrı bir kazanç düğümünde 3–6 Hz'lik çarpımsal dalgalanma (sönümü bozmaz).
  function kalabalik(c, h, t0, f, q, tepe, kabarma, tutma, sonme, dalga) {
    const kaynak = c.createBufferSource();
    kaynak.buffer = gurultu(c);
    kaynak.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = 'bandpass'; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    fl.frequency.linearRampToValueAtTime(f * 1.1, t0 + kabarma + tutma);       // coşkuyla ses biraz incelir
    const zarf = c.createGain();
    zarf.gain.setValueAtTime(0.0001, t0);
    zarf.gain.exponentialRampToValueAtTime(tepe, t0 + kabarma);
    zarf.gain.setValueAtTime(tepe, t0 + kabarma + tutma);
    zarf.gain.exponentialRampToValueAtTime(0.0001, t0 + kabarma + tutma + sonme);
    const titre = c.createGain();
    titre.gain.value = 1;
    const lfo = c.createOscillator(), derinlik = c.createGain();
    lfo.frequency.value = dalga; derinlik.gain.value = 0.3;
    lfo.connect(derinlik); derinlik.connect(titre.gain);
    kaynak.connect(fl); fl.connect(zarf); zarf.connect(titre); titre.connect(h);
    const son = t0 + kabarma + tutma + sonme + 0.05;
    kaynak.start(t0, Math.random() * 1.5); kaynak.stop(son);
    lfo.start(t0); lfo.stop(son);
  }

  // Stadyum yankısı: iki kanallı, üstel sönen gürültüden üretilmiş ~2,4 sn dürtü yanıtı (bağlam başına bir kez)
  const yankilar = new WeakMap();
  function yanki(c) {
    let b = yankilar.get(c);
    if (!b) {
      const sure = 2.4, n = Math.floor(c.sampleRate * sure);
      b = c.createBuffer(2, n, c.sampleRate);
      for (let k = 0; k < 2; k++) {
        const d = b.getChannelData(k);
        for (let i = 0; i < n; i++) { const t = i / c.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2.4) * (t < 0.012 ? t / 0.012 : 1); }
      }
      yankilar.set(c, b);
    }
    const cv = c.createConvolver();
    cv.buffer = b;
    return cv;
  }

  const panYap = (c, deger) => {
    if (typeof c.createStereoPanner !== 'function') return c.createGain();
    const p = c.createStereoPanner();
    p.pan.value = deger;
    return p;
  };

  // Tek taraftarın "gooool"ü: testere dalga ses telleri, "o" ünlüsünün formantları (F1 ≈ 500, F2 ≈ 880 Hz),
  // coşkuyla yükselen perde, titreme (vibrato) ve rastgele sağ-sol konum. f0: konuşma perdesi (kalın sesler çoğunlukta).
  function taraftar(c, hedef, t0, f0, sure, tepe) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 0.82, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.18, t0 + 0.22);            // "go-": perde fırlar
    o.frequency.exponentialRampToValueAtTime(f0 * 1.08, t0 + sure * 0.7);       // "-oooo": yavaşça iner
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t0 + sure);
    const lfo = c.createOscillator(), titre = c.createGain();
    lfo.frequency.value = 4.5 + Math.random() * 2.5;
    titre.gain.value = f0 * (0.015 + Math.random() * 0.02);
    lfo.connect(titre); titre.connect(o.frequency);
    const ses = c.createGain();
    const kay = 0.92 + Math.random() * 0.16;                                    // herkesin ağzı biraz farklı
    [[500, 5, 1], [880, 7, 0.55], [2500, 9, 0.12]].forEach(([f, q, k]) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f * kay; bp.Q.value = q;
      const g = c.createGain(); g.gain.value = k;
      o.connect(bp); bp.connect(g); g.connect(ses);
    });
    const zarf = c.createGain();
    zarf.gain.setValueAtTime(0.0001, t0);
    zarf.gain.exponentialRampToValueAtTime(tepe, t0 + 0.09 + Math.random() * 0.08);
    zarf.gain.setValueAtTime(tepe, t0 + sure * 0.6);
    zarf.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    const pan = panYap(c, Math.random() * 1.6 - 0.8);
    ses.connect(zarf); zarf.connect(pan); pan.connect(hedef);
    o.start(t0); o.stop(t0 + sure + 0.05);
    lfo.start(t0); lfo.stop(t0 + sure + 0.05);
  }

  // Dağınık alkış: başta sık, sonra seyrelen kısa el çırpmaları (1–3 kHz gürültü, 15–27 ms sönüm)
  function alkis(c, h, t0, sure, adet, tepe) {
    for (let i = 0; i < adet; i++) {
      const oran = Math.pow(Math.random(), 1.5), t = t0 + sure * oran;
      const kaynak = c.createBufferSource();
      kaynak.buffer = gurultu(c);
      const fl = c.createBiquadFilter();
      fl.type = 'bandpass'; fl.frequency.value = 1100 + Math.random() * 1900; fl.Q.value = 1.2 + Math.random();
      const g = c.createGain(), p = tepe * (0.4 + Math.random() * 0.6) * (1 - 0.6 * oran);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.015 + Math.random() * 0.012);
      const pan = panYap(c, Math.random() * 1.8 - 0.9);
      kaynak.connect(fl); fl.connect(g); g.connect(pan); pan.connect(h);
      kaynak.start(t, Math.random() * 1.5, 0.05);
    }
  }

  Object.assign(S.sentez, {
    // Tükenmez kalem: çizgi uzadıkça hışırtı uzar (1 adım ≈ 0,13 sn; çapraz 1,41 adım)
    cizgi(c, h, t0, uzunluk = 1) {
      const s = Math.min(0.55, 0.06 + 0.07 * uzunluk), f = 2200 + Math.random() * 1200;
      parazit(c, h, t0, 'bandpass', f, f * 1.7, 0.9, s, 0.2);
      parazit(c, h, t0 + s * 0.4, 'highpass', 5000, 7000, 0.7, s * 0.6, 0.05);
    },
    // Sekme: kısa, kuru "tık"
    tik(c, h, t0) {
      nota(c, h, t0, 'square', 1700, 900, 0.035, 0.16);
      parazit(c, h, t0, 'bandpass', 3000, 1800, 1.6, 0.03, 0.18);
    },
    // Gol: stadyum tezahüratı (~3 sn). Top ağlara girince önce birkaç taraftar, ardından tribün "gooool" diye bağırır;
    // altta kalabalık uğultusu, üstte dağınık alkış, hepsi stadyum yankısından geçer (kuru + ıslak karışım).
    gol(c, h, t0) {
      const kuru = c.createGain(), yankiGir = c.createGain(), islak = c.createGain();
      kuru.gain.value = 0.75; islak.gain.value = 0.55;
      const veriyolu = c.createGain();
      veriyolu.gain.value = 4.2;                                               // formant süzgeçleri enerjiyi çok azaltır
      veriyolu.connect(kuru); kuru.connect(h);
      veriyolu.connect(yankiGir); const cv = yanki(c); yankiGir.connect(cv); cv.connect(islak); islak.connect(h);
      // taraftarlar: önce öndekiler, sonra tribün; kalın sesler çoğunlukta, birkaç ince ses
      for (let i = 0; i < 46; i++) {
        const ince = Math.random() < 0.25;
        const f0 = ince ? 230 + Math.random() * 90 : 105 + Math.random() * 85;
        const gec = Math.pow(Math.random(), 1.7) * 0.45;
        taraftar(c, veriyolu, t0 + gec, f0, 1.5 + Math.random() * 0.9, 0.012 + Math.random() * 0.01);
      }
      // uğultu yatağı ve nefes
      [[260, 0.9], [420, 1.1], [650, 1.2], [950, 1.4]].forEach(([f, q], i) =>
        kalabalik(c, veriyolu, t0 + i * 0.04, f * (0.95 + Math.random() * 0.1), q, 0.09, 0.3, 0.9, 1.4, 3 + Math.random() * 3));
      alkis(c, veriyolu, t0 + 0.35, 2.2, 140, 0.2);
    },
    // Sıkışma: iç çekercesine inen "aaah"
    sikisma(c, h, t0) {
      nota(c, h, t0, 'sawtooth', 330, 170, 0.9, 0.09);
      nota(c, h, t0, 'triangle', 495, 255, 0.9, 0.06);
      parazit(c, h, t0, 'bandpass', 800, 450, 2.2, 0.9, 0.12);
    },
  });
})();
