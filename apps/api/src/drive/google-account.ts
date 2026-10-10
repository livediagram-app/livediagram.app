// Which Google account a fresh consent belongs to (docs/specs/022-drive-mirror/drive-mirror.md, "Tokens"):
// Drive's `about.user.permissionId`, the stable id of the account the access token acts for. The
// consent asks only for drive.file and drive.install, so there is no id token to read a `sub` from;
// `about` answers under drive.file. One call per consent, never per sync.

import { GoogleOAuthError } from './google-oauth';
import { googleApiBase } from './config';
import type { Env } from '../types';

export async function fetchGoogleAccountId(env: Env, accessToken: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${googleApiBase(env)}/drive/v3/about?fields=user(permissionId)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    throw new GoogleOAuthError('failed', err instanceof Error ? err.message : 'network');
  }
  const body = (await res.json().catch(() => ({}))) as { user?: { permissionId?: unknown } };
  const id = body.user?.permissionId;
  if (!res.ok || typeof id !== 'string' || !id) {
    throw new GoogleOAuthError('failed', `about ${res.status}`);
  }
  return id;
}
