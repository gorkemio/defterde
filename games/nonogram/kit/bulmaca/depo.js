// kit/bulmaca/depo.js — localStorage sarmalayıcı: önekli anahtarlar, { surum, veri } zarfı, try/catch ve bellek yedeği
// (Safari file:// ve gizli pencerede localStorage atabilir). Bulmaca türünü bilmez.
//   const depo = Kit.bulmaca.depo.Depo('kk-'); depo.yaz('ayar', {...}); depo.oku('ayar', varsayilan)
(function () {
  'use strict';
  const SURUM = 1;
  function Depo(onek, ham) {
    const bellek = new Map();
    let ls = ham;
    if (!ls) try { ls = typeof localStorage !== 'undefined' ? localStorage : null; ls && ls.getItem('__'); } catch (e) { ls = null; }
    const al = (k) => { try { return ls ? ls.getItem(k) : (bellek.has(k) ? bellek.get(k) : null); } catch (e) { return bellek.has(k) ? bellek.get(k) : null; } };
    const koy = (k, v) => { bellek.set(k, v); try { ls && ls.setItem(k, v); } catch (e) { /* dolu ya da yasak: bellekte kalır */ } };
    return {
      oku(anahtar, varsayilan) {
        const s = al(onek + anahtar);
        if (s == null) return varsayilan;
        try { const z = JSON.parse(s); return z && z.surum === SURUM ? z.veri : varsayilan; } catch (e) { return varsayilan; }
      },
      yaz(anahtar, veri) { koy(onek + anahtar, JSON.stringify({ surum: SURUM, veri })); },
      sil(anahtar) { bellek.delete(onek + anahtar); try { ls && ls.removeItem(onek + anahtar); } catch (e) { /* yoksay */ } },
      ham: { al: (k) => al(onek + k), koy: (k, v) => koy(onek + k, v) },
      anahtarlar(alt = '') {
        const s = new Set();
        try { if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(onek + alt)) s.add(k.slice(onek.length)); } } catch (e) { /* yoksay */ }
        for (const k of bellek.keys()) if (k.startsWith(onek + alt)) s.add(k.slice(onek.length));
        return [...s].sort();
      },
    };
  }
  const api = { Depo };
  if (typeof window !== 'undefined') ((window.Kit = window.Kit || {}).bulmaca = window.Kit.bulmaca || {}).depo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
