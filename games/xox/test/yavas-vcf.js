// Bağımsız, yavaş VCF çözücü (yalnız board.js kullanır; eval.js'e güvenmez). Testlerde AI'nın VCF hamlesini doğrular.
// Kural: saldıran yalnız dört yapan hamle oynar; savunan tek tamamlama karesini kapatır. Savunanın beş tamamlaması
// varken saldıran beş yapamıyorsa başarısız sayılır (katı tanım).
const B = require('../board.js');

function bosKomsular(d) {
  const n = d.ayar.boyut, liste = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (B.tas(d, r, c)) continue;
    let yakin = false;
    for (let dr = -2; dr <= 2 && !yakin; dr++) for (let dc = -2; dc <= 2; dc++) if (B.tas(d, r + dr, c + dc)) { yakin = true; break; }
    if (yakin) liste.push([r, c]);
  }
  return liste;
}
// d'de s'nin beş tamamlama kareleri (sıra kimde olursa olsun)
function tamamlamalar(d, s) {
  const k = B.konumKur(d.ayar, d.hamleler.map(h => ({ r: h.r, c: h.c, sembol: h.sembol })), s);
  const sonuc = [];
  for (const [r, c] of bosKomsular(k)) {
    const y = B.oyna(k, r, c);
    if (y.kazanan === s) sonuc.push([r, c]);
  }
  return sonuc;
}
function koy(d, r, c, s) {
  return B.konumKur(d.ayar, d.hamleler.map(h => ({ r: h.r, c: h.c, sembol: h.sembol })).concat([{ r, c, sembol: s }]), 3 - s);
}

// s saldırır; kazanırsa ilk hamleyi döner
function yavasVcf(d, s, derinlik = 10) {
  if (tamamlamalar(d, s).length) return true;
  if (derinlik <= 0) return false;
  if (tamamlamalar(d, 3 - s).length) return false;
  for (const [r, c] of bosKomsular(d)) {
    if (kazanirMi(d, s, r, c, derinlik)) return true;
  }
  return false;
}
// (r, c) dört yapan ve VCF'i sürdüren hamle mi
function kazanirMi(d, s, r, c, derinlik = 10) {
  if (B.tas(d, r, c)) return false;
  const y = koy(d, r, c, s);
  if (B.kazananBul(y, r, c)) return true;
  const t = tamamlamalar(y, s);
  if (t.length === 0) return false;
  if (t.length >= 2) return !tamamlamalar(y, 3 - s).length || false;
  const [fr, fc] = t[0];
  const z = koy(y, fr, fc, 3 - s);
  if (B.kazananBul(z, fr, fc)) return false;
  return yavasVcf(z, s, derinlik - 1);
}

module.exports = { yavasVcf, kazanirMi, tamamlamalar };
