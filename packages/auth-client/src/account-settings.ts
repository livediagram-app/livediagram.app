// Someone's settings and profiles over the account API (liveworkspace/docs/specs/003-accounts/accounts.md
// "Settings"), with the app's client credentials: reads and writes, run in the app's Worker only. account.ts
// re-exports them.

import type { SiteId } from '@liveworkspace/sites';
import { type ClientCredentials } from './oauth';
import { call } from './account-call';

// --- Settings ---

// An app's site id, as @liveworkspace/sites spells it: the scope of that app's own settings.
export type SettingsApp = Exclude<SiteId, 'liveworkspace.app'>;
export type SettingsPrefs = Record<string, unknown>;

// Someone's settings as one app sees them: those every app shows, and the app's own.
export interface AccountSettings {
  all: SettingsPrefs;
  app: SettingsPrefs;
  // The later of the two scopes' last writes; null when neither has been written.
  updatedAt: number | null;
}

// Each key set to its new value, replacing it whole, or to null to delete it. Keys left out stay.
export interface SettingsPatch {
  all?: SettingsPrefs;
  app?: SettingsPrefs;
}

// Why a settings write was refused, from the account API's error code.
export class SettingsError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`settings write refused: ${status} ${code}`);
    this.name = 'SettingsError';
    this.status = status;
    this.code = code;
  }
}

// `owner` is an id the app has already verified: an access token's sub, or a guest token's.
export async function readSettings(
  credentials: ClientCredentials,
  request: { owner: string; app: SettingsApp },
  fetcher: typeof fetch = fetch,
): Promise<AccountSettings> {
  const response = await call(
    credentials,
    '/settings/read',
    { method: 'POST', body: request },
    fetcher,
  );
  if (!response.ok) throw new Error(`settings read failed: ${response.status}`);
  return (await response.json()) as AccountSettings;
}

// Applies the patch and answers the settings as they now are. A refusal (a patch that isn't an
// object of named keys, or a scope past its 16 KB) throws a SettingsError with the code.
export async function writeSettings(
  credentials: ClientCredentials,
  request: { owner: string; app: SettingsApp; patch: SettingsPatch },
  fetcher: typeof fetch = fetch,
): Promise<AccountSettings> {
  const response = await call(
    credentials,
    '/settings/write',
    { method: 'POST', body: request },
    fetcher,
  );
  if (response.status === 400 || response.status === 413) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SettingsError(response.status, error ?? 'invalid_request');
  }
  if (!response.ok) throw new Error(`settings write failed: ${response.status}`);
  return (await response.json()) as AccountSettings;
}

// --- Profiles ---

// A person's display name and presence colour, the same in every app. An account shows its account
// name until it sets a display name; `name` and `color` may be null (no name, or the app's own pick of
// colour), and the times are null for an account that never set either.
export interface Profile {
  id: string;
  name: string | null;
  color: string | null;
  // The person's published Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): null with none or
  // with their Show My Google Picture switch off. An app passes it on only to signed-in viewers. Absent from an
  // accounts Worker older than pictures.
  picture?: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

// A string sets the field, null clears it, and a field left out stays.
export interface ProfilePatch {
  name?: string | null;
  color?: string | null;
}

// The most ids the account API takes in one read; readProfiles splits a longer list.
export const MAX_PROFILE_IDS = 100;

// Why a profile write was refused, from the account API's error code: `invalid_name`,
// `invalid_color`, `nothing_to_change` or `invalid_owner` (400), or `unknown_owner` (404).
export class ProfileError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`profile write refused: ${status} ${code}`);
    this.name = 'ProfileError';
    this.status = status;
    this.code = code;
  }
}

// The profiles of these owners (account or guest ids the app has seen), for a presence list or a
// page of comments. Repeated ids are asked once, and a list over MAX_PROFILE_IDS goes in batches of
// that many, at once. An id with neither a profile nor an account is left out of the answer.
export async function readProfiles(
  credentials: ClientCredentials,
  ids: string[],
  fetcher: typeof fetch = fetch,
): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let at = 0; at < unique.length; at += MAX_PROFILE_IDS) {
    batches.push(unique.slice(at, at + MAX_PROFILE_IDS));
  }
  const pages = await Promise.all(
    batches.map(async (batch) => {
      const response = await call(
        credentials,
        '/profiles/read',
        { method: 'POST', body: { ids: batch } },
        fetcher,
      );
      if (!response.ok) throw new Error(`profiles read failed: ${response.status}`);
      return ((await response.json()) as { profiles: Profile[] }).profiles;
    }),
  );
  return pages.flat();
}

// Sets someone's own name or colour. `owner` is an id the app has already verified as the person
// asking (an access token's sub, or a guest token's). Answers the profile as it now is.
export async function writeProfile(
  credentials: ClientCredentials,
  request: { owner: string } & ProfilePatch,
  fetcher: typeof fetch = fetch,
): Promise<Profile> {
  const response = await call(
    credentials,
    '/profiles/write',
    { method: 'POST', body: request },
    fetcher,
  );
  if (response.status === 400 || response.status === 404) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ProfileError(response.status, error ?? 'invalid_request');
  }
  if (!response.ok) throw new Error(`profile write failed: ${response.status}`);
  return ((await response.json()) as { profile: Profile }).profile;
}
