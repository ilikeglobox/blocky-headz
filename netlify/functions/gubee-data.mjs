import { getCatalog, json, liveProduct, mapLimit } from '../lib/gubee.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' }, { allow: 'GET' });
  try {
    const products = await getCatalog();
    const results = await mapLimit(products, 5, liveProduct);
    return json(200, { products: results, checkedAt: new Date().toISOString() });
  } catch {
    return json(503, { error: 'inventory_unavailable', products: [] });
  }
}
