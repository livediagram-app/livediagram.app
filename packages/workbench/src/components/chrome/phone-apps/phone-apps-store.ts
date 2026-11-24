'use client';

// What the top-right corner card would show, published by it on a phone instead of drawing it
// (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md): the Apps button and its drawer, in the menu card at
// the other end of the tree, read it here. A module-level store, as the call store is: one editor runs per page.
//
// Two kinds of listener. The Apps button hears only a change of what the drawer would show (`snapshotKey`: its words and
// which tiles, never a closure), so an editor's every render does not re-render it. The open drawer hears every
// publish, so its handlers and the app's own action nodes are always the newest.
import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';

export type PhoneAppsSnapshot = {
  // The open item's name; null where the app gives none (the drawer falls back to the call's title, then the noun).
  itemName: string | null;
  // Who can see it, in the Share button's words ("Shared and Team").
  shareWords: string;
  showShare: boolean;
  onOpenShare: () => void;
  onMakeCopy?: (() => void) | undefined;
  copying: boolean;
  present?: { slideCount: number; starting: boolean; onPresent: () => void } | undefined;
  onOpenAccount?: (() => void) | undefined;
  // The app draws Start a Call Here in its corner card (its `call` slot).
  hasCall: boolean;
  // An Offline item: its address opens nowhere else, so no Copy Link.
  offline: boolean;
  // The app's own actions beyond the tiles: the approval's badge, a lead action, a share action (which stands in for
  // Share). Drawn in the drawer as they are.
  approval?: ReactNode;
  leadAction?: ReactNode;
  shareAction?: ReactNode;
};

let snapshot: PhoneAppsSnapshot | null = null;
let key = '';
const shapeListeners = new Set<() => void>();
const liveListeners = new Set<() => void>();

/** The parts of a snapshot that change what the drawer shows, as one string. */
export function snapshotKey(s: PhoneAppsSnapshot | null): string {
  if (!s) return '';
  return JSON.stringify([
    s.itemName,
    s.shareWords,
    s.showShare,
    !!s.onMakeCopy,
    s.copying,
    s.present ? [s.present.slideCount, s.present.starting] : null,
    !!s.onOpenAccount,
    s.hasCall,
    s.offline,
    !!s.approval,
    !!s.leadAction,
    !!s.shareAction,
  ]);
}

/** Publishes the corner card's actions (null: no card on this page, or not a phone). */
export function publishPhoneApps(next: PhoneAppsSnapshot | null): void {
  snapshot = next;
  const nextKey = snapshotKey(next);
  const changed = nextKey !== key;
  key = nextKey;
  if (changed) for (const l of [...shapeListeners]) l();
  for (const l of [...liveListeners]) l();
}

/** Publishes `next` while `phone`, and nothing on a desktop or once the caller unmounts. */
export function usePublishPhoneApps(next: PhoneAppsSnapshot, phone: boolean): void {
  useLayoutEffect(() => {
    publishPhoneApps(phone ? next : null);
  });
  useLayoutEffect(() => () => publishPhoneApps(null), []);
}

// The shape's version: a new object only when the key changes, so useSyncExternalStore's snapshot is stable between.
let shaped: { snapshot: PhoneAppsSnapshot | null } = { snapshot: null };
let shapedKey = '';
const shapeSnapshot = () => {
  if (shapedKey !== key) {
    shapedKey = key;
    shaped = { snapshot };
  }
  return shaped;
};
let lived: { snapshot: PhoneAppsSnapshot | null } = { snapshot: null };
const liveSnapshot = () => {
  if (lived.snapshot !== snapshot) lived = { snapshot };
  return lived;
};
const serverSnapshot = { snapshot: null };

const subscribeShape = (l: () => void) => {
  shapeListeners.add(l);
  return () => {
    shapeListeners.delete(l);
  };
};
const subscribeLive = (l: () => void) => {
  liveListeners.add(l);
  return () => {
    liveListeners.delete(l);
  };
};

/** The published actions: `live` (the open drawer) follows every publish, otherwise only a change of what shows. */
export function usePhoneApps({ live = false }: { live?: boolean } = {}): PhoneAppsSnapshot | null {
  return useSyncExternalStore(
    live ? subscribeLive : subscribeShape,
    live ? liveSnapshot : shapeSnapshot,
    () => serverSnapshot,
  ).snapshot;
}
