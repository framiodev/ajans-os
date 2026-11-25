import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRevision, pickLayer } from '../services/ps/revise.mjs';

test('parseRevision: hedef ve yön', () => {
  assert.deepEqual(parseRevision('Başlığı 8 punto büyüt'), { kind: 'headline', delta: 8 });
  assert.deepEqual(parseRevision('logoyu küçült'), { kind: 'logo', delta: -10 });
  assert.deepEqual(parseRevision('CTA butonunu 4 px küçült'), { kind: 'cta', delta: -4 });
  assert.equal(parseRevision('daha modern yap').delta, null);
});

test('pickLayer: grup içindeki katmanı bulur, çift ad belirsizse null', () => {
  const snap = { layers: [{ name: 'Copy', kind: 'group', children: [{ name: 'Headline_H1', kind: 'text', text: { size: 70 } }] }] };
  assert.equal(pickLayer(snap, 'headline').name, 'Headline_H1');
  assert.equal(pickLayer(snap, 'logo'), null);
  const dup = { layers: [{ name: 'Headline_H1', kind: 'text' }, { name: 'Headline_H1', kind: 'text' }] };
  assert.equal(pickLayer(dup, 'headline'), null);
});
