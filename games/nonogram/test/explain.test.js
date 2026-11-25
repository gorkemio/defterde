const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../nonogram/model.js');
const D = require('../nonogram/difficulty.js');
const S = require('../nonogram/solver.js');
const E = require('../nonogram/explain.js');
const O = require('./ornekler.js');
const yap = (s) => M.bulmacaYap({ en: s[0].length, boy: s.length, satirlar: s });

function cizgi(d, b, tur, i) { return Uint8Array.from(tur === 'satir' ? M.satirAl(d, b.en, i) : M.sutunAl(d, b.en, b.boy, i)); }

test('A1 her açıklama, o kuralla elde edilebilen kareleri gösterir (kural fonksiyonlarıyla çapraz kontrol)', () => {
  let say = 0;
  for (const ad of ['ok5', 'ev10', 'balik10', 'yaprak15', 'bardak10x15', 'orta10', 'zor10']) {
    const b = yap(O[ad]), d = M.durumYap(b);
    const kayit = D.merdiven.cozumKaydi(d, b);
    assert.ok(kayit.bitti, ad);
    const k = d.slice();
    for (const a of kayit.adimlar) {
      say++;
      assert.ok(E.aciklama(a).length > 10);
      if (a.bolge.tur !== 'kare') {
        const s = cizgi(k, b, a.bolge.tur, a.bolge.i);
        const ip = (a.bolge.tur === 'satir' ? b.ipuclari.satir : b.ipuclari.sutun)[a.bolge.i].filter(x => x > 0);
        const g = D.kurallar[a.teknik](ip, s)[0];
        const beklenen = [...g.dolu.map(x => 1 + ':' + x), ...g.bos.map(x => 2 + ':' + x)].sort();
        const gercek = a.hucreler.map(h => h.v + ':' + (a.bolge.tur === 'satir' ? h.c : h.r)).sort();
        assert.deepEqual(gercek, beklenen, `${ad} ${a.teknik}`);
        // daha basit hiçbir kural o anda bir şey bulamıyordu
        const sira = ['binme', 'uc', 'tamam', 'sigmaz', 'satirCozucu'];
        for (const once of sira.slice(0, sira.indexOf(a.teknik))) {
          const t = D.TEKNIKLER.find(x => x.ad === once);
          assert.equal(t.bul(k, b), null, `${ad}: ${a.teknik} önce ${once} vardı`);
        }
      } else {
        // sınama: varsayılan değer gerçekten çelişki çıkarır
        const c = k.slice(); c[a.bolge.r * b.en + a.bolge.c] = a.veri.varsayilan;
        const r = a.teknik === 'sinama1' ? S.yay(c, b, { kirli: S.kesisen(b, a.bolge.r * b.en + a.bolge.c) }) : S.coz(c, b, { derinlik: 1 });
        assert.equal(r.sonuc, 'celiski');
      }
      D.uygula(k, a, b);
    }
  }
  assert.ok(say > 100);
});

test('A2 şablondaki sayılar doğru', () => {
  const b = M.bulmacaYap({ en: 10, boy: 1, satirlar: ['..#######.'] });
  const ip = E.sonrakiIpucu(M.durumYap(b), b);
  assert.equal(ip.metin, "10 karelik satırda 7'lik blok: en sola ve en sağa yerleştirince ortadaki 4 kare iki yerleşimde de dolu, bu kareler kesin.");
  const b2 = M.bulmacaYap({ en: 8, boy: 1, satirlar: ['.###..#.'] });
  const d2 = M.durumYap(b2); d2[1] = d2[2] = d2[3] = 1;
  const a2 = D.TEKNIKLER.find(t => t.ad === 'tamam').bul(d2, b2), ip2 = { metin: E.aciklama(a2), adim: a2 };
  assert.match(ip2.metin, /satırda 3'lük blok tamamlandı; iki ucuna çarpı/);
  assert.deepEqual(ip2.adim.hucreler.map(h => h.c).sort(), [0, 4]);
  assert.match(E.aciklama({ teknik: 'sinama1', bolge: { tur: 'kare' }, hucreler: [{ v: 2 }], veri: { varsayilan: 1, celiski: { tur: 'sutun', i: 3 } } }), /dolu olsaydı 4\. sütunda çelişki çıkardı/);
});

test('A3 yanlış işaret varsa ipucu önce onu gösterir', () => {
  const b = yap(O.ok5), d = M.durumYap(b);
  d[0] = 1;
  const ip = E.sonrakiIpucu(d, b);
  assert.equal(ip.tur, 'yanlis');
  assert.deepEqual(ip.hucreler, [{ r: 0, c: 0 }]);
});
