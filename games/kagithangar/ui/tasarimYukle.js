// Tasarım JSON'larını getirir, doğrular, motorla bir kez katlar ve önbellekte tutar.
import { TASARIM_IDLERI, dogrula } from '../engine/tasarim.js';
import { uygula } from '../engine/fold.js';

const onbellek = new Map();

export async function tasarimYukle(id) {
  if (!TASARIM_IDLERI.includes(id)) throw new Error(`"${id}" diye bir tasarım yok`);
  if (!onbellek.has(id)) {
    onbellek.set(id, (async () => {
      const yanit = await fetch(new URL(`../tasarimlar/${id}.json`, import.meta.url));
      if (!yanit.ok) throw new Error(`tasarimlar/${id}.json okunamadı`);
      const tasarim = await yanit.json();
      const hatalar = dogrula(tasarim);
      if (hatalar.length) throw new Error(`${id}: ${hatalar.join('; ')}`);
      return { tasarim, katlama: uygula(tasarim) };
    })());
  }
  try { return await onbellek.get(id); } catch (e) { onbellek.delete(id); throw e; }
}

export const hepsiniYukle = () => Promise.all(TASARIM_IDLERI.map(tasarimYukle));
