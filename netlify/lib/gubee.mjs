import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';

export const API_BASE = 'https://api.gubee.com.br';
const AUTH_URL = 'https://auth.gubee.com.br/realms/gubee/protocol/openid-connect/token';
const store = () => getStore('gubee-private');

export function json(statusCode, data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders }
  });
}

export function unavailableStock() {
  return { available: false, confirmed: false, quantity: null, checkedAt: null, reason: 'not_confirmed' };
}

export function stockSnapshot(payload, checkedAt = new Date().toISOString()) {
  const entries = Array.isArray(payload) ? payload : Array.isArray(payload?.stocks) ? payload.stocks : payload && typeof payload === 'object' ? [payload] : [];
  if (!entries.length || entries.some(entry => !Number.isFinite(Number(entry?.qty)))) return unavailableStock();
  const quantity = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.qty) - Math.max(0, Number(entry.booking ?? 0))), 0);
  return { available: quantity > 0, confirmed: true, quantity, checkedAt, reason: quantity > 0 ? 'in_stock' : 'out_of_stock' };
}

export function priceValue(payload) {
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(payload?.prices) ? payload.prices
    : [payload?.defaultPrice, payload?.promotionPrice].filter(Boolean).concat(payload?.price ?? payload).filter(Boolean);
  const now = Date.now();
  const normalized = rows.filter(row => Number.isFinite(Number(row?.value))).map(row => ({
    value: Number(row.value), type: String(row.type ?? row.priceType ?? 'DEFAULT').toUpperCase(),
    begin: Date.parse(row.validityPeriod?.beginDt ?? row.validityPeriod?.begin ?? '') || 0,
    end: Date.parse(row.validityPeriod?.endDt ?? row.validityPeriod?.end ?? '') || Infinity
  }));
  const promotion = normalized.find(row => row.type === 'PROMOTION' && row.begin <= now && now <= row.end);
  const selected = promotion ?? normalized.find(row => row.type === 'DEFAULT') ?? normalized[0];
  return selected ? selected.value : null;
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readTokens() {
  try { return await store().get('oauth-tokens', { type: 'json' }); } catch { return null; }
}

export async function startOAuth(redirectUri) {
  const clientId = process.env.GUBEE_CLIENT_ID;
  if (!clientId || !process.env.GUBEE_CLIENT_SECRET || !redirectUri) throw new Error('Gubee OAuth is not configured');
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await store().setJSON(`oauth-state-${state}`, { verifier, createdAt: Date.now() });
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state });
  return `https://admin.gubee.com.br/#/oauth2/authorize?${params}`;
}

export async function completeOAuth(code, state, redirectUri, fetchImpl = fetch) {
  if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) || typeof code !== 'string' || code.length > 4096) throw new Error('Invalid OAuth callback');
  const stateKey = `oauth-state-${state}`;
  const pending = await store().get(stateKey, { type: 'json' });
  await store().delete(stateKey);
  if (!pending?.verifier || Date.now() - Number(pending.createdAt) > 10 * 60_000) throw new Error('OAuth state expired');
  const response = await fetchImpl(AUTH_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.GUBEE_CLIENT_ID, client_secret: process.env.GUBEE_CLIENT_SECRET, code, redirect_uri: redirectUri, code_verifier: pending.verifier }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Gubee authorization exchange failed (${response.status})`);
  const token = await response.json();
  if (!token.access_token || !token.refresh_token || !Number.isFinite(Number(token.expires_in))) throw new Error('Gubee returned an invalid token response');
  await store().setJSON('oauth-tokens', { access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + Number(token.expires_in) * 1000 });
}

export async function getAccessToken(fetchImpl = fetch) {
  const clientId = process.env.GUBEE_CLIENT_ID;
  const clientSecret = process.env.GUBEE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Gubee OAuth client is not configured');
  const saved = await readTokens();
  const refreshToken = saved?.refresh_token || process.env.GUBEE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('Gubee refresh token is not configured');
  if (saved?.access_token && Number(saved.expires_at) > Date.now() + 60_000) return saved.access_token;

  const response = await fetchImpl(AUTH_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Gubee token refresh failed (${response.status})`);
  const token = await response.json();
  if (!token.access_token || !Number.isFinite(Number(token.expires_in))) throw new Error('Gubee returned an invalid token response');
  const next = {
    access_token: token.access_token,
    refresh_token: token.refresh_token || refreshToken,
    expires_at: Date.now() + Number(token.expires_in) * 1000
  };
  await store().setJSON('oauth-tokens', next);
  return next.access_token;
}

export async function gubeeGet(path, fetchImpl = fetch) {
  if (typeof path !== 'string' || !path.startsWith('/integration/') || path.startsWith('//') || path.includes('..')) throw new Error('Invalid Gubee resource path');
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(`${API_BASE}${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/hal+json, application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Gubee API request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}

export async function getCatalog() {
  const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/content/products.json`, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error('Product catalog is unavailable');
  const data = await response.json();
  return Array.isArray(data.products) ? data.products : [];
}

export async function liveProduct(product) {
  const sku = String(product?.sku ?? '').trim();
  if (!sku) return { ...product, availability: unavailableStock(), livePrice: null, sync: 'missing_sku' };
  try {
    const encodedSku = encodeURIComponent(sku);
    const [stockResult, priceResult] = await Promise.allSettled([
      gubeeGet(`/integration/stocks/bysku?sku=${encodedSku}`),
      gubeeGet(`/integration/prices/bysku?sku=${encodedSku}`)
    ]);
    const checkedAt = new Date().toISOString();
    const availability = stockResult.status === 'fulfilled' ? stockSnapshot(stockResult.value, checkedAt) : unavailableStock();
    const livePrice = priceResult.status === 'fulfilled' ? priceValue(priceResult.value) : null;
    const failed = stockResult.status === 'rejected' || priceResult.status === 'rejected';
    return { ...product, availability, livePrice, checkedAt, sync: failed ? 'partial' : 'ok' };
  } catch {
    return { ...product, availability: unavailableStock(), livePrice: null, sync: 'error' };
  }
}

export async function gubeeProductStatus(product) {
  const sku = String(product?.sku ?? '').trim();
  if (!sku) return { status: 'missing_sku' };
  try {
    const mapping = await gubeeGet(`/integration/skus/by-sku?sku=${encodeURIComponent(sku)}`);
    if (!mapping?.skuId) return { status: 'not_found' };
    const details = await gubeeGet(`/integration/products/bySkuId/${encodeURIComponent(mapping.skuId)}`);
    return { status: 'ok', skuId: mapping.skuId, productStatus: details?.status ?? null };
  } catch {
    return { status: 'unavailable' };
  }
}

export function validWebhookResource(resource) {
  return typeof resource === 'string' && /^\/integration\/[A-Za-z0-9_./:%-]+$/.test(resource) && !resource.includes('..') && !resource.startsWith('//');
}

export function validWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object' || !validWebhookResource(payload.resource)) return false;
  const prefixByDomain = { order: '/integration/orders/', product: '/integration/products/', price: '/integration/prices/', stock: '/integration/stock/' };
  const events = {
    order: ['OrderCreated','OrderPayed','OrderInvoiced','OrderShipped','OrderDelivered','OrderCanceled','OrderReturned','OrderShipmentException'],
    product: ['VariationCreated','VariationUpdated'], price: ['PriceUpdated'], stock: ['StockUpdated']
  };
  return Boolean(prefixByDomain[payload.domain] && payload.resource.startsWith(prefixByDomain[payload.domain]) && events[payload.domain]?.includes(payload.type));
}
