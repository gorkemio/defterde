import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../engine/geom.js';

const kare = G.ccw([[0, 0], [1, 0], [1, 1], [0, 1]]);
const yakin = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);

test('kes: kare ikiye ayrılır, alanlar toplamı korunur', () => {
  const c = [[0.5, -1], [0.5, 2]];
  const sol = G.kes(kare, c, 1), sag = G.kes(kare, c, -1);
  yakin(Math.abs(G.alan(sol)) + Math.abs(G.alan(sag)), 1);
  yakin(Math.abs(G.alan(sol)), 0.5);
});

test('kes: çizgi üstündeki köşe iki yarıda da kalır, kıymık üretmez', () => {
  const ucgen = G.ccw([[0, 0], [1, 0], [0, 1]]);
  const c = [[0, 0], [1, 1]];                            // köşegen: (0,0) çizgi üstünde
  const a = G.kes(ucgen, c, 1), b = G.kes(ucgen, c, -1);
  yakin(Math.abs(G.alan(a)) + Math.abs(G.alan(b)), 0.5);
  assert.ok(a.some(p => p[0] === 0 && p[1] === 0) && b.some(p => p[0] === 0 && p[1] === 0));
});

test('yansıma: involüsyon, izometri, çizgi sabit', () => {
  const c = [[0.5, 0], [0, 0.5]];
  const R = G.yansimaT(c);
  yakin(G.detT(R), -1);
  const p = [0.1, 0.05];
  const q = G.donustur(R, G.donustur(R, p));
  yakin(q[0], p[0]); yakin(q[1], p[1]);
  const r = G.donustur(R, [0, 0]);
  yakin(r[0], 0.5); yakin(r[1], 0.5);
});

test('birleştir ve ters dönüşüm', () => {
  const A = G.yansimaT([[0, 0], [1, 2]]), B = G.yansimaT([[0.3, 0], [0.3, 1]]);
  const C = G.birlestir(A, B), Ci = G.tersT(C);
  const p = [0.7, -0.2];
  const q = G.donustur(Ci, G.donustur(C, p));
  yakin(q[0], p[0]); yakin(q[1], p[1]);
  const r1 = G.donustur(C, p), r2 = G.donustur(A, G.donustur(B, p));
  yakin(r1[0], r2[0]); yakin(r1[1], r2[1]);
});

test('orta dikme: nokta hedefe yansır', () => {
  const c = G.ortaDikme([0, 0.6], [0.5, 1.1]);
  const q = G.yansit(c, [0, 0.6]);
  yakin(q[0], 0.5); yakin(q[1], 1.1);
});

test('kenar paylaşımı ve kesişim alanı', () => {
  const sag = G.ccw([[1, 0], [2, 0], [2, 1], [1, 1]]);
  assert.ok(G.kenarPaylasir(kare, sag));
  assert.ok(!G.kenarPaylasir(kare, G.ccw([[1, 1], [2, 1], [2, 2]])));   // yalnız köşe değiyor
  yakin(G.kesisimAlani(kare, sag), 0);
  yakin(G.kesisimAlani(kare, G.ccw([[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]])), 0.25);
});

test('parça kırpma', () => {
  const s = G.parcaKirp([[-1, 0.5], [2, 0.5]], kare);
  yakin(s[0][0], 0); yakin(s[1][0], 1);
  assert.equal(G.parcaKirp([[2, 2], [3, 3]], kare), null);
});
