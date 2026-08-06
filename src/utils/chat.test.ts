import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveChatId } from './chat.js';

test('deriveChatId stays consistent for the same participants regardless of order', () => {
  assert.equal(deriveChatId('seller-2', 'buyer-1', 'listing-9'), 'buyer-1-seller-2-listing-9');
  assert.equal(deriveChatId('buyer-1', 'seller-2', 'listing-9'), 'buyer-1-seller-2-listing-9');
});

test('deriveChatId omits the listing suffix when no listing is provided', () => {
  assert.equal(deriveChatId('buyer-1', 'seller-2'), 'buyer-1-seller-2');
});
