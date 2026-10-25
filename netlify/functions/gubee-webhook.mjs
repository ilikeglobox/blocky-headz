import { timingSafeEqual } from 'node:crypto';
import { gubeeGet, json, validWebhookPayload } from '../lib/gubee.mjs';

function equalSecret(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { allow: 'POST' });
  if (!equalSecret(request.headers.get('x-gubee-token'), process.env.GUBEE_WEBHOOK_TOKEN)) return json(401, { error: 'invalid_webhook_token' });
  let payload;
  try { payload = await request.json(); } catch { return json(400, { error: 'invalid_json' }); }
  if (!validWebhookPayload(payload)) return json(400, { error: 'invalid_event' });
  if (process.env.GUBEE_SELLER_ID && payload.sellerId !== process.env.GUBEE_SELLER_ID) return json(403, { error: 'seller_mismatch' });
  try {
    await gubeeGet(payload.resource);
    return json(202, { accepted: true, domain: payload.domain, type: payload.type });
  } catch {
    return json(502, { error: 'resource_refresh_failed' });
  }
}
