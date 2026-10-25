// The start screen's "Sync <Kind> to Server" switch (each product's docs/specs/006-*/save-locations.md "On the start
// screen"): its words and when it shows, the same in every app. The app hands in its kind's word and what it knows
// about the open item; nothing here knows a product.

export type SaveSwitchMove = 'server' | 'browser';

export type SaveSwitchCopy = {
  label: string;
  helper: string;
};

/** The row's label and the one line under it, for where the item is and who is looking. */
export function saveSwitchCopy(at: {
  // "Canvas", "Plan", "Document", "Design".
  kind: string;
  onServer: boolean;
  signedIn: boolean;
  // A move is running, toward this side.
  moving?: SaveSwitchMove | null;
}): SaveSwitchCopy {
  const label = `Sync ${at.kind} to Server`;
  if (at.moving === 'server') return { label, helper: 'Syncing to the server…' };
  if (at.moving === 'browser') return { label, helper: 'Moving to this browser…' };
  if (at.onServer)
    return {
      label,
      // A guest's server copy is theirs through this browser's guest pass, so it is not on every device yet.
      helper: at.signedIn
        ? 'Saved to your account, on every device.'
        : 'Saved on liveworkspace servers. Sign in to open it on any device.',
    };
  return {
    label,
    helper: at.signedIn
      ? 'Saved in this browser only. Turn on to open it anywhere and share it.'
      : 'Saved in this browser only. Turn on to save it to our servers and share it.',
  };
}

/** What a screen reader hears when a move starts and when it lands (the row's polite status). */
export function saveSwitchAnnouncement(move: SaveSwitchMove, done: boolean): string {
  if (move === 'server') return done ? 'Synced to the server.' : 'Syncing to the server…';
  return done ? 'Moved to this browser.' : 'Moving to this browser…';
}

/**
 * Whether the switch shows on an open item's start screen. Moving an item is only safe and cheap while it is fresh
 * and the viewer's alone: their own, editable, one tab with nothing on it, never shared, in a team or with anyone
 * else in it, and on the full editor (not an embed, a read-only view or another app's workbench). Elsewhere the row
 * is hidden and the Explorer's Sync and Take Offline stay the way to move it.
 */
export function showsSaveSwitch(item: {
  // The item has loaded and the reader and whether they are signed in are known.
  ready: boolean;
  isOwner: boolean;
  canEdit: boolean;
  embedded: boolean;
  tabCount: number;
  // The one tab has nothing on it.
  empty: boolean;
  // A live share link, a share-link session, or a team library.
  shared: boolean;
  // Someone else is in the item now.
  othersPresent: boolean;
}): boolean {
  return (
    item.ready &&
    item.isOwner &&
    item.canEdit &&
    !item.embedded &&
    item.tabCount === 1 &&
    item.empty &&
    !item.shared &&
    !item.othersPresent
  );
}
