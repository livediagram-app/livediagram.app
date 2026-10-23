// A guest's settings and profile follow them when their designs do (POST /api/migrate,
// docs/specs/014-identity/auth-and-guest-access.md "Guest → account migration"): onto the account they
// signed in to, or onto the signed guest id a legacy one upgrades to. Both live with the liveworkspace
// accounts Worker, so this is done through it rather than in livedesign's database.
//
// The same rule as the accounts Worker's own merge when a liveworkspace guest signs in
// (liveworkspace/docs/accounts.md "Closing an account, and a guest signing in"): what the target already
// has stays, and the guest's fills the gaps. A setting the target has keeps its value; the target keeps its
// own colour and name and takes the guest's colour when it has none, and the guest's name only when it has
// no name at all. Then the guest's are cleared, so a name the guest typed isn't left under an id nobody
// holds.
//
// Idempotent: run again, the guest has nothing left to give.

import {
  readProfiles,
  readSettings,
  writeProfile,
  writeSettings,
  type SettingsPatch,
  type SettingsPrefs,
} from '@liveworkspace/auth-client';
import type { Env } from '../types';
import { ACCOUNTS_APP, accountsClient, accountsOwner } from './client';
import { forgetProfiles } from './profiles';

// The guest's keys the target doesn't have.
function gaps(from: SettingsPrefs, to: SettingsPrefs): SettingsPrefs {
  const filled: SettingsPrefs = {};
  for (const [key, value] of Object.entries(from)) if (!(key in to)) filled[key] = value;
  return filled;
}

// Every one of these keys, deleted.
function cleared(prefs: SettingsPrefs): SettingsPrefs {
  return Object.fromEntries(Object.keys(prefs).map((key) => [key, null]));
}

function nonEmpty(patch: SettingsPatch): boolean {
  return Object.keys(patch.all ?? {}).length > 0 || Object.keys(patch.app ?? {}).length > 0;
}

// Moves the guest's settings and profile onto `toOwnerId`. Throws when the accounts Worker can't be
// reached or refuses (the caller logs it: the guest's stay where they are for the next sign-in).
export async function moveGuestAccountState(
  env: Env,
  fromOwnerId: string,
  toOwnerId: string,
): Promise<{ settings: number; profile: boolean }> {
  const client = accountsClient(env);
  const from = accountsOwner(fromOwnerId);
  const to = accountsOwner(toOwnerId);
  if (!client || !from || !to || from === to) return { settings: 0, profile: false };

  const [guest, target, profiles] = await Promise.all([
    readSettings(client, { owner: from, app: ACCOUNTS_APP }),
    readSettings(client, { owner: to, app: ACCOUNTS_APP }),
    readProfiles(client, [from, to]),
  ]);

  const fill: SettingsPatch = {
    all: gaps(guest.all, target.all),
    app: gaps(guest.app, target.app),
  };
  if (nonEmpty(fill)) await writeSettings(client, { owner: to, app: ACCOUNTS_APP, patch: fill });
  const drop: SettingsPatch = { all: cleared(guest.all), app: cleared(guest.app) };
  if (nonEmpty(drop)) await writeSettings(client, { owner: from, app: ACCOUNTS_APP, patch: drop });

  const guestProfile = profiles.find((p) => p.id === from);
  const targetProfile = profiles.find((p) => p.id === to);
  let profile = false;
  if (guestProfile && (guestProfile.name || guestProfile.color)) {
    const take: { color?: string; name?: string } = {};
    if (!targetProfile?.color && guestProfile.color) take.color = guestProfile.color;
    if (!targetProfile?.name && guestProfile.name) take.name = guestProfile.name;
    if (take.color !== undefined || take.name !== undefined) {
      await writeProfile(client, { owner: to, ...take });
      profile = true;
    }
    await writeProfile(client, { owner: from, name: null, color: null });
  }
  forgetProfiles([fromOwnerId, toOwnerId]);
  return {
    settings: Object.keys(fill.all ?? {}).length + Object.keys(fill.app ?? {}).length,
    profile,
  };
}
