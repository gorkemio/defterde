// Testler için mini pistler ve yükleyici.
const T = require('../track.js');
const fs = require('fs'), path = require('path');
function pistleriYukle() {
  const kl = path.join(__dirname, '..', 'pistler');
  for (const f of fs.readdirSync(kl).filter(f => f.endsWith('.js')).sort()) require(path.join(kl, f));
  return T.kayit;
}
// 6×4 düz sprint: başlangıç solda (x=0), bitiş x=5'te, sağa.
const SPRINT = { kimlik: 'sprint', ad: 'Sprint', harita: '######\n######\n######\n######',
  bitis: { a: [5, 0], b: [5, 4], yon: [1, 0] }, baslangic: [[0, 1], [0, 2], [0, 3], [0, 0]] };
const pist = (harita, o = {}) => T.ayristir(Object.assign({ kimlik: 'm', ad: 'm', harita,
  bitis: { a: [1, 0], b: [1, 1], yon: [-1, 0] }, baslangic: [] }, o));
module.exports = { T, pistleriYukle, SPRINT, pist };
