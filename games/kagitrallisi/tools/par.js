// tools/par.js — tüm pistlerin par değerini BFS ile hesaplar ve pist dosyasına yazar.
//   node tools/par.js           → hesapla, `par:` satırını güncelle
//   node tools/par.js --check   → yalnız karşılaştır (farklıysa çıkış kodu 1)
const fs = require('fs'), path = require('path');
const T = require('../track.js'), A = require('../ai.js');
const kl = path.join(__dirname, '..', 'pistler');
const kontrol = process.argv.includes('--check');
let fark = 0;
for (const f of fs.readdirSync(kl).filter(f => f.endsWith('.js')).sort()) {
  const dosya = path.join(kl, f);
  require(dosya);
  const metin = fs.readFileSync(dosya, 'utf8');
  const kimlik = /kimlik: '([^']+)'/.exec(metin)[1];
  const p = T.ayristir(T.bul(kimlik));
  const hata = T.dogrula(p);
  if (hata.length) { console.error(`${kimlik}: ${hata.join('; ')}`); process.exitCode = 1; continue; }
  const t0 = Date.now(), h = A.olc(p, { tur: p.tur }), ms = Date.now() - t0;
  const eski = Number(/par: (\d+),/.exec(metin)[1]);
  console.log(`${kimlik.padEnd(12)} par ${String(h.par).padStart(3)} (dosyada ${eski})  ${ms} ms`);
  if (eski !== h.par) {
    fark++;
    if (!kontrol) fs.writeFileSync(dosya, metin.replace(/par: \d+,/, `par: ${h.par},`));
  }
}
if (kontrol && fark) { console.error(`${fark} pistin par'ı eski: node tools/par.js`); process.exitCode = 1; }
