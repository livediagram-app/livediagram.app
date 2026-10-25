// How the Settings panel's Profile reaches the person's profile (liveworkspace/docs/accounts.md "Profiles"): the host
// loads it and saves a patch, over whatever door it has. liveworkspace.app's session (`/api/account/profile`), or an
// app's token through its router (`/api/workspace/account/profile`, the bearer door) on an app's address and in each
// editor. Either way the panel edits it in place; there is no address to link away to.
import type { SettingsApiResult, SettingsRequest } from '../request';
import { announceProfileSaved } from './profile-events';

/** The accounts API's profile: the display name (its own, or the account's) and the presence colour, null for each
 *  app's own pick. The person's own read adds their Google picture and Show My Google Picture
 *  (liveworkspace/docs/accounts.md "Profile pictures"); an account with no picture has `googlePicture` null. */
export interface Profile {
  id: string;
  name: string | null;
  color: string | null;
  googlePicture?: string | null;
  showPicture?: boolean;
}

/** A change: a string sets a field, null clears it (an empty name shows the sign-up name; no colour is Automatic);
 *  `showPicture` turns Show My Google Picture on or off. */
export type ProfilePatch = { name?: string | null; color?: string | null; showPicture?: boolean };

export type ProfileResult<T> =
  { ok: true; data: T } | { ok: false; status?: number; error: string };

export interface ProfileHost {
  load(): Promise<ProfileResult<Profile | null>>;
  save(patch: ProfilePatch): Promise<ProfileResult<Profile | null>>;
  // A name still waiting as the page goes, sent so it outlives the page (fetch's keepalive). Absent: dropped.
  saveOnLeave?(patch: ProfilePatch): void;
  // The name the account signed up with, shown when the display name is left empty.
  accountName: string;
  // A colour just picked, at once, and put back when its write fails (the host's own avatar).
  onColour?(colour: string | null): void;
  // What to say when a read or write is refused. Absent: the panel's own wording.
  errorMessage?(error: string): string;
}

/** A host over one of the panel's requests (`/profile` under `/api/account`): the site's `accountApi`, or an editor's
 *  `bearerSettingsRequest`. Each save is told to the page (onProfileSaved), so its presence follows. */
export function requestProfileHost(
  request: SettingsRequest,
  options: Pick<ProfileHost, 'accountName' | 'onColour' | 'errorMessage'>,
): ProfileHost {
  const profileOf = (result: SettingsApiResult<{ profile?: Profile | null }>) =>
    result.ok ? ({ ok: true, data: result.data.profile ?? null } as const) : result;
  return {
    ...options,
    load: async () => profileOf(await request<{ profile?: Profile | null }>('/profile')),
    save: async (patch) => {
      const result = profileOf(
        await request<{ profile?: Profile | null }>('/profile', 'PATCH', patch),
      );
      if (result.ok) {
        announceProfileSaved({
          patch,
          name: result.data?.name ?? null,
          color: result.data?.color ?? null,
          showPicture: result.data?.showPicture ?? true,
        });
      }
      return result;
    },
    saveOnLeave: (patch) => {
      void request('/profile', 'PATCH', patch, { keepalive: true }).catch(() => {});
    },
  };
}
