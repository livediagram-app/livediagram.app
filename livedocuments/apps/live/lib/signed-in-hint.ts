// Whether this browser is probably signed in, answered before Clerk loads
// (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before Clerk answers").
//
// clerk-js writes `__client_uat` (and a key-suffixed twin, `__client_uat_<key>`) on the app's
// origin, readable from script: `0` when signed out, the last sign-in time when signed in. No
// cookie at all is a browser Clerk has never run in, so a guest too. The answer only picks a
// default (where a new document is saved); every request still authenticates the real way.

const CLIENT_UAT = /^__client_uat(?:_[^=]*)?$/;

export function readSignedInHint(cookie: string = readCookie()): boolean {
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!CLIENT_UAT.test(name)) continue;
    const value = part.slice(eq + 1).trim();
    if (value !== '' && value !== '0') return true;
  }
  return false;
}

function readCookie(): string {
  return typeof document === 'undefined' ? '' : document.cookie;
}
