// The one short-lived cookie a sign-in rides between an app's api and its callback: the PKCE verifier, the `state`
// to match and the path to come back to (liveworkspace/docs/specs/003-accounts/sign-in.md "How signing in works").
// It needs no signature: only this browser can present it, and `state` must match what came back.
//
// Base64url over the JSON's UTF-8 bytes. `btoa` on the JSON alone throws on any character past Latin-1, so a return
// path holding one (`/plan/☕東京`) failed the sign-in with a 500. A cookie written that old way (Latin-1 bytes, from
// before this encoder) still reads, so someone mid-sign-in across a deploy isn't sent back to the start. Either way
// the return path that comes out is normalised (`normalisedReturnPath`): percent-encoded ASCII, as a browser sends
// it, so it fits the `Location` header it goes back on. One that isn't a path on this site reads as no cookie.

import { sameOriginPath } from './return-path';

export type PkceCookie = { state: string; verifier: string; returnTo: string };

/** The cookie's value: base64url (no padding) over the UTF-8 JSON. */
export function encodePkceCookie(value: PkceCookie): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

// The JSON's text: UTF-8 as encodePkceCookie writes it, or, when the bytes aren't valid UTF-8, the old encoder's
// Latin-1 (each byte one character, which is what `atob` already answered).
function textOf(binary: string): string {
  try {
    return strictUtf8.decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
  } catch {
    return binary;
  }
}

/** The cookie read back, or null when it is missing, malformed, or its return path is not on this site. */
export function decodePkceCookie(raw: string | null | undefined): PkceCookie | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(textOf(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { state, verifier, returnTo } = parsed as Record<string, unknown>;
  if (typeof state !== 'string' || typeof verifier !== 'string' || typeof returnTo !== 'string') {
    return null;
  }
  const path = sameOriginPath(returnTo);
  return path === null ? null : { state, verifier, returnTo: path };
}
