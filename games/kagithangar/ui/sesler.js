// Kağıt Hangar sesleri: kit/ses.js'in sentez parçalarıyla (ses dosyası yok). Sessiz ayarı kalıcı.

// Uçuş uğultusu: hava hızıyla yükselen sürekli rüzgâr sesi. Kit'in ses bağlamını sentez kaydı üzerinden kullanır
// (ayrı bir AudioContext açılmaz). baslat → ayarla(hız) her kare → durdur.
let ugultuDugum = null;
const gurultuler = new WeakMap();
function gurultu(c) {
  let b = gurultuler.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    let son = 0;
    for (let i = 0; i < d.length; i++) { son = 0.97 * son + 0.03 * (Math.random() * 2 - 1); d[i] = son * 6; }   // kahverengimsi
    gurultuler.set(c, b);
  }
  return b;
}
export const ugultu = {
  baslat() {
    const S = window.Kit && window.Kit.ses;
    if (!S || S.sessiz) return;
    S.cal('ugultu');
  },
  ayarla(hiz) {
    if (!ugultuDugum) return;
    const S = window.Kit.ses;
    const { c, f, g } = ugultuDugum;
    const u = S.sessiz ? 0 : Math.max(0, Math.min(1, (hiz - 2) / 10));
    f.frequency.setTargetAtTime(260 + 170 * hiz, c.currentTime, 0.08);
    g.gain.setTargetAtTime(0.16 * u * u, c.currentTime, 0.08);
  },
  durdur() {
    if (!ugultuDugum) return;
    const { c, s, g } = ugultuDugum;
    ugultuDugum = null;
    try { g.gain.setTargetAtTime(0, c.currentTime, 0.08); s.stop(c.currentTime + 0.6); } catch (e) { /* yoksay */ }
  },
};

export function sesleriKur() {
  const S = window.Kit && window.Kit.ses;
  if (!S) return;
  S.kur({ anahtar: 'kagithangar-sessiz' });
  // kağıt hışırtısı: iniş, yakalama, ütü
  S.sentez.hisirti = (c, h, t0) => {
    S.parazit(c, h, t0, 'bandpass', 3200, 1800, 0.7, 0.2, 0.16);
    S.parazit(c, h, t0 + 0.06, 'highpass', 4500, 6500, 0.6, 0.12, 0.05);
  };
  // fırlatma: havada süpürülen bir "vuş"
  S.sentez.firlat = (c, h, t0) => {
    S.parazit(c, h, t0, 'bandpass', 500, 2600, 1.3, 0.38, 0.22);
  };
  // çarpma: boğuk bir tok + kağıt buruşması
  S.sentez.carp = (c, h, t0) => {
    S.nota(c, h, t0, 'sine', 150, 55, 0.2, 0.35);
    S.parazit(c, h, t0, 'lowpass', 1400, 300, 0.8, 0.15, 0.3);
    S.parazit(c, h, t0 + 0.04, 'bandpass', 2600, 1400, 1, 0.16, 0.14);
  };
  // katlama: kağıdın kıvrılıp kırışması
  S.sentez.katla = (c, h, t0) => {
    S.parazit(c, h, t0, 'bandpass', 2400, 1500, 1.1, 0.13, 0.15);
    S.nota(c, h, t0 + 0.1, 'square', 1500, 700, 0.025, 0.06);
  };
  S.sentez.ugultu = (c, h, t0) => {
    ugultu.durdur();
    const s = c.createBufferSource();
    s.buffer = gurultu(c);
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.value = 600;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(h);
    s.start(t0, Math.random() * 1.5);
    ugultuDugum = { c, s, f, g };
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(o => document.addEventListener(o, () => S.baslat(), { passive: true }));

  const b = document.getElementById('ses-dugmesi');
  if (!b) return;
  const svg = b.querySelector('svg');
  const ciz = () => {
    window.Kit.kalem.sesSimgesiCiz(svg, !S.sessiz, true);
    b.setAttribute('aria-pressed', String(S.sessiz));
    b.setAttribute('aria-label', S.sessiz ? 'Sesi aç' : 'Sesi kapat');
  };
  b.addEventListener('click', () => { S.sessizYap(!S.sessiz); ciz(); if (!S.sessiz) { S.baslat(); S.cal('hisirti'); } });
  ciz();
}
