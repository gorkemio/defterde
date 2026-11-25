// ui/depo.js — localStorage, sürümlü zarf { surum, veri }; Safari file://'da localStorage fırlatabilir: bellek yedeği.
// Anahtarlar: lb-ayar, lb-eniyi-<kod> (süre; Faz 5'te hayalet izi), lb-bolum, lb-gun-YYYY-MM-DD, lb-sonsuz, lb-sessiz
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const SURUM = 1, bellek = {};
  const ad = (k) => `${LB.config.anahtar}-${k}`;
  function oku(k) {
    let v;
    try { const s = localStorage.getItem(ad(k)); v = s ? JSON.parse(s) : bellek[k]; } catch (e) { v = bellek[k]; }
    return v && v.surum === SURUM ? v.veri : undefined;
  }
  function yaz(k, veri) {
    const v = { surum: SURUM, veri };
    bellek[k] = v;
    try { localStorage.setItem(ad(k), JSON.stringify(v)); } catch (e) { /* yoksay */ }
  }

  const VARSAYILAN = { renk: 'turkuaz', izBirak: 'kucuk', hayalet: null, uv: false, uvHafiza: true, azHareket: false, serbest: { tur: 'D', boy: 'O', karakter: 'K' } };   // izBirak: true | false | 'kucuk' (Küçük boyda açık)
  function ayar() {
    const a = Object.assign({}, VARSAYILAN, oku('ayar') || {});
    a.serbest = Object.assign({}, VARSAYILAN.serbest, a.serbest || {});
    if (!LB.config.renkler.includes(a.renk)) a.renk = VARSAYILAN.renk;
    return a;
  }
  const ayarYaz = (a) => yaz('ayar', a);

  const enIyi = (kod) => oku('eniyi-' + kod) || null;
  // Daha iyiyse yazar; döndürür: önceki en iyi (ya da null)
  function enIyiYaz(kod, kayit) {
    const eski = enIyi(kod);
    if (!eski || kayit.sure < eski.sure) yaz('eniyi-' + kod, kayit);
    return eski;
  }

  LB.depo = { oku, yaz, ayar, ayarYaz, enIyi, enIyiYaz };
})();
