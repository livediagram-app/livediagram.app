// The liveworkspace accounts Worker as this api's server sees it (liveworkspace/docs/accounts.md): where a
// person's settings, profile (display name and colour), sign-up sighting, milestones, verified address and
// activity live. livedesign keeps none of them in its own database.
//
// Every call goes with this app's OAuth client credentials, so it runs in the Worker only. Without them (a
// self-host with no sign-in) there is no accounts Worker, and each caller says what it does instead.

import type { ClientCredentials, SettingsApp } from '@liveworkspace/auth-client';
import type { Env } from '../types';

// The scope of livedesign's own settings, as @liveworkspace/sites spells it. The accounts Worker only lets
// a client registered as this app (`--app livedesign.app`) reach it.
export const ACCOUNTS_APP: SettingsApp = 'livedesign.app';

type AccountsEnv = Pick<Env, 'ACCOUNTS_URL' | 'ACCOUNTS_CLIENT_ID' | 'ACCOUNTS_CLIENT_SECRET'>;

// This app's client at the accounts Worker, or null when sign-in isn't set up.
export function accountsClient(env: AccountsEnv): ClientCredentials | null {
  const { ACCOUNTS_URL, ACCOUNTS_CLIENT_ID, ACCOUNTS_CLIENT_SECRET } = env;
  if (!ACCOUNTS_URL || !ACCOUNTS_CLIENT_ID || !ACCOUNTS_CLIENT_SECRET) return null;
  return {
    accountsUrl: ACCOUNTS_URL,
    clientId: ACCOUNTS_CLIENT_ID,
    clientSecret: ACCOUNTS_CLIENT_SECRET,
  };
}

const USER_ID = /^user_[A-Za-z0-9]{1,64}$/;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const GUEST_UUID = new RegExp(`^${UUID}$`);
const GUEST_ID = new RegExp(`^guest_${UUID}$`);
const GUEST_PREFIX = 'guest_';

// An account id, as the accounts Worker issues them.
export function isAccountOwner(ownerId: string): boolean {
  return USER_ID.test(ownerId);
}

// The owner the accounts Worker knows this one by. An account is itself. A livedesign guest is a
// server-minted UUID (POST /api/guest-id), which the accounts Worker keeps as `guest_<uuid>`, the shape of
// its own guest ids. Anything else (a malformed header) has no settings or profile there: null.
export function accountsOwner(ownerId: string): string | null {
  if (USER_ID.test(ownerId) || GUEST_ID.test(ownerId)) return ownerId;
  if (GUEST_UUID.test(ownerId)) return `${GUEST_PREFIX}${ownerId}`;
  return null;
}
