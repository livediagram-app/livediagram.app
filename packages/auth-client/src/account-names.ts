// The names an app shows for the signed-in account (liveworkspace/docs/specs/003-accounts/accounts.md "An app's
// signed-in cookies"), one rule for every editor's session bridge: the first and last name the accounts site asked
// for (the ID token's `given_name` and `family_name`, which the app's `/api/auth/token` answers as `givenName` and
// `familyName`), else the whole name split at its first space, else the email's local part. An account made by
// signing in with a code has no name until one is set at the accounts site. The avatar's two initials read the
// first and last names from here, so they match liveworkspace.app's for the same account.

export type AccountNamesSource = {
  givenName?: string | null;
  familyName?: string | null;
  name?: string | null;
  email?: string | null;
};

export type AccountNames = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
};

export function namesOf(user: AccountNamesSource): AccountNames {
  const given = user.givenName?.trim() || null;
  const family = user.familyName?.trim() || null;
  if (given || family) {
    return {
      firstName: given ?? family,
      lastName: given ? family : null,
      fullName: [given, family].filter(Boolean).join(' '),
    };
  }
  const name = user.name?.trim();
  if (name) {
    const space = name.indexOf(' ');
    return {
      firstName: space > 0 ? name.slice(0, space) : name,
      lastName: space > 0 ? name.slice(space + 1).trim() || null : null,
      fullName: name,
    };
  }
  const local = user.email?.split('@')[0]?.trim() || null;
  return { firstName: local, lastName: null, fullName: local };
}
