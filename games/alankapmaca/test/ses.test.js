// node --test test/ses.test.js — sentez işlevleri sahte bir Web Audio bağlamıyla sınanır (gerçek ses tarayıcıda).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../ses.js');

function sahteBaglam() {
  const kayit = { osc: [], gain: [], filtre: [], kaynak: [] };
  const param = () => ({ ayar: [], setValueAtTime(v, t) { this.ayar.push([v, t]); }, linearRampToValueAtTime(v, t) { this.ayar.push([v, t]); }, exponentialRampToValueAtTime(v, t) { this.ayar.push([v, t]); } });
  return {
    sampleRate: 8000, kayit,
    createBuffer: (kanal, n) => ({ getChannelData: () => new Float32Array(n) }),
    createOscillator() { const o = { type: '', frequency: param(), connect() {}, start(t) { o.basla = t; }, stop(t) { o.dur = t; } }; kayit.osc.push(o); return o; },
    createGain() { const g = { gain: param(), connect() {} }; kayit.gain.push(g); return g; },
    createBiquadFilter() { const f = { type: '', Q: { value: 0 }, frequency: param(), connect() {} }; kayit.filtre.push(f); return f; },
    createBufferSource() { const s = { buffer: null, connect() {}, start(t, off, sure) { s.basla = t; s.sure = sure; } }; kayit.kaynak.push(s); return s; },
  };
}

test('her ses geçerli düğümler kurar; başlangıç ≥ t0, bitiş > başlangıç, toplam süre 2 sn altında', () => {
  for (const ad of Object.keys(S.sentez)) {
    const c = sahteBaglam(), t0 = 1.5;
    S.sentez[ad](c, { hedef: true }, t0);
    const kaynaklar = [...c.kayit.osc, ...c.kayit.kaynak];
    assert.ok(kaynaklar.length > 0, `${ad}: hiç kaynak yok`);
    let son = 0;
    for (const o of c.kayit.osc) {
      assert.ok(o.basla >= t0 - 1e-9, `${ad}: erken başlıyor`);
      assert.ok(o.dur > o.basla, `${ad}: bitiş başlangıçtan önce`);
      son = Math.max(son, o.dur);
    }
    for (const s of c.kayit.kaynak) { assert.ok(s.basla >= t0 - 1e-9 && s.sure > 0, `${ad}: gürültü zamanlaması`); son = Math.max(son, s.basla + s.sure); }
    assert.ok(son - t0 < 2, `${ad}: ${(son - t0).toFixed(2)} sn çok uzun`);
    // kazançlar hiçbir zaman 1'i aşmaz (patlama olmasın): her tepe değeri < 0.5
    for (const g of c.kayit.gain) for (const [v] of g.gain.ayar) assert.ok(v >= 0 && v < 0.5, `${ad}: kazanç ${v}`);
  }
});

test('zar sesi yuvarlanma süresine (~0.5–0.8 sn) yakın ve tıkırtı aralıkları açılır', () => {
  const c = sahteBaglam();
  S.sentez.zar(c, {}, 0);
  const baslar = c.kayit.kaynak.map(s => s.basla);
  assert.equal(baslar.length, 8);
  const aralar = baslar.slice(1).map((t, i) => t - baslar[i]);
  for (let i = 1; i < aralar.length; i++) assert.ok(aralar[i] >= aralar[i - 1] - 1e-9, 'aralıklar küçülmez');
  assert.ok(baslar[7] > 0.5 && baslar[7] < 0.9, `son tıkırtı ${baslar[7].toFixed(2)} sn`);
});

test('sessiz ayarı: açılıp kapanır, ses kapalıyken cal bağlamsız da hata vermez', () => {
  assert.equal(S.sessiz, false);
  S.sessizYap(true);
  assert.equal(S.sessiz, true);
  assert.doesNotThrow(() => S.cal('zar'));
  S.sessizYap(false);
  assert.equal(S.sessiz, false);
  assert.doesNotThrow(() => S.cal('bilinmeyen'));
  assert.equal(S.durum(), 'yok');
});
