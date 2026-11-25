// test/havuz.js — data/havuz paketlerini node'da okur (yalnız testler)
const fs = require('node:fs'), path = require('node:path');
const Mo = require('../engine/model.js');
const dizin = path.join(__dirname, '../data/havuz');
function paket(ad) { return require(path.join(dizin, ad + '.js')); }
function kayitlar(ad) {
  const p = paket(ad);
  return p.kayitlar.map(([si, hex, puan, etiket]) => ({ durum: Mo.maskeOku(p.sablonlar[si], hex), puan, etiket, kategori: p.kategori, bant: p.bant, kimlik: p.sablonlar[si] + ':' + hex }));
}
const varMi = () => fs.existsSync(path.join(dizin, 'meta.js'));
module.exports = { paket, kayitlar, varMi };
