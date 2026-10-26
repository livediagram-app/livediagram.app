// The service's calls to Google's OAuth endpoint: redeem a consent code, mint an access token from the stored
// refresh token, revoke the grant, and learn which Google account a consent is for (liveworkspace/docs/specs/005-drive/drive.md
// "Tokens"). Server-to-server, with the client secret that never leaves the service.

import { googleApiBase, googleOAuthBase, timedFetch, type GoogleConfig } from './google';

type GoogleOAuthErrorKind = 'invalid_grant' | 'failed';

export class GoogleOAuthError extends Error {
  readonly kind: GoogleOAuthErrorKind;

  constructor(kind: GoogleOAuthErrorKind, detail: string) {
    super(`google oauth ${kind}: ${detail}`);
    this.name = 'GoogleOAuthError';
    this.kind = kind;
  }
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

async function postForm(c: GoogleConfig, url: string, form: Record<string, string>): Promise<Response> {
  try {
    return await timedFetch(c)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
  } catch (err) {
    throw new GoogleOAuthError('failed', err instanceof Error ? err.message : 'network');
  }
}

async function tokenCall(
  c: GoogleConfig,
  form: Record<string, string>,
): Promise<TokenResponse & { access_token: string; expires_in: number }> {
  const res = await postForm(c, `${googleOAuthBase(c)}/token`, {
    ...form,
    client_id: c.clientId,
    client_secret: c.clientSecret,
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (body.error === 'invalid_grant') throw new GoogleOAuthError('invalid_grant', 'invalid_grant');
    throw new GoogleOAuthError('failed', `${res.status} ${body.error ?? ''}`.trim());
  }
  if (!body.access_token || typeof body.expires_in !== 'number') {
    throw new GoogleOAuthError('failed', 'malformed token response');
  }
  return { ...body, access_token: body.access_token, expires_in: body.expires_in };
}

export async function exchangeCode(
  c: GoogleConfig,
  code: string,
  redirectUri: string,
  now: number,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number }> {
  const body = await tokenCall(c, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: now + body.expires_in * 1000,
  };
}

export async function refreshAccessToken(
  c: GoogleConfig,
  refreshToken: string,
  now: number,
): Promise<{ accessToken: string; expiresAt: number }> {
  const body = await tokenCall(c, { grant_type: 'refresh_token', refresh_token: refreshToken });
  return { accessToken: body.access_token, expiresAt: now + body.expires_in * 1000 };
}

/** Best effort: a failed revoke is logged and answered false, never thrown, because disconnecting and deleting an
 *  account must finish whatever Google says. */
export async function revokeToken(c: GoogleConfig, token: string): Promise<boolean> {
  try {
    const res = await postForm(c, `${googleOAuthBase(c)}/revoke`, { token });
    if (!res.ok) console.warn('drive: revoke-failed', res.status);
    return res.ok;
  } catch (err) {
    console.warn('drive: revoke-failed', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Drive's `about.user.permissionId`: the stable id of the Google account an access token acts for. The consent
 *  asks only for drive.file and drive.install, so there is no id token; `about` answers under drive.file. */
export async function fetchGoogleAccountId(c: GoogleConfig, accessToken: string): Promise<string> {
  let res: Response;
  try {
    res = await timedFetch(c)(`${googleApiBase(c)}/drive/v3/about?fields=user(permissionId)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    throw new GoogleOAuthError('failed', err instanceof Error ? err.message : 'network');
  }
  const body = (await res.json().catch(() => ({}))) as { user?: { permissionId?: unknown } };
  const id = body.user?.permissionId;
  if (!res.ok || typeof id !== 'string' || !id) throw new GoogleOAuthError('failed', `about ${res.status}`);
  return id;
}
