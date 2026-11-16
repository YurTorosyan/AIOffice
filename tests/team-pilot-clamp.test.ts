import assert from 'node:assert/strict';
import test from 'node:test';

import { clamp } from '../src/team-pilot/clamp.ts';

test('clamp preserves values within the inclusive range', () => {
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
  assert.equal(clamp(4, 0, 10), 4);
});

test('clamp returns the nearest bound outside the range', () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('clamp rejects every non-finite argument', () => {
  const nonFiniteValues = [NaN, Infinity, -Infinity];

  for (const nonFinite of nonFiniteValues) {
    assert.throws(() => clamp(nonFinite, 0, 10), RangeError);
    assert.throws(() => clamp(5, nonFinite, 10), RangeError);
    assert.throws(() => clamp(5, 0, nonFinite), RangeError);
  }
});

test('clamp rejects a minimum greater than the maximum', () => {
  assert.throws(() => clamp(5, 10, 0), RangeError);
});
