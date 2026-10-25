// A person's preferences (docs/specs/007-editor/user-preferences.md), kept by the liveworkspace accounts
// Worker in two scopes (liveworkspace/docs/accounts.md "Settings"): `all`, which every app shows, and
// `livedesign.app`, livedesign's own. Which key is which is one list, ALL_SETTING_KEYS in
// @liveworkspace/settings; the editor holds them as one flat set, which joinSettings and splitSettings turn
// into the two scopes and back.
//
// Without an accounts Worker (a deployment with no sign-in) nothing is stored here: the editor keeps its
// preferences in the browser.

import {
  readSettings,
  SettingsError,
  writeSettings,
  type SettingsPatch,
} from '@liveworkspace/auth-client';
import { joinSettings, splitSettings, type SettingsBlob } from '@liveworkspace/settings';
import type { Env } from '../types';
import { ACCOUNTS_APP, accountsClient, accountsOwner } from './client';

// A setting's name, as the accounts Worker takes them.
const SETTING_KEY = /^[A-Za-z0-9_.-]{1,64}$/;

export function isSettingKey(key: string): boolean {
  return SETTING_KEY.test(key);
}

// The owner's preferences as one flat set, or null when this deployment keeps none for them (no accounts
// Worker, or an owner id it can't vouch for). Throws when the accounts Worker can't be reached.
export async function readPreferences(env: Env, ownerId: string): Promise<SettingsBlob | null> {
  const client = accountsClient(env);
  const owner = accountsOwner(ownerId);
  if (!client || !owner) return null;
  const settings = await readSettings(client, { owner, app: ACCOUNTS_APP });
  return joinSettings(settings.all, settings.app);
}

// Applies a patch of the owner's preferences: each key named takes its new value whole, null deletes it,
// and keys left out stay. Split into the two scopes and written in one request, which the accounts Worker
// applies whole or not at all. False when this deployment keeps none for them. Throws a SettingsError when
// the accounts Worker refuses it.
export async function writePreferences(
  env: Env,
  ownerId: string,
  patch: SettingsBlob,
): Promise<boolean> {
  const client = accountsClient(env);
  const owner = accountsOwner(ownerId);
  if (!client || !owner) return false;
  const { all, app } = splitSettings(patch);
  const scoped: SettingsPatch = {};
  if (Object.keys(all).length > 0) scoped.all = all;
  if (Object.keys(app).length > 0) scoped.app = app;
  if (!scoped.all && !scoped.app) return true;
  await writeSettings(client, { owner, app: ACCOUNTS_APP, patch: scoped });
  return true;
}

export { SettingsError };

// The email notifications someone can turn off (docs/specs/014-identity/profile-and-email-notifications.md).
// Each is on unless stored `false`. `notifyDesignJoin` is livedesign's own; the rest are shared by every app.
export type NotificationPrefs = {
  notifyDesignJoin: boolean;
  notifyInviteResponse: boolean;
  notifyComments: boolean;
  notifyMilestones: boolean;
  notifyActionAssigned: boolean;
  notifyMentions: boolean;
};

const NOTIFY_KEYS = [
  'notifyDesignJoin',
  'notifyInviteResponse',
  'notifyComments',
  'notifyMilestones',
  'notifyActionAssigned',
  'notifyMentions',
] as const satisfies readonly (keyof NotificationPrefs)[];

// Read before sending an email someone else's request set off. One accounts read. A missing key, a
// deployment with no accounts Worker, or one that can't be reached right now all mean "notify": the
// switches are opt-out, and an unreadable setting must not silence an email for good.
export async function getNotificationPrefs(env: Env, ownerId: string): Promise<NotificationPrefs> {
  let prefs: SettingsBlob | null = null;
  try {
    prefs = await readPreferences(env, ownerId);
  } catch (err) {
    console.warn(
      '[preferences] notify_read_failed',
      err instanceof Error ? err.message : 'unknown',
    );
  }
  const read = {} as NotificationPrefs;
  for (const key of NOTIFY_KEYS) read[key] = prefs?.[key] !== false;
  return read;
}
