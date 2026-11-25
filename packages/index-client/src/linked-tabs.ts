// Connect as tabs (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to", Work Tracker 1429):
// after a Send to, the source file and the destination file each get a connected tab that opens the other. A linked
// connection makes no pass, so it widens nothing: each reader opens the other file with their own access. These are
// the shapes the pickers, the index and liveplanner's agents share.

// The item ids the index takes (its codec's `isId`).
const ITEM_ID = /^[A-Za-z0-9_-]{1,200}$/;

// How one file stands towards the other: it already holds a tab for it, the person may add one (Editor on the whole
// file), or the person may not change its tabs.
export type LinkedTabSide = 'connected' | 'can' | 'cannot';

// `GET /items/:source/linked-tabs?with=<target>`: each side, as the person stands now.
export type LinkedTabsRead = { source: LinkedTabSide; target: LinkedTabSide };

// What linking did to one file: a tab made, one there already, none because the person may not change its tabs, none
// because it holds as many connected tabs as it may, or none because its app could not be reached.
export type LinkedTabOutcome = 'made' | 'connected' | 'cannot' | 'full' | 'unreached';

// `POST /items/:source/linked-tabs` `{ targetId }`: each side's outcome.
export type LinkedTabsMade = { source: LinkedTabOutcome; target: LinkedTabOutcome };

export type LinkedTabsInput = { targetId: string };

export function readLinkedTabsInput(value: unknown): LinkedTabsInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { targetId } = value as Record<string, unknown>;
  return typeof targetId === 'string' && ITEM_ID.test(targetId) ? { targetId } : null;
}

// Whether a side ends with a tab for the other file.
export const linkedTabHeld = (outcome: LinkedTabOutcome): boolean =>
  outcome === 'made' || outcome === 'connected';

// The app's removal door for a linked tab whose pair was removed: `DELETE <app>/api/internal/items/:id/connected-tabs/
// :connectionId` with that app's `INDEX_KEY`. The app removes the tab holding that connection, if any.
export const itemConnectedTabPath = (itemId: string, connectionId: string) =>
  `/items/${encodeURIComponent(itemId)}/connected-tabs/${encodeURIComponent(connectionId)}`;

// The open door's refusal for a linked tab whose file the reader cannot open themselves.
export const CONNECTION_LOCKED = 'connection_locked';
