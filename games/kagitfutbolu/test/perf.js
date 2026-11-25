// Ölçüm betiği (test değil): node test/perf.js [olcum|mac]
//   olcum: orta/dolu sahada turlarUret tur sayısı ve süresi; üç zorluğun düşünme süresi ve derinliği
//   mac:   zorluklar arası kendi kendine oyun oranları; kendi kaleye gol / sıkışma sayıları
const B = require('../board.js');
const A = require('../ai.js');
const G = B.kur({ W: 8, H: 10, kesisme: true });
const BUTCE = { kolay: 200, orta: 400, zor: 800 };

function lcg(tohum) { let s = tohum >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function kullanilan(d) { let n = 0; for (let e = 0; e < G.E; e++) if (B.kullanildi(d, e) && !G.onCizili[e]) n++; return n; }
function konum(tohum, hamle) {
  for (let k = 0; k < 100; k++) {
    const rnd = lcg(tohum * 7919 + k), d = B.baslangic(G, 0);
    for (let i = 0; i < hamle && !d.bitti; i++) { const l = B.yasalListe(G, d); B.yap(G, d, l[Math.floor(rnd() * l.length)]); }
    if (!d.bitti) return d;
  }
}
const ort = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const medyan = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

function olcum() {
  console.log('hamle | kenar | tur(ort/maks) | tur ms (ort/maks) | kesildi | kolay ms | orta ms | zor ms (derinlik)');
  for (const hamle of [10, 25, 45, 70, 100, 140]) {
    const turSay = [], turMs = [], kes = [], ms = { kolay: [], orta: [], zor: [] }, der = [], kenar = [];
    for (let t = 1; t <= 8; t++) {
      const d = konum(t, hamle);
      if (!d) continue;
      kenar.push(kullanilan(d));
      const t0 = performance.now();
      const r = B.turlarUret(G, d, { enCokTur: 3000, enUzunZincir: 40, enCokDugum: 50000 });
      turMs.push(performance.now() - t0); turSay.push(r.turlar.length); kes.push(r.kesildiMi ? 1 : 0);
      for (const z of ['kolay', 'orta', 'zor']) {
        const s = A.dusunSenkron(G, d, { zorluk: z, butceMs: BUTCE[z], tohum: t });
        ms[z].push(s.bilgi.ms);
        if (z === 'zor') der.push(s.bilgi.derinlik);
      }
    }
    if (!kenar.length) { console.log(`${hamle} | örnek yok (bitmemiş konum üretilemedi)`); continue; }
    console.log(`${String(hamle).padStart(5)} | ${Math.round(ort(kenar)).toString().padStart(5)} | ${Math.round(ort(turSay))}/${Math.max(...turSay)} | ${ort(turMs).toFixed(1)}/${Math.max(...turMs).toFixed(1)} | ${kes.reduce((a, b) => a + b, 0)}/${kes.length} | ${ort(ms.kolay).toFixed(0)} | ${ort(ms.orta).toFixed(0)} (maks ${Math.max(...ms.orta).toFixed(0)}) | ${ort(ms.zor).toFixed(0)} (maks ${Math.max(...ms.zor).toFixed(0)}) d=${der.join(',')}`);
  }
}

// a ve b zorluğu iki taraftan da oynar; n oyun (yarısında a başlar)
function mac(a, b, n) {
  const sonuc = { a: 0, b: 0, kendiKale: [0, 0], sikisma: [0, 0], hamle: [] };
  for (let oyun = 0; oyun < n; oyun++) {
    const aOyuncu = oyun % 2;                                   // a hangi oyuncu
    const d = B.baslangic(G, oyun % 2 === 0 ? 0 : 1);
    let tur = 0, sonTur = null;
    while (!d.bitti && tur < 300) {
      const z = d.sira === aOyuncu ? a : b;
      const s = A.dusunSenkron(G, d, { zorluk: z, butceMs: BUTCE[z], tohum: oyun * 1000 + tur });
      if (!s.kenarlar.length) break;
      sonTur = d.sira;
      B.uygulaTur(G, d, s.kenarlar);
      tur++;
    }
    if (!d.bitti) continue;
    sonuc.hamle.push(tur);
    const k = d.bitti.kazanan;
    if (k === aOyuncu) sonuc.a++; else sonuc.b++;
    const kaybeden = 1 - k, kaybedenZ = kaybeden === aOyuncu ? 0 : 1;
    if (d.bitti.sebep === 'gol' && sonTur === kaybeden) sonuc.kendiKale[kaybedenZ]++;
    if (d.bitti.sebep === 'sikisma') sonuc.sikisma[kaybedenZ]++;
  }
  console.log(`${a} – ${b}: ${sonuc.a}–${sonuc.b} | kendi kaleye gol (a,b): ${sonuc.kendiKale} | sıkışma kaybı (a,b): ${sonuc.sikisma} | ort. tur ${ort(sonuc.hamle).toFixed(1)}`);
}

const mod = process.argv[2] || 'olcum';
if (mod === 'olcum') olcum();
else if (mod === 'mac') {
  const n = +process.argv[3] || 12;
  mac('orta', 'kolay', n); mac('zor', 'kolay', n); mac('zor', 'orta', n);
}
