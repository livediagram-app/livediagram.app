'use client';

// The signed-in person's own Google picture (docs/specs/014-identity/profile-picture.md §1): set by AccountsBridge
// from the session (the ID token's `picture` and `picture_hidden`), moved by a Settings › Profile save
// (`showPicture`) with no reload, and cleared on sign-out. One small store for the page, read with
// useSyncExternalStore, so nothing re-renders unless it changes.
//
// `picture` is what your own chrome shows you, whatever the switch says; `published` is what the room may show
// everyone else: the picture while Show My Google Picture is on, else null.

import { useSyncExternalStore } from 'react';
import { profilePictureOf } from '@liveworkspace/sites/picture';

export type OwnPicture = { picture: string | null; hidden: boolean };

const NONE: OwnPicture = { picture: null, hidden: false };
let current: OwnPicture = NONE;
const listeners = new Set<() => void>();

/** Set the person's own picture (null for none: a guest, an email-code account, signed out). */
export function setOwnPicture(next: { picture?: unknown; hidden?: boolean } | null): void {
  const picture = profilePictureOf(next?.picture);
  const hidden = next?.hidden === true;
  if (picture === current.picture && hidden === current.hidden) return;
  current = picture ? { picture, hidden } : NONE;
  for (const listener of listeners) listener();
}

/** Show My Google Picture moved (a Settings › Profile save): the picture stays, who sees it changes. */
export function setOwnPictureShown(shown: boolean): void {
  if (!current.picture || current.hidden === !shown) return;
  current = { ...current, hidden: !shown };
  for (const listener of listeners) listener();
}

export function ownPicture(): OwnPicture {
  return current;
}

/** What the room may show everyone else: the picture while the switch is on. */
export function publishedPicture(own: OwnPicture): string | null {
  return own.hidden ? null : own.picture;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getServerSnapshot = () => NONE;

export function useOwnPicture(): OwnPicture {
  return useSyncExternalStore(subscribe, ownPicture, getServerSnapshot);
}

/** Tests only: forget the picture. */
export function resetOwnPictureForTests(): void {
  current = NONE;
  listeners.clear();
}
