// audio/sesler.js — Beş Harf sesleri: Web Audio sentezi (dosya yok). Kit'in daktilo, düzeltici ve kopya kalemi sentezlerini
// Kit.ses.sentez'e kaydeder; BH.ses.cal iki ayrı anahtara bakar: tuş sesi (vurus) ve diğer sesler. Ana anahtar Kit.ses (Ses).
// Müzik, jingle, kutlama sesi yok. İkisi de kısık başlar (seviye .3).
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  const TUS = new Set(['vurus']);

  const izinli = (ad) => { const a = BH.depo.ayar(); return TUS.has(ad) ? a.tusSesi : a.digerSes; };

  function kur() {
    Kit.ses.kur({ anahtar: BH.config.depoOnek + 'sessiz' });
    Object.assign(Kit.ses.sentez, Kit.daktilo.sesler, Kit.daktilokagidi.sesler, Kit.kopyakalemi.sesler);
    Kit.ses.seviye(0.3);
    // Kit'in kendi çağrıları da (daktilo satırı, işaret sesleri) iki anahtardan geçsin
    const ham = Kit.ses.cal;
    Kit.ses.cal = (ad, gecikmeMs, arg) => { if (izinli(ad)) ham(ad, gecikmeMs, arg); };
    const ilk = () => Kit.ses.baslat();
    addEventListener('pointerdown', ilk, { passive: true });
    addEventListener('keydown', ilk);
  }

  const cal = (ad, gecikmeMs = 0, arg) => Kit.ses.cal(ad, gecikmeMs, arg);

  BH.ses = { kur, cal };
})();
