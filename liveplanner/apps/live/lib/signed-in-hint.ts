// Whether this browser is probably signed in, answered before the first token request does
// (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before sign-in answers"), from
// the readable hint the api sets beside the session's refresh cookie. It only picks a default (where
// a new document is saved, whether to ask for the session at all); every request still
// authenticates the real way.

import { signedInHintOf } from '@liveplanner/api-schema';

export function readSignedInHint(cookie: string = readCookie()): boolean {
  return signedInHintOf(cookie) === true;
}

function readCookie(): string {
  return typeof document === 'undefined' ? '' : document.cookie;
}
