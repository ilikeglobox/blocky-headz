import { getUser } from '@netlify/identity';
import { getCatalog, gubeeGet, gubeeProductStatus, json, liveProduct, mapLimit } from '../lib/gubee.mjs';

const ORDER_QUEUES = ['created', 'paid', 'invoiced', 'shipped', 'delivered', 'canceled'];

export default async function handler(request) {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' }, { allow: 'GET' });
  try {
    const user = await getUser();
    if (!user) return json(401, { error: 'authentication_required' });
    if (!Array.isArray(user.roles) || !user.roles.includes('admin')) return json(403, { error: 'admin_role_required' });
    const [catalog, ...queueResults] = await Promise.all([
      getCatalog(),
      ...ORDER_QUEUES.map(async status => {
        try { return { status, ok: true, payload: await gubeeGet(`/integration/orders/queue/${status}?page=0&size=50`) }; }
        catch (error) { return { status, ok: false, error: error.message }; }
      })
    ]);
    const liveProducts = await mapLimit(catalog, 5, liveProduct);
    const products = await mapLimit(liveProducts, 5, async product => ({ ...product, gubeeProduct: await gubeeProductStatus(product) }));
    const queues = queueResults.map(result => ({
      status: result.status, ok: result.ok, error: result.error,
      orders: result.ok ? (result.payload?._embedded?.orderApiDTOList ?? []).map(order => ({
        id: order.id ?? order.orderId, status: order.status, totalAmount: order.totalAmount, currency: order.currency, createdDt: order.createdDt
      })) : []
    }));
    const configuredThreshold = Number(process.env.GUBEE_LOW_STOCK_THRESHOLD ?? 3);
    const lowStockThreshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0 ? configuredThreshold : 3;
    return json(200, { products, queues, lowStockThreshold, checkedAt: new Date().toISOString() });
  } catch (error) {
    if (error?.message?.includes('permission') || error?.message?.includes('(403)')) return json(200, { products: [], queues: [], warning: 'Gubee permissions do not allow one or more requested reads.', checkedAt: new Date().toISOString() });
    return json(503, { error: 'admin_data_unavailable' });
  }
}
