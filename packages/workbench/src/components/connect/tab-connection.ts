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

/**
 * A summary onto a tab built from it before its body loads (a placeholder on the first paint, or a tab a peer's outline
 * adds): its connection, and a renamed connected tab's file name (connected-tabs.md "A tab's own name"), so the bar
 * names the file at once. A tab already held keeps its own (carryConnection).
 */
export function fromSummary<T extends object>(tab: T, summary: object | null | undefined): T {
  const carried = carryConnection(tab, summary);
  const targetName = (summary as Named | null | undefined)?.targetName;
  if (!connectionOf(carried) || typeof targetName !== 'string' || targetName === '') return carried;
  return { ...carried, targetName };
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

// A connected tab's own name (liveworkspace/docs/specs/004-index/connected-tabs.md "A tab's own name"): `name` is the
// label every list shows; `targetName`, kept beside it in the tab's body only while the tab has a name of its own, is
// the target's name as last seen. A tab without one follows its target in its name.
type Named = { name: string; targetName?: unknown };

/** Whether an Editor gave this tab a name of its own (it keeps the target's beside it). */
export const hasOwnName = (tab: object): boolean => {
  const held = (tab as Named).targetName;
  return typeof held === 'string' && held !== '';
};

/** The target's own name, as last seen: its `targetName` on a renamed tab, else its name. */
export const targetNameOf = (tab: { name: string }): string =>
  hasOwnName(tab) ? ((tab as Named).targetName as string) : tab.name;

/** The tab without `targetName`, named `name`: following its target again. */
function following<T extends { name: string }>(tab: T, name: string): T {
  const { targetName: _dropped, ...rest } = tab as T & Named;
  return { ...rest, name } as unknown as T;
}

/** A rename typed on a connected tab (already trimmed and capped): nothing, or the target's own name, follows the
 *  target again; anything else becomes the tab's own name, the target's kept beside it. The same tab when nothing
 *  changes. */
export function renamedConnectedTab<T extends { name: string }>(tab: T, typed: string): T {
  const target = targetNameOf(tab);
  if (typed === '' || typed === target) {
    return hasOwnName(tab) ? following(tab, target) : tab;
  }
  if (typed === tab.name && hasOwnName(tab)) return tab;
  return { ...tab, name: typed, targetName: target };
}

/** The target's name as an open (or Connect Again) answered it: a renamed tab keeps its own name and holds the new
 *  one beside it; any other tab takes it as its name. The same tab when nothing changes. */
export function followedConnectedTab<T extends { name: string }>(tab: T, answered: string): T {
  if (hasOwnName(tab)) {
    if ((tab as Named).targetName === answered) return tab;
    // The target now has the tab's own name: nothing sets the two apart, so the tab follows again.
    if (answered === tab.name) return following(tab, answered);
    return { ...tab, targetName: answered };
  }
  return tab.name === answered ? tab : { ...tab, name: answered };
}
