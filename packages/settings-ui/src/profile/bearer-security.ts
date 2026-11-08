import type { SettingsRequest } from '../request';
import type { AccountSecurity, AccountSession, AccountSignInMethods } from './SecurityRows';

// Settings › Profile › Sign-in Methods and Where You're Signed In over the accounts API's bearer door
// (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"): what an editor and an app's Explorer reach through
// the app's router (`/api/workspace/account`) with the person's token, as liveworkspace.app reaches Better Auth's own
// endpoints with its session (its own AccountSecurity). A session is revoked by its id here, never its token.

type WireSession = {
  id?: unknown;
  current?: unknown;
  userAgent?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

// A time as ISO text, whether the door answers ISO text or epoch milliseconds.
const iso = (value: unknown): string =>
  typeof value === 'number'
    ? new Date(value).toISOString()
    : typeof value === 'string'
      ? value
      : '';

const toSession = (s: WireSession): AccountSession => {
  const id = typeof s.id === 'string' ? s.id : '';
  const createdAt = iso(s.createdAt);
  return {
    id,
    token: id,
    current: s.current === true,
    userAgent: typeof s.userAgent === 'string' ? s.userAgent : null,
    createdAt,
    updatedAt: iso(s.updatedAt) || createdAt,
  };
};

const GOOGLE_STATES: readonly AccountSignInMethods['google'][] = ['connected', 'available', 'off'];

/** Where Google sends the person back, in full (the door refuses a relative one): this page, with Settings open on
 *  `settingsParam` (Account > Profile). A refused link comes back with `?error=<code>`, which the row then says. */
export function signInReturnUrl(href: string, settingsParam: string): string {
  const url = new URL(href);
  url.searchParams.delete('section');
  url.searchParams.delete('error');
  url.searchParams.set('settings', settingsParam);
  return url.toString();
}

/** Sign-in and devices over `request` (the bearer door). `settingsParam`: what `?settings=` names to reopen this
 *  page's Settings on the Profile once Google has answered (`account:account` in an editor). */
export function bearerAccountSecurity(
  request: SettingsRequest,
  { settingsParam }: { settingsParam: string },
): AccountSecurity {
  const sessions = async (): Promise<AccountSession[] | null> => {
    const result = await request<{ sessions?: WireSession[] }>('/sessions');
    if (!result.ok || !Array.isArray(result.data.sessions)) return null;
    return result.data.sessions.map(toSession);
  };
  const revokeSession = async (id: string) =>
    (await request(`/sessions/${encodeURIComponent(id)}`, 'DELETE')).ok;
  return {
    sessions,
    revokeSession,
    revokeOtherSessions: async () => (await request('/sessions/revoke-others', 'POST', {})).ok,
    signInMethods: async () => {
      const result = await request<{ google?: unknown }>('/sign-in-methods');
      if (!result.ok) return null;
      const google = GOOGLE_STATES.find((state) => state === result.data.google);
      return google ? { google } : null;
    },
    connectGoogle: async () => {
      const result = await request<{ url?: unknown }>('/sign-in-methods/google', 'POST', {
        callbackURL: signInReturnUrl(window.location.href, settingsParam),
      });
      const url = result.ok && typeof result.data.url === 'string' ? result.data.url : null;
      if (!url) return false;
      window.location.assign(url);
      return true;
    },
  };
}
