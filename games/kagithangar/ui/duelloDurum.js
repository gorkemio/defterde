// Süren düello: sekmeye özgü (sessionStorage); sayfa yenilense de kalır, sekme kapanınca biter.
const ANAHTAR = 'kagithangar-duello';
let bellek = null;
export function duelloOku() {
  try { const s = sessionStorage.getItem(ANAHTAR); return s ? JSON.parse(s) : bellek; } catch (e) { return bellek; }
}
export function duelloYaz(d) {
  bellek = d;
  try { if (d) sessionStorage.setItem(ANAHTAR, JSON.stringify(d)); else sessionStorage.removeItem(ANAHTAR); } catch (e) { /* bellekte kalır */ }
}
