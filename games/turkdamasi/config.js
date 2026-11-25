(function (root) {
  'use strict';
  const TD = root.TD = root.TD || {};
  TD.config = Object.freeze({
    renk: { mavi: '#2b4a9f', kirmizi: '#c0392b', kursun: '#4a4a4a', kagit: '#fbf9f2' },
    cizim: { roughness: .65, bowing: .45, strokeWidth: 1.7, animasyon: false },
    hareketSuresi: 170,
    defaults: Object.freeze({ mode: 'ai', human: 1, level: 'medium', help: true, sound: false, motion: 'system' }),
    aiProfiles: Object.freeze({
      easy: Object.freeze({ budgetMs: 100, maxDepth: 1, variety: 38, transpositions: false }),
      medium: Object.freeze({ budgetMs: 300, maxDepth: 3, variety: 0, transpositions: false }),
      hard: Object.freeze({ budgetMs: 800, maxDepth: 8, variety: 0, transpositions: true }),
    }),
  });
})(globalThis);
