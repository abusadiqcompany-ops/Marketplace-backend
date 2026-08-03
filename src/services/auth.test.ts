import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoPasswordForEmail } from './auth.js';

test('returns the expected demo password for known seller and buyer accounts', () => {
  assert.equal(getDemoPasswordForEmail('emeka@seller.ng'), 'MarketConnectSeller2026!');
  assert.equal(getDemoPasswordForEmail('fatima@seller.ng'), 'MarketConnectSeller2026!');
  assert.equal(getDemoPasswordForEmail('chioma@buyer.ng'), 'MarketConnectBuyer2026!');
  assert.equal(getDemoPasswordForEmail('developer@marketconnect.dev'), 'MarketConnectDev2026!');
});

test('returns undefined for unknown emails', () => {
  assert.equal(getDemoPasswordForEmail('someone@example.com'), undefined);
});
