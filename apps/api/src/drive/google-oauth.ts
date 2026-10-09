// The broker's three calls to Google's OAuth endpoint: redeem a consent code,
// mint an access token from the stored refresh token, and revoke the grant
// (docs/specs/022-drive-mirror/drive-mirror.md, "Tokens"). Server-to-server,
// form-encoded, with the client secret that never leaves this worker.

import type { Runtime } from '../types';
import { googleOAuthBase } from './config';

export type GoogleOAuthErrorKind = 'invalid_grant' | 'failed';

export class GoogleOAuthError extends Error {
  readonly kind: GoogleOAuthErrorKind;

  constructor(kind: GoogleOAuthErrorKind, detail: string) {
    super(`google oauth ${kind}: ${detail}`);
    this.name = 'GoogleOAuthError';
    this.kind = kind;
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

async function postForm(url: string, form: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
  } catch (err) {
    throw new GoogleOAuthError('failed', err instanceof Error ? err.message : 'network');
  }
}

async function tokenCall(
  env: Runtime,
  form: Record<string, string>,
): Promise<Required<Pick<TokenResponse, 'access_token' | 'expires_in'>> & TokenResponse> {
  const res = await postForm(`${googleOAuthBase(env)}/token`, {
    ...form,
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (body.error === 'invalid_grant')
      throw new GoogleOAuthError('invalid_grant', 'invalid_grant');
    throw new GoogleOAuthError('failed', `${res.status} ${body.error ?? ''}`.trim());
  }
  if (!body.access_token || typeof body.expires_in !== 'number') {
    throw new GoogleOAuthError('failed', 'malformed token response');
  }
  return { ...body, access_token: body.access_token, expires_in: body.expires_in };
}

export async function exchangeCode(
  env: Runtime,
  code: string,
  redirectUri: string,
  now: number,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number }> {
  const body = await tokenCall(env, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: now + body.expires_in * 1000,
  };
}

export async function refreshAccessToken(
  env: Runtime,
  refreshToken: string,
  now: number,
): Promise<{ accessToken: string; expiresAt: number }> {
  const body = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: refreshToken });
  return { accessToken: body.access_token, expiresAt: now + body.expires_in * 1000 };
}

// Best effort: a failed revoke is logged and reported, never thrown, because
// the caller (disconnect, account deletion) must finish deleting the rows
// whatever Google says.
export async function revokeToken(env: Runtime, token: string): Promise<boolean> {
  try {
    const res = await postForm(`${googleOAuthBase(env)}/revoke`, { token });
    if (!res.ok) console.warn('drive: revoke_failed', res.status);
    return res.ok;
  } catch (err) {
    console.warn('drive: revoke_failed', err instanceof Error ? err.message : err);
    return false;
  }
}
