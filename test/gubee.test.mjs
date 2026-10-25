import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLimit, priceValue, stockSnapshot, unavailableStock, validWebhookPayload, validWebhookResource } from '../netlify/lib/gubee.mjs';

test('stock availability uses confirmed quantity less reservations', () => {
  assert.deepEqual(stockSnapshot([{ qty: 5, booking: 2 }], '2026-10-24T12:00:00.000Z'), {
    available: true, confirmed: true, quantity: 3, checkedAt: '2026-10-24T12:00:00.000Z', reason: 'in_stock'
  });
  assert.equal(stockSnapshot([{ qty: 2, booking: 2 }]).available, false);
});

test('missing or malformed stock is never treated as available', () => {
  assert.equal(stockSnapshot(null).confirmed, false);
  assert.equal(stockSnapshot([{ booking: 1 }]).available, false);
  assert.equal(unavailableStock().quantity, null);
});

test('price parser prefers a currently active promotion and otherwise the default', () => {
  const now = new Date();
  const beginDt = new Date(now.getTime() - 60_000).toISOString();
  const endDt = new Date(now.getTime() + 60_000).toISOString();
  assert.equal(priceValue({ prices: [
    { value: 120, type: 'DEFAULT' },
    { value: 99, type: 'PROMOTION', validityPeriod: { beginDt, endDt } }
  ] }), 99);
  assert.equal(priceValue({ value: 120, type: 'DEFAULT' }), 120);
  assert.equal(priceValue({}), null);
});

test('webhook resources are restricted to safe Gubee integration paths', () => {
  assert.equal(validWebhookResource('/integration/orders/order-123'), true);
  assert.equal(validWebhookResource('/integration/stock/123?x=y'), false);
  assert.equal(validWebhookResource('//attacker.example/integration/orders/1'), false);
  assert.equal(validWebhookResource('/integration/../admin'), false);
  assert.equal(validWebhookPayload({ domain: 'stock', type: 'StockUpdated', resource: '/integration/stock/123' }), true);
  assert.equal(validWebhookPayload({ domain: 'stock', type: 'StockUpdated', resource: '/integration/orders/123' }), false);
  assert.equal(validWebhookPayload({ domain: 'TAG', type: 'TAG_ERROR', resource: '/integration/tags/123' }), false);
});

test('bounded mapping keeps result order while limiting concurrent work', async () => {
  let active = 0; let peak = 0;
  const results = await mapLimit([1, 2, 3, 4, 5], 2, async value => {
    active += 1; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1; return value * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});
