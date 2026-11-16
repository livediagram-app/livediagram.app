// The account avatar's initials. Pure, so every avatar surface and the tests share one answer.

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
