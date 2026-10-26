'use client';

import type { AccountSecurity, AccountSession } from '@liveworkspace/settings-ui';
import { call } from './accounts';

// Settings › Profile › Sign-in and Security on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"):
// Better Auth's own session endpoints on this origin, with the session cookie. Each is asked only when its rows are
// first shown.

const text = (value: unknown) => (typeof value === 'string' ? value : '');

async function sessions(): Promise<AccountSession[] | null> {
  const [listed, mine] = await Promise.all([call('/list-sessions'), call('/get-session')]);
  if (!listed.ok || !Array.isArray(listed.data)) return null;
  const session = mine.data.session as Record<string, unknown> | undefined;
  const currentId = text(session?.id);
  return (listed.data as Record<string, unknown>[]).map((s) => ({
    id: text(s.id),
    token: text(s.token),
    current: text(s.id) === currentId,
    userAgent: typeof s.userAgent === 'string' ? s.userAgent : null,
    createdAt: text(s.createdAt),
    updatedAt: text(s.updatedAt) || text(s.createdAt),
  }));
}

export const accountSecurity: AccountSecurity = {
  sessions,
  revokeSession: async (token) => (await call('/revoke-session', { token })).ok,
  revokeOtherSessions: async () => (await call('/revoke-other-sessions', {})).ok,
  signInMethods: async () => {
    const [accounts, options] = await Promise.all([
      call('/list-accounts'),
      call('/sign-in-options'),
    ]);
    if (!accounts.ok || !Array.isArray(accounts.data)) return null;
    const linked = (accounts.data as Record<string, unknown>[]).some(
      (a) => a.providerId === 'google' || a.provider === 'google',
    );
    return { google: linked ? 'connected' : options.data.google === true ? 'available' : 'off' };
  },
  connectGoogle: async () => {
    const result = await call('/link-social', {
      provider: 'google',
      callbackURL: `${window.location.pathname}${window.location.search}`,
    });
    const url = typeof result.data.url === 'string' ? result.data.url : null;
    if (!result.ok || !url) return false;
    window.location.assign(url);
    return true;
  },
};
