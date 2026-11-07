// A connected tab's connection on an editor's own tab (liveworkspace/docs/specs/004-index/connected-tabs.md "What a
// connected tab is"). Every app's wire tab carries it beside the body (`TabRecord.connection`, `TabSummary.connection`,
// the room's outline op), and the editors keep it on the tab object as it arrived, so a save sends it back untouched:
// read here, exactly `{ id, app, itemId }` or nothing, whatever an editor's own tab type says.
import { readTabConnection, type TabConnection } from '@liveworkspace/index-client';

type Carrier = { connection?: unknown };

/** The tab's connection, or null for a tab of content (or one whose connection is malformed). */
export const connectionOf = (tab: object | null | undefined): TabConnection | null =>
  tab ? readTabConnection((tab as Carrier).connection) : null;

/** The tab holding `connection` (a new connected tab, or one connected again). */
export const withConnection = <T extends object>(tab: T, connection: TabConnection): T => ({
  ...tab,
  connection: { id: connection.id, app: connection.app, itemId: connection.itemId },
});

/** A summary's connection onto a tab built from it (a placeholder, a peer's outline), else the tab as it is. */
export function carryConnection<T extends object>(tab: T, from: object | null | undefined): T {
  const connection = connectionOf(from);
  if (!connection) return tab;
  const held = connectionOf(tab);
  if (held && held.id === connection.id) return tab;
  return withConnection(tab, connection);
}

/** The host's connected tabs, target item id to the tab holding it, for the Connect list's Connected rows. */
export function connectedTargets(tabs: readonly ({ id: string } & object)[]): Map<string, string> {
  const targets = new Map<string, string>();
  for (const tab of tabs) {
    const connection = connectionOf(tab);
    if (connection && !targets.has(connection.itemId)) targets.set(connection.itemId, tab.id);
  }
  return targets;
}

/** What a connected tab's menu needs beyond any tab's: whether it opens nothing, and Connect Again for an Editor. */
export type ConnectedTabMenu = { broken: boolean; onConnectAgain: () => void };
