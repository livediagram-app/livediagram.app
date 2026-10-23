// A guest's preferences and profile follow them when their documents do (POST /api/migrate,
// docs/specs/014-identity/auth-and-guest-access.md): onto their new account when they sign up, or
// onto a signed guest id when a legacy one upgrades. liveworkspace keeps both
// (liveworkspace/settings.ts, liveworkspace/profiles.ts) and merges a guest it handed out itself on
// sign-in, but a livediagram guest is this app's own id, so the move is made here, the way the
// accounts Worker makes its own: what the destination already has stays, and the guest's fills the
// gaps. Then the guest's copy is cleared, since nothing reads a retired guest id.
//
// Best effort: a failure is logged and the migrate still answers, since the documents have moved.
// The guest's settings stay put to move again on the next migrate.

import { readProfiles, readSettings, writeProfile, writeSettings } from '@liveworkspace/auth-client';
import type { SettingsPrefs } from '@liveworkspace/auth-client';
import type { Env } from '../types';
import { forgetParticipant } from './profiles';
import { liveworkspaceTarget } from './owner';
import { LIVEDIAGRAM_SETTINGS_APP } from './settings';

// The keys of `from` that `into` lacks, and a patch deleting every key of `from`.
function gaps(from: SettingsPrefs, into: SettingsPrefs): { fill: SettingsPrefs; clear: SettingsPrefs } {
  const fill: SettingsPrefs = {};
  const clear: SettingsPrefs = {};
  for (const [key, value] of Object.entries(from)) {
    if (!(key in into)) fill[key] = value;
    clear[key] = null;
  }
  return { fill, clear };
}

const nonEmpty = (prefs: SettingsPrefs) => (Object.keys(prefs).length > 0 ? prefs : undefined);

export async function mergeGuestIntoOwner(env: Env, guestId: string, ownerId: string): Promise<void> {
  const guest = liveworkspaceTarget(env, guestId);
  const owner = liveworkspaceTarget(env, ownerId);
  if (!guest || !owner || guest.owner === owner.owner) return;
  const { credentials } = owner;
  const app = LIVEDIAGRAM_SETTINGS_APP;
  try {
    const [from, into, profiles] = await Promise.all([
      readSettings(credentials, { owner: guest.owner, app }),
      readSettings(credentials, { owner: owner.owner, app }),
      readProfiles(credentials, [guest.owner, owner.owner]),
    ]);
    const all = gaps(from.all, into.all);
    const own = gaps(from.app, into.app);
    const fill = { all: nonEmpty(all.fill), app: nonEmpty(own.fill) };
    if (fill.all || fill.app) {
      await writeSettings(credentials, { owner: owner.owner, app, patch: fill });
    }
    const guestProfile = profiles.find((p) => p.id === guest.owner);
    const ownerProfile = profiles.find((p) => p.id === owner.owner);
    if (guestProfile && (guestProfile.name || guestProfile.color)) {
      // An account's name comes from the account; it takes the guest's only when it has none.
      const name = !ownerProfile?.name && guestProfile.name ? guestProfile.name : undefined;
      const color = !ownerProfile?.color && guestProfile.color ? guestProfile.color : undefined;
      if (name !== undefined || color !== undefined) {
        await writeProfile(credentials, {
          owner: owner.owner,
          ...(name !== undefined ? { name } : {}),
          ...(color !== undefined ? { color } : {}),
        });
      }
      await writeProfile(credentials, { owner: guest.owner, name: null, color: null });
    }
    const clear = { all: nonEmpty(all.clear), app: nonEmpty(own.clear) };
    if (clear.all || clear.app) {
      await writeSettings(credentials, { owner: guest.owner, app, patch: clear });
    }
    forgetParticipant(guestId);
    forgetParticipant(ownerId);
    console.info('[guest-merge] merged', {
      settings: Object.keys(all.fill).length + Object.keys(own.fill).length,
      profile: Boolean(guestProfile),
    });
  } catch (err) {
    console.warn('[guest-merge] failed', String(err));
  }
}
