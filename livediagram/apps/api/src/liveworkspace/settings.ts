// A person's editor preferences (docs/specs/007-editor/user-preferences.md), kept by the liveworkspace
// accounts Worker (liveworkspace/docs/specs/003-accounts/accounts.md "Settings"), not by this app. Two scopes hold them:
// `all`, the keys every app shares (ALL_SETTING_KEYS in @liveworkspace/settings: privacy,
// notifications, the editors' chrome), and this app's own, `livediagram.app`. The editor sees one
// flat set: joinSettings on the way out, splitSettings on the way in.
//
// With no accounts Worker configured (a guest-only deployment), or an owner id liveworkspace can't
// hold, there is nowhere to keep them: the preferences stay in the browser alone.

import {
  readSettings,
  writeSettings,
  type SettingsApp,
  type SettingsPatch,
} from '@liveworkspace/auth-client';
import { joinSettings, splitSettings, type SettingsBlob } from '@liveworkspace/settings';
import type { Env } from '../types';
import { liveworkspaceTarget } from './owner';

// This app's own settings scope, as @liveworkspace/sites spells it.
export const LIVEDIAGRAM_SETTINGS_APP: SettingsApp = 'livediagram.app';

// The owner's preferences as one flat set, or null when this deployment keeps none for them (see
// above). Throws when liveworkspace can't be reached.
export async function readPreferences(env: Env, ownerId: string): Promise<SettingsBlob | null> {
  const target = liveworkspaceTarget(env, ownerId);
  if (!target) return null;
  const settings = await readSettings(target.credentials, {
    owner: target.owner,
    app: LIVEDIAGRAM_SETTINGS_APP,
  });
  return joinSettings(settings.all, settings.app);
}

// Applies a patch of preferences: each key named takes its new value whole, null deletes it, and keys
// left out stay. Shared keys go to `all`, so they change in every app. False when this deployment
// keeps none for them. Throws a SettingsError when liveworkspace refuses the patch.
export async function writePreferences(
  env: Env,
  ownerId: string,
  patch: SettingsBlob,
): Promise<boolean> {
  const target = liveworkspaceTarget(env, ownerId);
  if (!target) return false;
  const { all, app } = splitSettings(patch);
  const scoped: SettingsPatch = {};
  if (Object.keys(all).length > 0) scoped.all = all;
  if (Object.keys(app).length > 0) scoped.app = app;
  if (!scoped.all && !scoped.app) return true;
  await writeSettings(target.credentials, {
    owner: target.owner,
    app: LIVEDIAGRAM_SETTINGS_APP,
    patch: scoped,
  });
  return true;
}
