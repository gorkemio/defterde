// Defterden koparılmış kart: perde, odak tuzağı, Esc, giriş/çıkış hareketi, defter kâğıdı (kareler, marj, gren).
// Uçuş fişi ve hangardaki uçak fişi aynı kabuğu kullanır. Perde body'ye eklenir: .defter dönük olduğunda
// position: fixed ona bağlanmasın. Kart açıkken arkadaki sayfa inert (fare ve Tab ulaşmaz).
import { el, cerceveleriCiz } from './sayfa.js';

// o: { etiket, sinif, esc = true, disariTikla = true, saydam = false, donus (kapanınca odak), odak (seçici), kapandi(neden) }
// Dönüş: { kart, perde, kapat(neden), doldur(fn) }. neden: 'esc' | 'disari' | 'rota' | çağıranın verdiği.
export function kartAc(o = {}) {
  const KL = window.Kit.kalem;
  const { esc = true, disariTikla = true } = o;
  const donus = o.donus || document.activeElement;
  const perde = el('div', { sinif: 'perde' + (o.saydam ? ' saydam' : '') }, document.body);
  const kart = el('section', { sinif: 'sayfa koparilmis' + (o.sinif ? ' ' + o.sinif : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.etiket || null }, perde);
  const arkalar = [document.getElementById('sayfa'), document.querySelector('.sekmeler')].filter(Boolean);
  arkalar.forEach(a => { a.inert = true; });

  let kapali = false;
  function kapat(neden = 'kapat') {
    if (kapali) return;
    kapali = true;
    document.removeEventListener('keydown', tus, true);
    window.removeEventListener('hashchange', rota);
    arkalar.forEach(a => { a.inert = false; });
    const bitir = () => {
      perde.remove();
      if (neden !== 'rota' && donus && donus.isConnected && donus.focus) donus.focus({ preventScroll: true });
      if (o.kapandi) o.kapandi(neden);
    };
    if (KL.animasyonVar() && neden !== 'rota') {
      perde.style.pointerEvents = 'none';
      perde.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
      kart.animate([{ transform: 'rotate(-1deg)' }, { transform: 'translateY(14px) rotate(-2.2deg) scale(.98)' }],
        { duration: 170, easing: 'ease-in', fill: 'forwards' }).finished.then(bitir, bitir);
    } else bitir();
  }
  const rota = () => kapat('rota');
  const tus = (e) => {
    if (e.key === 'Escape' && esc) { e.preventDefault(); e.stopPropagation(); kapat('esc'); return; }
    if (e.key !== 'Tab') return;
    const odaklar = [...kart.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')].filter(x => !x.hidden && x.offsetParent !== null);
    if (!odaklar.length) return;
    const ilk = odaklar[0], son = odaklar[odaklar.length - 1];
    if (!kart.contains(document.activeElement)) { e.preventDefault(); ilk.focus(); }
    else if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  };
  document.addEventListener('keydown', tus, true);
  window.addEventListener('hashchange', rota);
  perde.addEventListener('click', (e) => { if (e.target === perde && disariTikla) kapat('disari'); });

  if (KL.animasyonVar()) {
    perde.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    kart.animate([{ opacity: 0, transform: 'translateY(22px) rotate(-3.5deg) scale(.97)' }, { opacity: 1, transform: 'rotate(-1deg)' }],
      { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }

  // İçeriği (yeniden) yaz: kart temizlenir, fn doldurur, çerçeveler çizilir, odak verilir.
  function doldur(fn, odak = o.odak) {
    kart.textContent = '';
    fn(kart);
    requestAnimationFrame(() => {
      cerceveleriCiz(kart, true);
      const h = (odak && kart.querySelector(odak)) || kart.querySelector('.dugme.birincil, .dugme');
      if (h) h.focus({ preventScroll: true });
    });
  }
  return { kart, perde, kapat, doldur };
}
