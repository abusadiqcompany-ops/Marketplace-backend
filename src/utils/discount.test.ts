import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount } from './discount.js';

test('calculateDiscount returns exact NGN values for a 10% reduction', () => {
  const result = calculateDiscount({ originalPrice: 100000, discountPercentage: 10, discountEnabled: true });

  assert.equal(result.discountEnabled, true);
  assert.equal(result.originalPrice, 100000);
  assert.equal(result.discountPercentage, 10);
  assert.equal(result.discountAmount, 10000);
  assert.equal(result.finalPrice, 90000);
});

test('calculateDiscount disables discounts below a valid minimum and keeps original price', () => {
  const result = calculateDiscount({ originalPrice: 100000, discountPercentage: 0, discountEnabled: false });

  assert.equal(result.discountEnabled, false);
  assert.equal(result.discountPercentage, 0);
  assert.equal(result.discountAmount, 0);
  assert.equal(result.finalPrice, 100000);
});
