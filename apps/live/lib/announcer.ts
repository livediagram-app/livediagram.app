// Screen-reader announcement store (spec/71). A module-level pub/sub so
// any editor action can announce without threading a callback through
// the hook tree: `announce('Deleted a Square')` here, and the canvas's
// visually-hidden live region (CanvasLiveRegion) re-renders with the
// message. Deliberately NOT the toast stack: toasts are visual,
// auto-dismissing, and gated behind the "Show notifications"
// preference; announcements must reach assistive tech unconditionally.

type Snapshot = {
  message: string;
  // Bumped per announce so repeating the same message still re-renders
  // (the live region appends an invisible suffix that alternates, which
  // makes screen readers re-announce identical consecutive strings).
  nonce: number;
};

let snapshot: Snapshot = { message: '', nonce: 0 };
const listeners = new Set<() => void>();

export function announce(message: string): void {
  snapshot = { message, nonce: snapshot.nonce + 1 };
  for (const l of listeners) l();
}

export function subscribeAnnouncements(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAnnouncementSnapshot(): Snapshot {
  return snapshot;
}

// Server snapshot for useSyncExternalStore during static export.
const EMPTY: Snapshot = { message: '', nonce: 0 };
export function getServerAnnouncementSnapshot(): Snapshot {
  return EMPTY;
}
