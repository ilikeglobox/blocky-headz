import { getUser } from '@netlify/identity';
import { completeOAuth, json, startOAuth } from '../lib/gubee.mjs';

const callbackPath = '/.netlify/functions/gubee-oauth?action=callback';

export default async function handler(request) {
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' }, { allow: 'GET' });
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const baseUrl = process.env.URL;
  const redirectUri = process.env.GUBEE_REDIRECT_URI || (baseUrl ? `${baseUrl}${callbackPath}` : '');
  if (action === 'start') {
    const user = await getUser();
    if (!user) return json(401, { error: 'authentication_required' });
    if (!Array.isArray(user.roles) || !user.roles.includes('admin')) return json(403, { error: 'admin_role_required' });
    try { return json(200, { authorizationUrl: await startOAuth(redirectUri) }); }
    catch { return json(503, { error: 'gubee_oauth_not_configured' }); }
  }
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state || url.searchParams.has('error')) return Response.redirect(`${baseUrl}/admin/inventory.html?gubee=error`, 303);
    try {
      await completeOAuth(code, state, redirectUri);
      return Response.redirect(`${baseUrl}/admin/inventory.html?gubee=connected`, 303);
    } catch {
      return Response.redirect(`${baseUrl}/admin/inventory.html?gubee=error`, 303);
    }
  }
  return json(400, { error: 'invalid_action' });
}
