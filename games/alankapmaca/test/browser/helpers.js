'use strict';
const { expect } = require('playwright/test');

async function openGame(page, { board = 16, seconds = 0, calculation = true, dieMax = 6, url = '/' } = {}) {
  await page.addInitScript(({ board, seconds, calculation, dieMax }) => {
    try {
      localStorage.setItem('alankapmaca-ayar', JSON.stringify({
        tahta: String(board), sure: String(seconds), hesap: calculation ? 'acik' : 'kapali', zar: String(dieMax),
      }));
    } catch { /* Safari may disallow localStorage under file://. */ }
  }, { board, seconds, calculation, dieMax });
  await page.goto(url);
  await page.waitForFunction(() => window.AB?.durum?.hazir && !AB.durum.kilit);
  await page.evaluate(() => { AB.durum.r = AB.game.rng(2); });
}

async function gateVisible(page) {
  return page.locator('#yon-uyarisi').isVisible();
}

function expectBounds(box, viewport, name) {
  expect(box.x, name + ' left').toBeGreaterThanOrEqual(-1);
  expect(box.y, name + ' top').toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, name + ' right').toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, name + ' bottom').toBeLessThanOrEqual(viewport.height + 1);
}

async function fitOrGate(page, { touch = false } = {}) {
  const viewport = page.viewportSize();
  // A single browser read keeps matrix tests fast and samples one consistent layout frame.
  const layout = await page.evaluate(() => {
    const rect = el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    };
    const visible = el => {
      const box = rect(el), style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const gate = document.querySelector('#yon-uyarisi');
    const result = { scrollWidth: document.documentElement.scrollWidth,
      scale: window.visualViewport?.scale ?? 1, gate: visible(gate) };
    if (result.gate) return { ...result, gateText: gate.textContent, gateBox: rect(gate), fullscreen: rect(document.querySelector('#tam-ekran')) };
    const ids = ['tahta', 'ust', 'skor', 'hesap', 'zar-a', 'zar-b', 'ayarlar', 'yeni-sayfa', 'ses-dugme'];
    const parts = ids.map(id => {
      const el = document.getElementById(id);
      return { id, box: rect(el), visible: visible(el) };
    });
    const controls = [...document.querySelectorAll('button, input')].filter(visible).map(el => {
      const box = rect(el);
      const plainText = el.matches('input') || el.querySelector('.yazi') ||
        [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const textSizes = plainText ? [parseFloat(getComputedStyle(el).fontSize)] :
        [...el.querySelectorAll('svg text')].map(text => {
          const matrix = text.getScreenCTM();
          return parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b);
        });
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { id: el.id, box, textSizes, enabled: !el.disabled, reachable: el === top || el.contains(top) };
    });
    // SVG text can overflow an otherwise correct parent element box.
    const hintText = [...document.querySelectorAll('#ipucu text')].filter(visible).map(rect);
    return { ...result, parts, controls, hintText, board: rect(document.querySelector('#tahta')), n: AB.durum.oyun.n };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  expect(layout.scale).toBeCloseTo(1, 2);
  if (layout.gate) {
    expect(layout.gateText).toMatch(/çevir|ekran|yatay/i);
    expectBounds(layout.gateBox, viewport, 'orientation gate');
    expectBounds(layout.fullscreen, viewport, 'fullscreen button');
    return;
  }
  for (const part of layout.parts) {
    expect(part.visible, part.id + ' visible').toBe(true);
    expectBounds(part.box, viewport, part.id);
  }
  const board = layout.board;
  expect(board.width / layout.n).toBeGreaterThanOrEqual(13.99);
  for (const label of layout.hintText) expectBounds(label, viewport, 'hint text');
  for (const control of layout.controls) {
    const box = control.box;
    expectBounds(box, viewport, control.id);
    if (touch) {
      expect(box.width, control.id + ' width').toBeGreaterThanOrEqual(43.99);
      expect(box.height, control.id + ' height').toBeGreaterThanOrEqual(43.99);
      for (const size of control.textSizes) expect(size, control.id + ' text').toBeGreaterThanOrEqual(15.99);
    }
    expect(box.x >= board.x + board.width || box.x + box.width <= board.x ||
      box.y >= board.y + board.height || box.y + box.height <= board.y,
    control.id + ' must not cover the board').toBe(true);
    if (control.enabled) expect(control.reachable, control.id + ' must be reachable').toBe(true);
  }
}

async function expectInside(page, selector) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  const box = await element.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x, selector + ' left').toBeGreaterThanOrEqual(-1);
  expect(box.y, selector + ' top').toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, selector + ' right').toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, selector + ' bottom').toBeLessThanOrEqual(viewport.height + 1);
}

async function roll(page) {
  await page.locator('#zar-a').click();
  await page.waitForFunction(() => AB.durum.hesaplaniyor && !AB.durum.kilit);
  return page.evaluate(() => AB.durum.oyun.zar.a * AB.durum.oyun.zar.b);
}

async function answer(page, value, { touch = false } = {}) {
  if (touch) {
    for (const digit of String(value)) await page.locator(`[data-sayi="${digit}"]`).tap();
    await page.locator('#sayi-tamam').tap();
  } else {
    await page.locator('#giris').fill(String(value));
    await page.locator('#tamam').click();
  }
  await page.waitForFunction(() => AB.durum.yerlesiyor && !AB.durum.kilit);
}

async function state(page) {
  return page.evaluate(() => ({
    turn: AB.durum.oyun.tur, phase: AB.durum.oyun.asama, player: AB.durum.oyun.sira,
    points: AB.durum.oyun.puan, rectangles: AB.durum.oyun.dikdortgenler,
    preview: AB.durum.hayalet, selected: AB.durum.isaret, horizontal: AB.durum.yatay,
    answer: document.querySelector('#giris').value,
  }));
}

module.exports = { openGame, gateVisible, fitOrGate, expectInside, roll, answer, state };
