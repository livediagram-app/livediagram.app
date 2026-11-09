// The tab list a resync re-reads (docs/specs/012-collaboration/resync-without-reload.md "The tab list"). The ops a
// reconnect gap lost include `document-meta`, a peer's tab added, deleted, renamed or moved; refetching the content
// of the tabs held here never brought those back. The document's stored list is applied as that op would have been,
// to the screen and to the save baseline, keeping what this editor has not saved yet. Pure.
import type { Tab } from '@livehuddle/document';
import type { RoomOp, TabSummary } from '@livehuddle/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';
import { keepUnsavedTabChanges } from './meta-keep-local';

export type ResyncTabList = Extract<RoomOp, { kind: 'document-meta' }>;

// The document's stored tabs, in order, as the op a peer's save would have sent. Null for an empty list: a document
// always holds a tab, so one read with none is no list to act on.
export function tabListOf(document: {
  name: string;
  tabs: readonly TabSummary[];
}): ResyncTabList | null {
  if (document.tabs.length === 0) return null;
  return {
    kind: 'document-meta',
    name: document.name,
    tabs: document.tabs.map((t, i) => ({
      id: t.id,
      name: t.name,
      orderIndex: i,
      ...(t.folder !== undefined ? { folder: t.folder } : {}),
      ...(t.outOfScope ? { outOfScope: true as const } : {}),
      ...(t.connection ? { connection: t.connection } : {}),
    })),
  };
}

// The list applied to a set of tabs. A tab whose content is not held here (a placeholder) takes the stored name: its
// content fetch, which carries a name, is not part of the resync. A held tab's name comes with its refetched content.
export function applyTabList(tabs: Tab[], list: ResyncTabList, loaded: ReadonlySet<string>): Tab[] {
  const names = new Map(list.tabs.map((t) => [t.id, t.name] as const));
  const next = applyRoomOpToTabs(tabs, list).map((t) => {
    const name = names.get(t.id);
    return name === undefined || loaded.has(t.id) || name === t.name ? t : { ...t, name };
  });
  return next.length === tabs.length && next.every((t, i) => t === tabs[i]) ? tabs : next;
}

// On screen: the list, keeping a tab added here or deleted here since the last save (keepUnsavedTabChanges).
export function applyTabListOnScreen(
  tabs: Tab[],
  list: ResyncTabList,
  loaded: ReadonlySet<string>,
  savedBefore: readonly Tab[],
): Tab[] {
  return keepUnsavedTabChanges(tabs, applyTabList(tabs, list, loaded), savedBefore);
}
