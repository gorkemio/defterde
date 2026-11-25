// Testler için ortak yardımcılar: ASCII tahta ayrıştırma.
//   ayristir(['..X..', '.OXO.']) → [{ r, c, sembol }]   ('.' boş, 'X', 'O'; boşluklar yok sayılır)
//   r0 / c0 ile sol üst köşe kaydırılabilir (sınırsız sayfa, kenar testleri).
const B = require('../board.js');

function ayristir(satirlar, r0 = 0, c0 = 0) {
  const taslar = [];
  satirlar.forEach((satir, i) => {
    const s = satir.replace(/\s+/g, '');
    for (let j = 0; j < s.length; j++) {
      const ch = s[j].toUpperCase();
      if (ch === 'X') taslar.push({ r: r0 + i, c: c0 + j, sembol: B.X });
      else if (ch === 'O') taslar.push({ r: r0 + i, c: c0 + j, sembol: B.O });
      else if (ch !== '.' && ch !== '_') throw new Error('Bilinmeyen işaret: ' + ch);
    }
  });
  return taslar;
}

// Doğrudan konum (sıra serbest)
function konum(satirlar, ayar = {}, sira, r0, c0) {
  return B.konumKur(ayar, ayristir(satirlar, r0, c0), sira);
}

// Gerçek oyun sırasıyla (X, O, X, ...) o konuma gelen hamle listesi. son: en son oynanacak kare [r, c].
function sirali(taslar, son) {
  const xs = taslar.filter(t => t.sembol === B.X), os = taslar.filter(t => t.sembol === B.O);
  if (!(xs.length === os.length || xs.length === os.length + 1)) throw new Error(`sıralanamaz: X ${xs.length}, O ${os.length}`);
  if (son) {
    const kendi = xs.length > os.length ? xs : os;
    const i = kendi.findIndex(t => t.r === son[0] && t.c === son[1]);
    if (i < 0) throw new Error('son hamle doğru tarafta değil');
    kendi.push(kendi.splice(i, 1)[0]);
  }
  const liste = [];
  for (let i = 0; i < xs.length; i++) { liste.push([xs[i].r, xs[i].c]); if (os[i]) liste.push([os[i].r, os[i].c]); }
  return liste;
}

// Tahtayı yeniden ASCII'ye çevirir (hata mesajları için)
function ciz(d, r1, c1, r2, c2) {
  const s = d.sinir || { r1: 0, c1: 0, r2: 0, c2: 0 };
  [r1, c1, r2, c2] = [r1 ?? s.r1, c1 ?? s.c1, r2 ?? s.r2, c2 ?? s.c2];
  const satirlar = [];
  for (let r = r1; r <= r2; r++) {
    let t = '';
    for (let c = c1; c <= c2; c++) t += '.XO'[B.tas(d, r, c)];
    satirlar.push(t);
  }
  return satirlar.join('\n');
}

module.exports = { ayristir, konum, sirali, ciz };
