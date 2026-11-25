// scripts/doku.mjs — siyah sayfanın lif dokusunu üretir: kit/lif.png (256×256, döşenir, tohumlu).
// Neden hazır PNG: aile kuralı (gren.png gibi); canlı süzgeç ya da açılışta canvas üretimi ilk boyamayı geciktirir.
// Katmanlar: ince gren (açık/koyu benek), kısa kâğıt lifleri (çoğu açık, birkaçı koyu), seyrek açık toz.
// Çıktı ön çarpımsız RGBA: açık lifler beyaz, koyu lifler siyah; saydamlık ne kadar göründüğünü belirler.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const N = 256;
let s = 0x9e3779b9;                                          // tohum: aynı dosya her seferinde
const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };

// Her piksel için açık ve koyu katkı (0–1); sonunda tek renge katlanır.
const acik = new Float32Array(N * N), koyu = new Float32Array(N * N);
const ekle = (dizi, x, y, v) => {
  const i = ((Math.round(y) % N + N) % N) * N + ((Math.round(x) % N + N) % N);
  dizi[i] = Math.min(1, dizi[i] + v);
};

// 1. gren: her pikselde küçük benek
for (let i = 0; i < N * N; i++) {
  const g = r();
  if (g > .86) acik[i] += (g - .86) * .16;
  else if (g < .22) koyu[i] += (.22 - g) * .3;
}
// 2. lifler: kısa, hafif kıvrık iplikler (yön her yöne; kâğıt hamuru yönsüz)
for (let k = 0; k < 420; k++) {
  const isik = r() < .86;
  let x = r() * N, y = r() * N, a = r() * Math.PI * 2;
  const L = 3 + r() * r() * 22, v = isik ? .018 + r() * .04 : .05 + r() * .07;
  for (let t = 0; t < L; t += .5) {
    a += (r() - .5) * .18;
    x += Math.cos(a) * .5; y += Math.sin(a) * .5;
    const solma = Math.sin(Math.PI * t / L);                 // uçlarda incelir
    ekle(isik ? acik : koyu, x, y, v * solma);
  }
}
// 3. toz: seyrek, bir iki piksellik açık noktalar
for (let k = 0; k < 70; k++) {
  const x = r() * N, y = r() * N, v = .07 + r() * .12;
  ekle(acik, x, y, v);
  if (r() < .4) ekle(acik, x + 1, y, v * .6);
}

const satir = N * 4 + 1, ham = Buffer.alloc(satir * N);
for (let y = 0; y < N; y++) {
  ham[y * satir] = 0;
  for (let x = 0; x < N; x++) {
    const i = y * N + x, a = acik[i], d = koyu[i], o = y * satir + 1 + x * 4;
    const beyaz = a >= d, al = Math.min(1, Math.abs(a - d) * (beyaz ? 1 : 1.2));
    const c = beyaz ? 255 : 0;
    ham[o] = c; ham[o + 1] = beyaz ? 250 : 0; ham[o + 2] = beyaz ? 240 : 0; ham[o + 3] = Math.round(al * 255);
  }
}

const crcTablo = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTablo[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parca = (tur, veri) => {
  const t = Buffer.from(tur), u = Buffer.alloc(4), c = Buffer.alloc(4);
  u.writeUInt32BE(veri.length); c.writeUInt32BE(crc(Buffer.concat([t, veri])));
  return Buffer.concat([u, t, veri, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), parca('IHDR', ihdr), parca('IDAT', deflateSync(ham, { level: 9 })), parca('IEND', Buffer.alloc(0))]);
const hedef = fileURLToPath(new URL('../kit/lif.png', import.meta.url));
writeFileSync(hedef, png);
console.log('kit/lif.png', png.length, 'bayt');
