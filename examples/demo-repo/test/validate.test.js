import test from 'node:test';
import assert from 'node:assert';
import { isPostcode } from '../src/validate.js';

test('isPostcode accepts five digits', () => {
  assert.equal(isPostcode('30301'), true);
});

test('isPostcode rejects letters', () => {
  assert.equal(isPostcode('abcde'), false);
});
