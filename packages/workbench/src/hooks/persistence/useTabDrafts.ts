'use client';

// This browser's drafts of unsaved changes, on the editor's side (each product's docs/specs/006-*/delta-saves.md
// "Drafts of unsaved changes"). A tab's load decides on its draft (lib/api/tab-calls.ts): one put back is taken here
// and put on screen as an unsaved edit over the stored tab, so the autosave saves it and relays it to the room like
// any edit (a tab already edited since it loaded keeps its edits, and the draft goes); one somebody's newer save
// overtook is said in a toast. Only an Editor takes one back: a session that may not save leaves the draft where it
// is, for a later load that can. Every editor mounts it once, with its own tab calls' draft doors.
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { toastName } from '../../lib/toast-name';
import { useLatest } from '../ui/useLatest';
import type { TabDraftEvent } from '../../lib/api/tab-drafts';

// The tab fields a draft touches.
type DraftTab = { id: string; elements: unknown; name?: unknown; folder?: string };

/** The toast when a draft was dropped: somebody saved the tab since it was made. */
export function draftDroppedMessage(tabName: string | null): string {
  return `Couldn't apply your last unsaved edit to ${toastName(tabName) ?? 'this tab'}: the tab changed since.`;
}

/** The toast when a draft is back on screen, saving. */
export function draftRestoredMessage(tabName: string | null): string {
  return `Restored your last unsaved edit to ${toastName(tabName) ?? 'this tab'}.`;
}

// The tab with the draft in place, when the tab on screen is still the stored one the load put there (its elements
// the baseline's own): a tab edited since keeps its edits, and its next save carries them.
export function withDraft<T extends DraftTab>(tabs: T[], baseline: readonly T[], draft: T): T[] {
  const at = tabs.findIndex((t) => t.id === draft.id);
  const screen = tabs[at];
  const stored = baseline.find((t) => t.id === draft.id);
  if (!screen || !stored || screen.elements !== stored.elements) return tabs;
  const next = [...tabs];
  next[at] = { ...screen, ...draft, folder: screen.folder };
  return next;
}

/** The product's tab calls' draft doors (createTabCalls' takeDraftReplay, discardDraft, onDraft). */
export type TabDraftDoors<T> = {
  takeReplay: (ownerId: string, itemId: string, tabId: string) => T | null;
  discard: (ownerId: string, itemId: string, tabId: string) => void;
  onDraft: (listener: (event: TabDraftEvent) => void) => () => void;
};

export function useTabDrafts<T extends DraftTab>(opts: {
  drafts: TabDraftDoors<T>;
  hydrated: boolean;
  itemId: string | null;
  selfId: string;
  // An Editor's session: a Participant's changes go to the room, a Viewer saves nothing.
  mayEdit: boolean;
  tabsRef: MutableRefObject<T[]>;
  lastSavedTabsRef: MutableRefObject<T[]>;
  // The tabs whose content has landed: a draft goes on screen only over its loaded tab.
  loadedTabIds: ReadonlySet<string>;
  applyLoaded: (apply: (tabs: T[]) => T[]) => void;
  toast: { info: (message: string) => void; warning: (message: string) => void };
}): void {
  const latest = useLatest(opts);
  // Bumped when a load puts a draft back or drops one, so the effects below act once the item is known.
  const [replays, setReplays] = useState(0);
  // Drafts a load dropped, waiting to be said: the first tab's load can settle before the editor knows its item id,
  // and the draft is already gone by then, so the toast must not be lost.
  const dropped = useRef<TabDraftEvent[]>([]);

  useEffect(
    () =>
      latest.current.drafts.onDraft((event) => {
        if (event.kind === 'stale') dropped.current.push(event);
        setReplays((n) => n + 1);
      }),
    [latest],
  );

  const { hydrated, itemId, selfId, mayEdit, loadedTabIds } = opts;
  useEffect(() => {
    if (!itemId || dropped.current.length === 0) return;
    const said = dropped.current;
    dropped.current = [];
    for (const event of said) {
      if (event.itemId !== itemId || event.ownerId !== selfId) continue;
      latest.current.toast.warning(draftDroppedMessage(event.name));
    }
  }, [replays, itemId, selfId, latest]);
  useEffect(() => {
    if (!hydrated || !itemId || !mayEdit) return;
    const o = latest.current;
    for (const tab of o.tabsRef.current) {
      if (!loadedTabIds.has(tab.id)) continue;
      const draft = o.drafts.takeReplay(selfId, itemId, tab.id);
      if (!draft) continue;
      const baseline = o.lastSavedTabsRef.current;
      // A tab edited since it loaded keeps those edits: the draft goes, so no later load brings it back over them.
      if (withDraft(o.tabsRef.current, baseline, draft) === o.tabsRef.current) {
        o.drafts.discard(selfId, itemId, tab.id);
        continue;
      }
      o.applyLoaded((tabs) => withDraft(tabs, baseline, draft));
      o.toast.info(draftRestoredMessage(typeof draft.name === 'string' ? draft.name : null));
    }
  }, [replays, hydrated, itemId, selfId, mayEdit, loadedTabIds, latest]);
}
