// kit/uv.js — kalem ucundaki UV ışığı ve görünmez mürekkep. Hangi oyun olduğunu bilmez. Canvas 2D.
// Görünmez mürekkep yalnız mor ışığın altında soluk camgöbeği-beyaz parlar. Oyun üç şeyi birleştirir:
//   1. camgöbeği kopya: labirentin UV renginde çizilmiş hali (bir kez),
//   2. maske: o kare ışığın düştüğü yer (Kit.uv.maske) + isteğe bağlı hafıza (Kit.uv.hafiza, birikir),
//   3. ışığın kendisi (Kit.uv.isik), en üstte, 'screen' ile.
//   Kit.uv.uygula(ctx, camgobegiKatman, maskeKatman)   // kopyayı maskeyle keser ve ctx'e koyar
(function () {
  'use strict';
  const Kit = window.Kit;

  const MOR = '#7a3cff', CAMGOBEGI = '#cfe9ea';

  // Mor radyal ışık: ortası açık lavanta, kenara doğru söner. Koyu sayfada 'screen' hafif bir mor hale verir.
  function isik(ctx, x, y, r, guc = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(176, 128, 255, ${.5 * guc})`);
    g.addColorStop(.35, `rgba(132, 74, 255, ${.3 * guc})`);
    g.addColorStop(.7, `rgba(110, 50, 230, ${.12 * guc})`);
    g.addColorStop(1, 'rgba(110, 50, 230, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Işığın düştüğü yer (maske katmanına, beyaz; saydamlık = görünürlük). Merkezde tam, kenarda yumuşak.
  function maske(ctx, x, y, r, guc = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${guc})`);
    g.addColorStop(.55, `rgba(255, 255, 255, ${.8 * guc})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Hafıza: ışığın geçtiği yerler birikir ama en çok `tavan` kadar görünür kalır (varsayılan %15).
  // 'lighten' en büyük değeri tutar: aynı yerden tekrar geçmek parlatmaz.
  function hafiza(ctx, x, y, r, tavan = .15) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${tavan})`);
    g.addColorStop(.6, `rgba(255, 255, 255, ${tavan * .9})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // kaynak: camgöbeği kopya (canvas), maskeKatman: aynı boyutta maske (canvas). Ara canvas bir kez açılır.
  let ara = null;
  function uygula(ctx, kaynak, maskeKatman) {
    if (!ara) ara = document.createElement('canvas');
    if (ara.width !== kaynak.width || ara.height !== kaynak.height) { ara.width = kaynak.width; ara.height = kaynak.height; }
    const a = ara.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'copy';
    a.drawImage(kaynak, 0, 0);
    a.globalCompositeOperation = 'destination-in';
    a.drawImage(maskeKatman, 0, 0);
    a.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(ara, 0, 0);
    ctx.restore();
  }

  Kit.uv = { MOR, CAMGOBEGI, isik, maske, hafiza, uygula };
})();
