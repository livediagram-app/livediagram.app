// Whether this browser is probably signed in, answered before the first token request does
// (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before sign-in answers"), from
// the readable hint the api sets beside the session's refresh cookie. It only picks a default (where
// a new document is saved, whether to ask for the session at all); every request still
// authenticates the real way.

import { signedInHintOf } from '@liveknowledge/api-schema';
import { e2eAuthEnabled } from '@liveworkspace/workbench/lib/auth-config';
import { readLocalStorageSafe } from '@liveworkspace/workbench/lib/local-storage-safe';
import { E2E_SESSION_KEY } from '@/lib/workbench-keys';

export function readSignedInHint(cookie: string = readCookie()): boolean {
  return signedInHintOf(cookie) === true;
}

function readCookie(): string {
  return typeof document === 'undefined' ? '' : document.cookie;
}

// Whether a create should wait for the session's answer before choosing where the new knowledgebase is saved
// (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase": a signed-in person's is saved to
// their account). The hint, or, in a test build only (e2eAuthEnabled, a compile-time constant a real bundle drops),
// the session the signed-in specs and a locally driven stack keep in localStorage: that session sets no hint
// cookie, so /new read a signed-in person as a guest and made their knowledgebase Offline.
export function looksSignedIn(): boolean {
  return readSignedInHint() || (e2eAuthEnabled && !!readLocalStorageSafe(E2E_SESSION_KEY));
}
