// The signed-in person's own Google picture (liveworkspace/docs/accounts.md "Profile pictures",
// docs/specs/014-identity/profile-and-email-notifications.md "Avatars"): read from the session's ID token
// (`picture`, `picture_hidden`, by way of POST /api/auth/token), and Show My Google Picture as Settings › Profile
// last saved it. The person's own chrome always shows their picture; what goes to the room (`publishedPicture`)
// is it only while the switch is on. Module state, so the AccountsBridge that reads the session and the editor
// that says hello share one answer without a provider.

import { useSyncExternalStore } from 'react';
import { profilePictureOf } from '@liveworkspace/sites/picture';

export type OwnPicture = {
  // Their Google picture, or null (a guest, an email-code account, signed out).
  picture: string | null;
  // Show My Google Picture.
  shown: boolean;
};

const NONE: OwnPicture = { picture: null, shown: true };
let current: OwnPicture = NONE;
const listeners = new Set<() => void>();

function publish(next: OwnPicture): void {
  if (next.picture === current.picture && next.shown === current.shown) return;
  current = next;
  for (const listener of listeners) listener();
}

/** The session's picture, as the ID token said (null when signed out); anything not a Google picture is none. */
export function setOwnPicture(picture: unknown, hidden: boolean): void {
  publish({ picture: profilePictureOf(picture), shown: !hidden });
}

/** Show My Google Picture, just saved in Settings › Profile. */
export function setOwnPictureShown(shown: boolean): void {
  publish({ ...current, shown });
}

export function ownPicture(): OwnPicture {
  return current;
}

/** What other people may see: the picture while the switch is on, else null. */
export function publishedPicture(own: OwnPicture): string | null {
  return own.shown ? own.picture : null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverSnapshot = () => NONE;

export function useOwnPicture(): OwnPicture {
  return useSyncExternalStore(subscribe, ownPicture, serverSnapshot);
}

/** Test seam: back to signed out. */
export function resetOwnPicture(): void {
  publish(NONE);
}
