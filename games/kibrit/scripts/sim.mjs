// scripts/sim.mjs — bilgisayarın süre modelini havuz üzerinde simüle eder → docs/bilgisayar.md
//   node scripts/sim.mjs [örnek=120]
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const Mo = require('../engine/model.js'), Ai = require('../engine/ai.js'), D = require('../engine/difficulty.js'), G = require('../engine/generator.js');
const meta = require('../data/havuz/meta.js');
const N = Number(process.argv[2]) || 120;
function kayitlar(ad) {
  const p = require(join(kok, 'data/havuz', ad + '.js'));
  return p.kayitlar.map(([si, hex]) => Mo.maskeOku(p.sablonlar[si], hex));
}
const satir = ['# Bilgisayarın süre modeli: simülasyon', '',
  `\`node scripts/sim.mjs ${N}\` · havuz ${meta.uretim} · kategori × bant başına ${N} bulmaca · hücre: ortalama süre (s), parantezde 90 s içinde pes oranı.`, '',
  'Seviyeler (engine/ai.js `SEVIYE`): ' + Object.entries(Ai.SEVIYE).map(([k, s]) => `${s.ad} okuma ${s.okuma} s, deneme ${s.deneme} s, σ ${s.sigma}`).join(' · ') + '.', ''];
for (const sev of Object.keys(Ai.SEVIYE)) {
  satir.push(`## ${Ai.SEVIYE[sev].ad}`, '', '| Kategori | Kolay | Orta | Zor | Çok zor |', '|---|---|---|---|---|');
  for (const k of G.KATEGORILER) {
    const h = [];
    for (const b of D.BANTLAR) {
      const L = kayitlar(`${k}-${b}`), r = Mo.rng(['sim', k, b]);
      let top = 0, pes = 0;
      for (let i = 0; i < N; i++) {
        const d = L[Math.floor(r() * L.length)];
        const p = Ai.plan(d, { kategori: k === 'hepsini' ? 'tek' : k, seviye: sev, tohum: i });
        if (p.pes) { pes++; top += 90; } else top += p.buldu;
      }
      h.push(`${(top / N).toFixed(1)}${pes ? ` (%${Math.round(100 * pes / N)})` : ''}`);
    }
    satir.push(`| ${G.KAT_AD[k]} | ${h.join(' | ')} |`);
  }
  satir.push('');
}
satir.push('Hepsini Bul satırı ilk çözümü bulma süresidir. Pes edilen bulmaca 90 s sayılır.', '');
writeFileSync(join(kok, 'docs/bilgisayar.md'), satir.join('\n'));
process.stdout.write(satir.join('\n'));
