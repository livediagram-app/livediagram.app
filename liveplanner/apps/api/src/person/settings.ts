// A person's settings (docs/specs/007-editor/user-preferences.md), kept by the liveworkspace accounts
// Worker in two scopes (liveworkspace/docs/accounts.md "Settings"): `all`, which every app shows, and
// liveplanner.app's own. Which key goes where is one list, ALL_SETTING_KEYS in
// @liveworkspace/settings. The editor still sees one flat set of preferences: a read joins the
// scopes, a write splits them. liveplanner keeps no copy.
//
// Without the accounts Worker (a deployment with sign-in off) nothing is stored server-side, and the
// editor keeps its preferences in the browser. A guest who signs in has their settings moved to the
// account by the accounts Worker itself.

import {
  readSettings,
  writeSettings,
  type ClientCredentials,
  type SettingsPrefs,
} from '@liveworkspace/auth-client';
import { joinSettings, splitSettings } from '@liveworkspace/settings';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';
import { accountsOwnerOf } from './owner';

// This app's scope at the accounts Worker.
export const SETTINGS_APP = 'liveplanner.app';

type Stored = { credentials: ClientCredentials; owner: string };

// Where this owner's settings are kept, or null when they can't be (no accounts Worker, or an id it
// has no place for).
export function settingsStoredFor(env: Env, ownerId: string): Stored | null {
  const credentials = accountCredentials(env);
  const owner = accountsOwnerOf(ownerId);
  return credentials && owner ? { credentials, owner } : null;
}

// The owner's preferences as one flat set, `all` and this app's joined. Null when they can't be
// stored for this owner; throws when the accounts Worker can't be reached.
export async function readPreferences(env: Env, ownerId: string): Promise<SettingsPrefs | null> {
  const stored = settingsStoredFor(env, ownerId);
  if (!stored) return null;
  const settings = await readSettings(stored.credentials, {
    owner: stored.owner,
    app: SETTINGS_APP,
  });
  return joinSettings(settings.all, settings.app);
}

// Applies a patch of preferences: each key named takes its value whole (an object replaces the one
// stored rather than merging into it), a key set to null is deleted, and keys not named stay as they
// are, so another app's change to a shared key is never undone by this one. Answers the preferences
// as they now are, or null when they can't be stored for this owner. A refusal (a scope past its
// 16 KB) throws the accounts Worker's SettingsError.
export async function writePreferences(
  env: Env,
  ownerId: string,
  patch: SettingsPrefs,
): Promise<SettingsPrefs | null> {
  const stored = settingsStoredFor(env, ownerId);
  if (!stored) return null;
  const { all, app } = splitSettings(patch);
  const settings = await writeSettings(stored.credentials, {
    owner: stored.owner,
    app: SETTINGS_APP,
    patch: {
      ...(Object.keys(all).length > 0 ? { all } : {}),
      ...(Object.keys(app).length > 0 ? { app } : {}),
    },
  });
  return joinSettings(settings.all, settings.app);
}

// The email-notification switches (docs/specs/014-identity/profile-and-email-notifications.md), read
// on someone else's request before an email goes to the owner. Each is on unless stored `false`.
// `notifyComments` is shared by every app; `notifyFormResponses` is liveplanner's own.
export type NotificationPrefs = {
  notifyComments: boolean;
  notifyFormResponses: boolean;
};

const NOTIFY_KEYS: (keyof NotificationPrefs)[] = ['notifyComments', 'notifyFormResponses'];

// One read of the owner's settings. Missing settings, an owner with none, and a read that fails all
// answer "notify": the switches are opt-out.
export async function getNotificationPrefs(env: Env, ownerId: string): Promise<NotificationPrefs> {
  let prefs: SettingsPrefs = {};
  try {
    prefs = (await readPreferences(env, ownerId)) ?? {};
  } catch (error) {
    console.warn('[settings] notification_prefs_read_failed', { error: String(error) });
  }
  return Object.fromEntries(
    NOTIFY_KEYS.map((key) => [key, prefs[key] !== false]),
  ) as NotificationPrefs;
}
