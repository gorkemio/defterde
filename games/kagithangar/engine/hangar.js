// Hangar kuralları: mizaç cümlesi (uçuş günlüğünden), kırışık izleri (yıpranma), ütü. DOM'suz.

export const UTU_HAKKI = 3;

const ort = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

// Günlükten bir "mizaç" cümlesi. En belirgin iki özellik birleşir.
export function mizac(ucak) {
  const g = ucak.gunluk || [];
  if (g.length < 3) return 'Henüz karakteri oturmadı; biraz daha uçmalı.';
  const sapma = ort(g.map(u => u.sapma || 0));
  const say = (olay) => g.filter(u => u.olay === olay).length;
  const ozellikler = [];
  if (say('pencere') >= 1) ozellikler.push([5, 'kaçak ruhlu, pencereyi bir kez tattı']);
  if (g.reduce((a, u) => a + (u.loop || 0), 0) >= 2) ozellikler.push([4, 'takla delisi']);
  if (say('duvar') >= 3) ozellikler.push([4, 'duvar sevdalısı']);
  if (say('yereCakildi') >= 3) ozellikler.push([3, 'burnunu yere gömmeyi huy edinmiş']);
  if (sapma > 0.6) ozellikler.push([3, 'hep sola kayıyor']);
  if (sapma < -0.6) ozellikler.push([3, 'hep sağa kayıyor']);
  if (ort(g.map(u => u.sure || 0)) > 2.4) ozellikler.push([2, 'havada asılı kalmayı seviyor']);
  if (ort(g.map(u => u.mesafe || 0)) > 9) ozellikler.push([2, 'uzun yol uçağı']);
  if (!ozellikler.length) return 'Sakin, dengeli bir uçak; sürpriz yapmaz.';
  const sec = ozellikler.sort((a, b) => b[0] - a[0]).slice(0, 2).map(o => o[1]);
  const cumle = sec.join(', üstelik ');
  return cumle[0].toLocaleUpperCase('tr') + cumle.slice(1) + '.';
}

// Kırışık izleri: uçağa özgü (tohumlu), her çarpmada biri daha. Kanat koordinatı normalize:
// u: menteşeden uca 0..1, v: kanadın önünden arkasına 0..1.
export function kirisikIzleri(ucakId, adet) {
  let h = 2166136261;
  for (const c of String(ucakId)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) || 1;
  const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  const izler = [];
  for (let i = 0; i < Math.min(adet, 30); i++) {
    const u = 0.15 + r() * 0.75, v = 0.35 + r() * 0.6, aci = r() * Math.PI, boy = 0.08 + r() * 0.16;
    izler.push({
      kanat: i % 2 ? 'sol' : 'sag',
      a: [u - Math.cos(aci) * boy / 2, v - Math.sin(aci) * boy],
      b: [u + Math.cos(aci) * boy / 2, v + Math.sin(aci) * boy],
    });
  }
  return izler;
}

// Ütü: kırışıkları siler, hakkı azaltır. Dönüş: yeni yipranma ya da null (ütülenemez).
export function utule(yipranma) {
  if (!yipranma || yipranma.kirisik <= 0 || yipranma.utu >= UTU_HAKKI) return null;
  return { ...yipranma, kirisik: 0, utu: yipranma.utu + 1 };
}
