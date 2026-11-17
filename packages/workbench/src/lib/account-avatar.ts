// The account avatar's initials and fill. Pure, so every avatar surface and the tests share one answer.

import { avatarFill } from '@liveworkspace/account-menu/initials';
import { initialsOf } from '@liveworkspace/model-core/names';

type AccountNames = {
  firstName: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username: string | null;
  email?: string | null;
};

/** The letters on the initials avatar, the same two liveworkspace.app's account menu shows for the account: the
 *  first and last names' first letters (givenName and familyName where the account has them), else the full name's,
 *  else a single name's first two, by the shared rule (model-core initialsOf); a name with no letters falls back to
 *  the email's; '?' with none. */
export function accountInitials(user: AccountNames | null): string {
  if (!user) return '?';
  const name =
    [user.firstName, user.lastName].filter((part) => part?.trim()).join(' ') ||
    user.fullName ||
    user.username ||
    '';
  return initialsOf(name, user.email);
}

/** A profile just saved in Settings › Profile on this page: the name collaborators see and the colour, null for
 *  Automatic (@liveworkspace/settings-ui/profile-events). */
export type SavedLook = { name: string | null; colour: string | null };

/** The disc's fill under the white initials (liveworkspace/docs/specs/003-accounts/accounts.md "Profiles"), as
 *  liveworkspace.app's account menu paints it (@liveworkspace/account-menu avatarFill): the account's presence colour
 *  (the session's `colour`, from the ID token's `presence_color`) in its deep shade, or for Automatic the colour
 *  picked from the full name by the one rule the cursors and author dots use too. A profile saved on this page since
 *  wins, so a new pick shows at once rather than at the next token refresh. */
export function accountAvatarFill(
  user: (AccountNames & { colour?: string | null }) | null,
  saved: SavedLook | null = null,
): string {
  const name =
    saved?.name || user?.fullName || user?.firstName || user?.username || user?.email || '';
  return avatarFill(name, saved ? saved.colour : (user?.colour ?? null));
}
