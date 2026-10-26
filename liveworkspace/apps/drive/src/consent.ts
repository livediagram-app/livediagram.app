// The consent's addresses (liveworkspace/docs/drive.md "Connecting"): where Google sends the code back, the page the
// browser returns to afterwards, and Google's consent URL itself.

import { DRIVE_SCOPES } from '@liveworkspace/drive';
import { appOfOrigin, EXPLORER_PATH } from '@liveworkspace/sites';
import { sameSiteOrigin } from '@liveworkspace/sites/www';
import { environmentOf, publicOrigin, type Env } from './env';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const RETURN_MAX = 2048;

/** liveworkspace's page Google returns the code to: the same in every environment's OAuth client. */
export const redirectUriOf = (env: Env) => `${publicOrigin(env)}/drive/connected`;

/** The page to come back to: `returnTo` when it is a page of liveworkspace or of an app in this environment
 *  (`appOfOrigin`), else liveworkspace's Explorer. A path alone is liveworkspace's. */
export function safeReturnTo(env: Env, returnTo: unknown): string {
  const home = publicOrigin(env);
  const fallback = `${home}${EXPLORER_PATH}`;
  if (typeof returnTo !== 'string' || !returnTo || returnTo.length > RETURN_MAX) return fallback;
  let url: URL;
  try {
    // `//host` is another origin, not a path.
    url =
      returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? new URL(returnTo, home)
        : new URL(returnTo);
  } catch {
    return fallback;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
  if (url.username || url.password) return fallback;
  // liveworkspace on either of its hosts while the move to www. lasts, or an app.
  const ours =
    sameSiteOrigin(url.origin, home) || appOfOrigin(url.origin, environmentOf(env)) !== null;
  return ours ? url.toString() : fallback;
}

/** Google's consent screen: an authorisation code, offline access, consent asked every time (so a refresh token
 *  always comes back), the mirror's two scopes. */
export function consentUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}
