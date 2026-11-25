import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derle, esle } from '../rota.js';

const ROTALAR = ['/masa', '/katalog', '/atolye/:tasarim', '/uc/:ucakId', '/hangar'].map(derle);

test('boş hash varsayılan rotaya gider', () => {
  assert.equal(esle(ROTALAR, '').rota.desen, '/masa');
  assert.equal(esle(ROTALAR, '#').rota.desen, '/masa');
});

test('parametreli rota eşleşir ve çözülür', () => {
  const e = esle(ROTALAR, '#/atolye/ok');
  assert.equal(e.rota.desen, '/atolye/:tasarim');
  assert.deepEqual(e.params, { tasarim: 'ok' });
  assert.deepEqual(esle(ROTALAR, '#/uc/u_k3%20x').params, { ucakId: 'u_k3 x' });
});

test('sondaki eğik çizgi tolere edilir, bilinmeyen rota null', () => {
  assert.equal(esle(ROTALAR, '#/hangar/').rota.desen, '/hangar');
  assert.equal(esle(ROTALAR, '#/yok'), null);
  assert.equal(esle(ROTALAR, '#/atolye/ok/fazla'), null);
});

test('uçuş rotası mekânla eşleşir', () => {
  const R = ['/uc/:ucakId', '/uc/:ucakId/:sahne'].map(derle);
  assert.deepEqual(esle(R, '#/uc/u_1/park').params, { ucakId: 'u_1', sahne: 'park' });
  assert.deepEqual(esle(R, '#/uc/u_1').params, { ucakId: 'u_1' });
});
