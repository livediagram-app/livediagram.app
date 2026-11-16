// Ending access in the workbench store (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): from the
// removed pairings, their sessions and the rooms those sessions joined, the log lines and the rooms the caller closes.
// Pure over rows the store already read (store.ts `endAccess`); the store does no network.

import type { Row } from './store-schema.ts';
import { type RoomsToClose, sessionPrefixOf, type WorkbenchEndReason } from './store-types.ts';

// A revoked token's own rooms (store.ts `noteTokenRoom`), by app: its room tickets' sockets close there.
export function tokenRoomsToClose(tokenId: string, rows: Row[]): RoomsToClose[] {
  const byApp = new Map<string, string[]>();
  for (const row of rows) {
    const app = row.app as string;
    byApp.set(app, [...(byApp.get(app) ?? []), row.item_id as string]);
  }
  const rooms = [...byApp].map(([app, itemIds]) => ({ app, tokenId, itemIds }));
  if (rooms.length > 0) console.info('[workbench] token rooms', { tokenId, rooms: rows.length });
  return rooms;
}

export function roomsOfEndedAccess(
  pairings: Row[],
  sessions: Row[],
  joined: Row[],
  reason: WorkbenchEndReason,
): RoomsToClose[] {
  for (const session of sessions) {
    console.info('[workbench] session-ended', {
      reason,
      scope: session.scope,
      itemId: session.item_id,
      tokenId: session.token_id,
      sessionPrefix: sessionPrefixOf(session.id as string),
    });
  }
  const rooms: RoomsToClose[] = [];
  for (const pairing of pairings) {
    const itemIds = [
      ...new Set([
        ...sessions.flatMap((s) =>
          s.pairing_id === pairing.id && s.item_id !== null ? [s.item_id as string] : [],
        ),
        ...joined.filter((r) => r.pairing_id === pairing.id).map((r) => r.item_id as string),
      ]),
    ];
    if (itemIds.length > 0) {
      rooms.push({ app: pairing.app as string, pairingId: pairing.id as string, itemIds });
    }
    console.info('[workbench] unpaired', {
      app: pairing.app,
      tokenId: pairing.token_id,
      pairingId: pairing.id,
      scope: pairing.scope,
      reason,
      rooms: itemIds.length,
    });
  }
  return rooms;
}
