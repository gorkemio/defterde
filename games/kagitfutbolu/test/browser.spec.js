// npm ci && npx playwright install chromium && npm run test:browser
// BROWSER=firefox / BROWSER=webkit selects another installed Playwright engine.
// BROWSER_CHANNEL=chrome uses installed Chrome; BASE_URL can point to an HTTP preview.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const playwright = require('playwright');

const url = process.env.BASE_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const viewports = [
  [320, 568], [360, 640], [375, 667], [390, 844], [568, 320],
  [667, 375], [844, 390], [768, 1024], [1024, 768], [1440, 900],
];
let browser;
before(async () => {
  const engine = playwright[process.env.BROWSER || 'chromium'];
  assert.ok(engine, 'BROWSER must be chromium, firefox or webkit');
  browser = await engine.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { if (browser) await browser.close(); });

async function open(t, settings = {}, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: true });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, [], 'uncaught browser errors'));
  await page.addInitScript(s => {
    localStorage.setItem('kagitfutbolu-ayar', JSON.stringify({ ikiKisi: true, ...s }));
    localStorage.setItem('kagitfutbolu-sessiz', '0');
  }, settings);
  // Fonts are optional; running the suite must not depend on Google services.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.KF?.durum?.d && !KF.durum.kilit && !KF.durum.gecis);
  return page;
}

async function state(page) {
  return page.evaluate(() => {
    const o = KF.durum;
    return {
      ball: [o.G.nx[o.d.top], o.G.ny[o.d.top]], turn: o.d.sira,
      moves: o.gecmis.map(h => [h.e, h.sahip]), score: [...o.puan],
      page: o.sayfaNo, result: o.d.bitti, replaying: o.izliyor,
    };
  });
}

async function point(page, x, y) {
  return page.evaluate(([x, y]) => {
    const t = KF.durum.T, [px, py] = t.nok(x, y);
    const p = new DOMPoint(px, py).matrixTransform((t.dunya || t.svg).getScreenCTM());
    return { x: p.x, y: p.y };
  }, [x, y]);
}

async function move(page, x, y) {
  const count = (await state(page)).moves.length;
  assert.equal(await page.evaluate(([x, y]) => KF.durum.git(x, y), [x, y]), true, `legal move to ${x},${y}`);
  await page.waitForFunction(n => KF.durum.gecmis.length === n + 1 && (!KF.durum.kilit || KF.durum.d.bitti), count);
}

async function goal(page) {
  const { ball: [x, y] } = await state(page);
  for (let targetY = y - 1; targetY >= -1; targetY--) await move(page, x, targetY);
  await page.waitForFunction(() => KF.durum.sonuc && !document.querySelector('#yeniden-izle').hidden);
}

async function visibleInside(page, selectors) {
  const problems = await page.evaluate(selectors => {
    const problems = [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el || el.hidden || getComputedStyle(el).display === 'none') { problems.push(`${selector}: not visible`); continue; }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
        problems.push(`${selector}: ${JSON.stringify(r.toJSON())} outside ${innerWidth}×${innerHeight}`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('horizontal page overflow');
    return problems;
  }, selectors);
  assert.deepEqual(problems, []);
}

for (const size of ['kucuk', 'normal', 'uzun']) {
  test(`${size}: whole pitch, score and controls fit the 10-device matrix`, async t => {
    const page = await open(t, { saha: size });
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await visibleInside(page, ['#ust', '#saha', '#durum-metni', '#skor', '#yeni-sayfa', '#geri-al', '#taktik', '#ses-dugme']);
      const goals = await page.evaluate(() => {
        const o = KF.durum, m = (o.T.dunya || o.T.svg).getScreenCTM();
        return [-1, o.H + 1].flatMap(y => [o.W / 2 - 1, o.W / 2 + 1].map(x => {
          const [px, py] = o.T.nok(x, y), p = new DOMPoint(px, py).matrixTransform(m);
          return { x: p.x, y: p.y, inside: p.x >= 0 && p.y >= 0 && p.x <= innerWidth && p.y <= innerHeight };
        }));
      });
      assert.ok(goals.every(p => p.inside), `${width}×${height}: every goal corner is visible: ${JSON.stringify(goals)}`);
      const grid = await page.evaluate(() => {
        const sheet = document.querySelector('#sayfa'), r = sheet.getBoundingClientRect();
        const url = sheet.style.getPropertyValue('--kagit-cizgileri');
        const xml = decodeURIComponent(url.slice(url.indexOf(',') + 1, -2));
        const pattern = new DOMParser().parseFromString(xml, 'image/svg+xml').querySelector('pattern');
        const size = +pattern.getAttribute('width'), pm = pattern.patternTransform.baseVal.consolidate().matrix;
        const m = new DOMMatrix().translate(r.width / 2, r.height / 2)
          .multiply(new DOMMatrix(getComputedStyle(sheet, '::before').transform)).translate(-r.width / 2, -r.height / 2)
          .multiply(DOMMatrix.fromMatrix(pm));
        const o = KF.durum, errors = [[0, 0], [o.W, o.H], [o.W / 2, -1], [o.W / 2, o.H + 1]].flatMap(([x, y]) => {
          const p = new DOMPoint(...o.T.nok(x, y)).matrixTransform(o.T.dunya.getScreenCTM());
          return [p.x - r.left - m.e, p.y - r.top - m.f].map(d => Math.abs(d - Math.round(d / size) * size));
        });
        return { tilt: Math.max(Math.abs(m.b), Math.abs(m.c)), error: Math.max(...errors) };
      });
      assert.ok(grid.tilt < 1e-6 && grid.error < .02, `${width}×${height}: printed grid meets pitch and goal points: ${JSON.stringify(grid)}`);
      const buttons = await page.locator('#yonler button').evaluateAll(bs => bs.map(b => {
        const r = b.getBoundingClientRect(); return { width: r.width, height: r.height, disabled: b.disabled };
      }));
      if (await page.locator('#yonler').isVisible()) {
        assert.equal(buttons.length, 8);
        assert.ok(buttons.every(b => b.width >= 44 && b.height >= 44), 'direction buttons have 44px touch targets');
        await visibleInside(page, ['#yonler']);
      }
      const overlaps = await page.evaluate(() => {
        const controls = ['#saha', '#yeni-sayfa', '#geri-al', '#taktik', '#ses-dugme', '#yonler']
          .map(s => [s, document.querySelector(s)]).filter(([, e]) => e && !e.hidden && getComputedStyle(e).display !== 'none')
          .map(([s, e]) => [s, e.getBoundingClientRect()]);
        const collisions = [];
        for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
          const [a, r] = controls[i], [b, q] = controls[j];
          if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1) collisions.push(`${a} overlaps ${b}`);
        }
        return collisions;
      });
      assert.deepEqual(overlaps, [], `${width}×${height}: controls do not cover one another`);
    }
  });
}

test('settings remain on screen, trap focus in both directions and restore the opener', async t => {
  const page = await open(t, {}, { width: 568, height: 320 });
  await page.locator('#taktik').click();
  await visibleInside(page, ['#taktik-notu', '#tamam']);
  for (const key of ['Shift+Tab', 'Tab']) {
    for (let i = 0; i < 32; i++) {
      await page.keyboard.press(key);
      const focus = await page.evaluate(() => ({ inside: document.querySelector('#taktik-notu').contains(document.activeElement), element: document.activeElement.outerHTML.slice(0, 200) }));
      assert.equal(focus.inside, true, `${key} ${i + 1} stays inside settings: ${focus.element}`);
    }
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#taktik-notu').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'taktik');
});

test('Shift+Tab from the first setting never focuses background game controls', async t => {
  const page = await open(t);
  await page.locator('#taktik').click();
  await page.locator('#taktik-notu .ayar').first().focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.querySelector('#taktik-notu').contains(document.activeElement)), true);
});

test('touch moves, double taps, undo and rotation preserve the ongoing game', async t => {
  const page = await open(t, { evModu: true });
  const initial = await state(page), p = await point(page, 4, 4);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction(() => KF.durum.gecmis.length === 1 && !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 4]);
  const before = await state(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await state(page), before, 'rotation keeps ball, edges, score, turn and page');
  const blueGoal = await point(page, 4, -1), redGoal = await point(page, 4, 11);
  assert.ok(blueGoal.x > redGoal.x, 'blue attacks right in landscape');
  const target = await point(page, 4, 3);
  await page.evaluate(p => {
    const el = document.querySelector('#saha');
    for (let i = 0; i < 2; i++) for (const type of ['pointerdown', 'pointerup']) {
      el.dispatchEvent(new PointerEvent(type, { pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true }));
    }
  }, target);
  await page.waitForFunction(() => !KF.durum.kilit);
  assert.equal((await state(page)).moves.length, 2, 'same-turn double tap adds exactly one move');
  await page.locator('#geri-al').click();
  assert.deepEqual((await state(page)).ball, before.ball);
  await page.locator('#geri-al').click();
  assert.deepEqual((await state(page)).ball, initial.ball);
});

test('score emphasis follows turns and undo, then clears at game end', async t => {
  const page = await open(t, { evModu: true }, { width: 1248, height: 955 });
  const current = () => page.locator('#skor [aria-current="true"]');
  assert.equal(await current().count(), 1);
  assert.match(await current().textContent(), /Mavi/);
  const scale = await page.locator('#skor b').first().evaluate(b =>
    parseFloat(getComputedStyle(b).fontSize) / parseFloat(getComputedStyle(b.parentElement).fontSize));
  assert.ok(scale >= 1.14, 'score digits stand out from team labels');
  await move(page, 4, 4);
  assert.match(await current().textContent(), /Kırmızı/);
  await page.locator('#geri-al').click();
  assert.match(await current().textContent(), /Mavi/);
  await goal(page);
  assert.equal(await current().count(), 0, 'finished game has no active turn');
  await page.locator('#yeni-sayfa').click();
  await page.waitForFunction(() => !KF.durum.kilit && !KF.durum.gecis);
  assert.match(await current().textContent(), /Mavi/);
});

test('touch drag commits a legal move and pointercancel leaves the game unchanged', async t => {
  const page = await open(t, { surukle: true });
  const before = await state(page), a = await point(page, ...before.ball), b = await point(page, 4, 4);
  async function drag(end) {
    await page.evaluate(({ a, b, end }) => {
      const el = document.querySelector('#saha');
      for (const [type, p] of [['pointerdown', a], ['pointermove', b], [end, b]]) {
        el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true }));
      }
    }, { a, b, end });
  }
  await drag('pointercancel');
  assert.deepEqual(await state(page), before);
  await drag('pointerup');
  await page.waitForFunction(() => !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 4]);
});

test('mouse release outside the pitch does not consume the next valid click', async t => {
  const page = await open(t);
  const awayFromBall = await point(page, 1, 1);
  await page.mouse.move(awayFromBall.x, awayFromBall.y);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  assert.equal((await state(page)).moves.length, 0, 'the abandoned gesture does not move the ball');
  const target = await point(page, 4, 4);
  await page.mouse.click(target.x, target.y);
  assert.equal((await state(page)).moves.length, 1, 'the first valid click after leaving the pitch commits a move');
  await page.waitForFunction(() => !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 4]);
});

test('small-screen direction controls accept keyboard input and disable illegal reverse moves', async t => {
  const page = await open(t, {}, { width: 320, height: 568 });
  const up = page.locator('#yonler button[data-dx="0"][data-dy="-1"]');
  assert.equal(await up.isVisible(), true);
  await up.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 4]);
  assert.equal(await page.locator('#yonler button[data-dx="0"][data-dy="1"]').isDisabled(), true);
  await page.locator('#saha').focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => KF.durum.gecmis.length === 2 && !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 3]);
  assert.match(await page.locator('#duyuru').textContent(), /Mavi|Kırmızı|sıra|oynuyor/i);
});

test('landscape directions and diagonal keyboard keys follow the screen orientation', async t => {
  const page = await open(t, {}, { width: 568, height: 320 });
  await page.locator('#yonler button[data-dx="1"][data-dy="0"]').click();
  await page.waitForFunction(() => KF.durum.gecmis.length === 1 && !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [4, 4], 'screen right advances toward the blue target goal');
  assert.equal(await page.locator('#yonler button[data-dx="-1"][data-dy="0"]').isDisabled(), true);
  await page.locator('#saha').focus();
  await page.keyboard.press('e');
  await page.waitForFunction(() => KF.durum.gecmis.length === 2 && !KF.durum.kilit);
  assert.deepEqual((await state(page)).ball, [3, 3], 'E moves diagonally up and right on screen');
});

test('replaying a match goal resumes the next page once and preserves the score', async t => {
  const page = await open(t, { mac: true });
  await goal(page);
  const finished = await state(page);
  assert.deepEqual(finished.score, [1, 0]);
  await page.locator('#yeniden-izle').click();
  await page.waitForFunction(() => !KF.durum.izliyor);
  assert.deepEqual((await state(page)).score, [1, 0], 'replay does not count another goal');
  await page.waitForFunction(n => KF.durum.sayfaNo === n + 1 && !KF.durum.gecis, finished.page, { timeout: 7000 });
  const next = await state(page);
  assert.deepEqual(next.score, [1, 0]);
  assert.equal(next.turn, 1, 'conceding player starts');
  assert.equal(next.moves.length, 0);
});

test('new page cancels an old goal transition and an in-progress replay', async t => {
  const page = await open(t, { mac: true });
  await goal(page);
  await page.locator('#yeniden-izle').click();
  await page.locator('#yeni-sayfa').click();
  await page.waitForFunction(() => !KF.durum.gecis && !KF.durum.kilit);
  const fresh = await state(page);
  await page.waitForTimeout(4500);
  assert.deepEqual(await state(page), fresh, 'stale replay/goal timers never replace the new page');
});

test('three goals finish the match and a requested new match starts at zero', async t => {
  const page = await open(t, { mac: true });
  for (let n = 1; n <= 3; n++) {
    await goal(page);
    assert.deepEqual((await state(page)).score, [n, 0]);
    if (n < 3) {
      await page.locator('#yeni-sayfa').click();
      await page.waitForFunction(() => !KF.durum.gecis && !KF.durum.kilit && !KF.durum.d.bitti);
    }
  }
  const finished = await state(page);
  assert.equal(await page.evaluate(() => KF.durum.macBitti), true);
  await page.waitForTimeout(4500);
  assert.deepEqual(await state(page), finished, 'completed match does not automatically restart');
  await page.locator('#yeni-sayfa').click();
  await page.waitForFunction(() => !KF.durum.gecis && !KF.durum.kilit);
  assert.deepEqual((await state(page)).score, [0, 0]);
  assert.equal((await state(page)).result, null);
});

for (const rule of ['gol', 'tekrar', 'mac']) {
  test(`trapped player obeys the match setting: ${rule}`, async t => {
    const page = await open(t, { mac: true, sikismaMac: rule });
    for (const [x, y] of [[3, 4], [2, 3], [1, 2], [1, 1], [0, 0]]) await move(page, x, y);
    await page.waitForFunction(() => KF.durum.sonuc);
    const finished = await state(page);
    assert.deepEqual(finished.result, { kazanan: 1, sebep: 'sikisma' });
    assert.deepEqual(finished.score, rule === 'gol' ? [0, 1] : [0, 0]);
    assert.equal(await page.evaluate(() => KF.durum.macBitti), rule === 'mac');
    if (rule === 'mac') {
      await page.waitForTimeout(4500);
      assert.equal((await state(page)).page, finished.page, 'trapping ends the match without a new page');
    } else {
      await page.waitForFunction(n => KF.durum.sayfaNo === n + 1 && !KF.durum.gecis, finished.page, { timeout: 7000 });
      const next = await state(page);
      assert.deepEqual(next.score, finished.score);
      assert.equal(next.turn, 0, 'trapped player starts the next page');
    }
  });
}

test('rotating during computer thinking preserves the human move and lets the reply finish', async t => {
  const page = await open(t, { ikiKisi: false, zorluk: 'kolay' });
  const target = await point(page, 4, 4);
  await page.touchscreen.tap(target.x, target.y);
  await page.waitForFunction(() => KF.durum.gecmis.length === 1 && KF.durum.kilit);
  const first = (await state(page)).moves[0];
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => !KF.durum.kilit && KF.durum.gecmis.length >= 2, null, { timeout: 5000 });
  const after = await state(page);
  assert.deepEqual(after.moves[0], first);
  assert.equal(after.turn, 0);
  assert.equal(after.page, 1);
});

test('mute immediately stops the active goal recording and cancels delayed playback', async t => {
  const page = await open(t);
  await page.locator('#saha').tap();
  await page.waitForFunction(() => KF.durum.kayitlar.gol?.readyState >= 3);
  await page.evaluate(() => KF.durum.sesCal('gol'));
  await page.waitForFunction(() => !KF.durum.kayitlar.gol.paused);
  await page.locator('#ses-dugme').click();
  assert.equal(await page.evaluate(() => KF.durum.kayitlar.gol.paused), true, 'active goal is stopped');
  await page.locator('#ses-dugme').click();
  await page.evaluate(() => KF.durum.sesCal('gol', 400));
  await page.locator('#ses-dugme').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => KF.durum.kayitlar.gol.paused), true, 'delayed goal stays stopped after muting');
});

for (const transition of ['new page', 'mute then unmute']) {
  for (const error of ['AbortError', 'NotSupportedError']) {
    test(`stale recording rejection never starts synthesized goal audio: ${transition}, ${error}`, async t => {
      const page = await open(t);
      await page.locator('#saha').tap();
      await page.waitForFunction(() => KF.durum.kayitlar.gol?.readyState >= 3);
      await page.evaluate(() => {
        // Control only the asynchronous media boundary; keep the game's lifecycle and sound dispatch real.
        window.synthesizedGoals = 0;
        Kit.ses.sentez.gol = () => { window.synthesizedGoals++; };
        KF.durum.kayitlar.gol.play = () => new Promise((resolve, reject) => { window.rejectPendingGoal = reject; });
        KF.durum.sesCal('gol');
      });
      await page.waitForFunction(() => typeof window.rejectPendingGoal === 'function');
      if (transition === 'new page') {
        await page.locator('#yeni-sayfa').click();
        await page.waitForFunction(() => !KF.durum.gecis && !KF.durum.kilit);
      } else {
        await page.locator('#ses-dugme').click();
        await page.locator('#ses-dugme').click();
      }
      await page.evaluate(async name => {
        window.rejectPendingGoal(new DOMException('Deferred media rejection', name));
        await Promise.resolve();
      }, error);
      assert.equal(await page.evaluate(() => window.synthesizedGoals), 0, `${error} from a cancelled recording must stay silent after ${transition}`);
    });
  }
}

test('current unsupported recording still falls back to synthesized goal audio', async t => {
  const page = await open(t);
  await page.locator('#saha').tap();
  await page.waitForFunction(() => KF.durum.kayitlar.gol?.readyState >= 3);
  await page.evaluate(() => {
    window.synthesizedGoals = 0;
    Kit.ses.sentez.gol = () => { window.synthesizedGoals++; };
    KF.durum.kayitlar.gol.play = () => Promise.reject(new DOMException('Unsupported recording', 'NotSupportedError'));
    KF.durum.sesCal('gol');
  });
  await page.waitForFunction(() => window.synthesizedGoals === 1);
  assert.equal(await page.evaluate(() => window.synthesizedGoals), 1);
});

test('blocked external requests still permit a complete local game', async t => {
  const page = await open(t);
  // file://: bütün ağ kapalı. BASE_URL: yalnız test sunucusundaki yerel dosyalar açık.
  const origin = new URL(url).origin;
  await page.route(/^https?:/, route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.reload();
  await page.waitForFunction(() => KF.durum?.d && !KF.durum.kilit);
  await goal(page);
  assert.deepEqual((await state(page)).score, [1, 0]);
  assert.match(await page.locator('#duyuru').textContent(), /kazandı|gol/i);
});

test('long single-player and completed-goal status keep the smallest layouts usable', async t => {
  for (const [width, height] of [[320, 568], [568, 320]]) {
    const page = await open(t, { ikiKisi: false }, { width, height });
    async function check(replay) {
      const selectors = ['#saha', '#durum-metni', '#skor', '#yeni-sayfa', replay ? '#yeniden-izle' : '#geri-al', '#taktik', '#ses-dugme', '#yonler'];
      await visibleInside(page, selectors);
      const overlaps = await page.evaluate(selectors => {
        const bounds = selectors.filter(s => !document.querySelector(s).hidden).map(s => [s, document.querySelector(s).getBoundingClientRect()]);
        const overlaps = [];
        for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
          const [a, p] = bounds[i], [b, q] = bounds[j];
          if (Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1) overlaps.push(`${a} overlaps ${b}`);
        }
        return overlaps;
      }, selectors);
      assert.deepEqual(overlaps, [], `${width}×${height}: status and controls stay separate`);
    }
    await check(false);
    // Select two-player mode through settings to make the following goal deterministic.
    await page.locator('#taktik').click();
    await page.locator('[data-ayar="ikiKisi"]').click();
    await page.locator('#tamam').click();
    await page.locator('#yeni-sayfa').click();
    await page.waitForFunction(() => !KF.durum.kilit && !KF.durum.gecis);
    await goal(page);
    await page.waitForTimeout(1100); // End-of-round status follows the goal celebration.
    await check(true);
  }
});

test('large text keeps settings usable and fullscreen rejection leaves moves available', async t => {
  const page = await open(t, {}, { width: 568, height: 320 });
  const normalText = await page.locator('#durum-metni').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const largeText = await page.locator('#durum-metni').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  assert.ok(largeText >= normalText * 2, 'text zoom actually doubles the rendered status font');
  await page.locator('#taktik').click();
  await visibleInside(page, ['#taktik-notu', '#tamam']);
  await page.locator('#tam-ekran').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Not allowed', 'NotAllowedError'));
  });
  await page.locator('#tam-ekran').click();
  await page.locator('#tamam').click();
  await move(page, 4, 4);
  assert.deepEqual((await state(page)).ball, [4, 4]);
});
