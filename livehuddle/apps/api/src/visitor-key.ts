// A link visitor's collab key, per browser (docs/specs/013-workspace/share-roles.md "The collab key";
// docs/specs/012-collaboration/tab-attendance.md "One person, one visit"; Work Tracker 730). A session with no identity
// used to get a random key per socket, so every reconnect was a new visitor (and a new Attendance row). Its first hello
// now carries the browser's own secret, and the room derives the key from it, one-way: the same browser is the same
// visitor, and nobody without the secret can act under its key. Synchronous (the plain-code SHA-256), because the room
// handles a hello inside one frame.

import { COLLAB_KEY_LENGTH } from '@liveworkspace/api-schema/collab-key';
import { sha256Fallback } from '@livehuddle/document';

const SECRET_MIN = 16;
const SECRET_MAX = 64;

/** Whether a hello's `visitor` is a visitor secret's shape: 16 to 64 letters, digits or hyphens (a UUID is one). */
export function isVisitorSecret(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < SECRET_MIN || value.length > SECRET_MAX)
    return false;
  for (const c of value) {
    const digit = c >= '0' && c <= '9';
    const letter = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    if (!digit && !letter && c !== '-') return false;
  }
  return true;
}

/** The collab key of the browser holding `secret`: the first 32 hex characters of SHA-256 of a versioned label. */
export function visitorCollabKey(secret: string): string {
  const digest = sha256Fallback(new TextEncoder().encode(`livehuddle:collab:visitor:v1:${secret}`));
  let hex = '';
  for (const b of digest) hex += (b < 16 ? '0' : '') + b.toString(16);
  return hex.slice(0, COLLAB_KEY_LENGTH);
}
