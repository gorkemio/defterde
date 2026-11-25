const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function sesKur() {
  const gains = [];
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() {
      const g = { gain: { value: 0 }, connected: false, connect() { this.connected = true; }, disconnect() { this.connected = false; } };
      gains.push(g); return g;
    }
  }
  const context = { window: { AudioContext }, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(require.resolve('../kit/ses.js'), 'utf8'), context);
  const s = context.window.Kit.ses.kur(); s.baslat();
  return { s, gains };
}

test('sessize alma aktif sesi keser; tekrar açmak eski sesleri geri getirmez', () => {
  const { s, gains } = sesKur();
  const active = gains[0];
  assert.equal(active.connected, true);
  s.sessizYap(true);
  assert.equal(active.connected, false);
  s.sessizYap(false);
  assert.equal(active.connected, false);
  assert.equal(gains.at(-1).connected, true);
});

test('sessize alma ve sayfa değişimi bekleyen sentez seslerini iptal eder', async () => {
  const { s } = sesKur();
  let heard = 0;
  s.sentez.deneme = () => heard++;
  s.cal('deneme', 15); s.sessizYap(true); s.sessizYap(false);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(heard, 0);
  s.cal('deneme', 15); s.durdur();
  await new Promise(r => setTimeout(r, 30));
  assert.equal(heard, 0);
  s.cal('deneme'); assert.equal(heard, 1);
});
