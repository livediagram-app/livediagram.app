// Screen-reader announcement store (docs/specs/004-interface-design/canvas-accessibility.md). A module-level pub/sub so
// any editor action can announce without threading a callback through
// the hook tree: `announce('Deleted a Square')` here, and the canvas's
// visually-hidden live region (CanvasLiveRegion) re-renders with the
// message. Deliberately NOT the toast stack: toasts are visual,
// auto-dismissing, and gated behind the "Show notifications"
// preference; announcements must reach assistive tech unconditionally.

import { createListeners } from './listeners';

type Snapshot = {
  message: string;
  // Bumped per announce so repeating the same message still re-renders
  // (the live region appends an invisible suffix that alternates, which
  // makes screen readers re-announce identical consecutive strings).
  nonce: number;
};

let snapshot: Snapshot = { message: '', nonce: 0 };
const listeners = createListeners();

export function announce(message: string): void {
  snapshot = { message, nonce: snapshot.nonce + 1 };
  listeners.notify();
}

export const subscribeAnnouncements = listeners.subscribe;

export function getAnnouncementSnapshot(): Snapshot {
  return snapshot;
}

// Server snapshot for useSyncExternalStore during static export.
const EMPTY: Snapshot = { message: '', nonce: 0 };
export function getServerAnnouncementSnapshot(): Snapshot {
  return EMPTY;
}
