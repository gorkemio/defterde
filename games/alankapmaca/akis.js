// Asenkron oyun adımları: duraklama bitince sürdür, oyun değişmişse iptal et.
(function () {
  'use strict';
  function akisKur({ jeton, duraklatildi }) {
    const bekleyenler = new Set();
    async function devamEt(j) {
      while (j === jeton() && duraklatildi()) {
        await new Promise(coz => bekleyenler.add(coz));
      }
      return j === jeton();
    }
    function guncelle() {
      const onceki = [...bekleyenler];
      bekleyenler.clear();
      onceki.forEach(coz => coz());
    }
    return { devamEt, guncelle };
  }
  if (typeof window !== 'undefined') (window.AB = window.AB || {}).akisKur = akisKur;
  if (typeof module !== 'undefined') module.exports = akisKur;
})();
