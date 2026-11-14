'use client';

// This browser's drafts of unsaved changes, on the editor's side (docs/specs/006-document/delta-saves.md "Drafts of
// unsaved changes"). A tab's load decides on its draft (lib/api/tabs.ts): one put back is taken here and put on
// screen as an unsaved edit over the stored tab, so the autosave saves it and relays it to the room like any edit
// (a tab already edited since it loaded keeps its edits, and the draft goes); one somebody's newer save overtook is said in a toast. Only an Editor takes one back: a session that may not save
// leaves the draft where it is, for a later load that can.
import { useEffect, useState, type MutableRefObject } from 'react';
import type { Tab } from '@livediagram/document';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { apiDiscardDraft, apiTakeDraftReplay, onTabDraft } from '@/lib/api-client';

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
export function withDraft(tabs: Tab[], baseline: readonly Tab[], draft: Tab): Tab[] {
  const at = tabs.findIndex((t) => t.id === draft.id);
  const screen = tabs[at];
  const stored = baseline.find((t) => t.id === draft.id);
  if (!screen || !stored || screen.elements !== stored.elements) return tabs;
  const next = [...tabs];
  next[at] = { ...screen, ...draft, folder: screen.folder };
  return next;
}

export function useTabDrafts(opts: {
  hydrated: boolean;
  documentId: string | null;
  selfId: string;
  // An Editor's session: a Participant's changes go to the room, a Viewer saves nothing.
  mayEdit: boolean;
  tabsRef: MutableRefObject<Tab[]>;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  // The tabs whose content has landed: a draft goes on screen only over its loaded tab.
  loadedTabIds: ReadonlySet<string>;
  applyLoaded: (apply: (tabs: Tab[]) => Tab[]) => void;
  toast: { info: (message: string) => void; warning: (message: string) => void };
}): void {
  const latest = useLatest(opts);
  // Bumped when a load puts a draft back, so the effect below takes it once its tab is in place.
  const [replays, setReplays] = useState(0);

  useEffect(
    () =>
      onTabDraft((event) => {
        const o = latest.current;
        if (event.itemId !== o.documentId || event.ownerId !== o.selfId) return;
        if (event.kind === 'stale') o.toast.warning(draftDroppedMessage(event.name));
        else setReplays((n) => n + 1);
      }),
    [latest],
  );

  const { hydrated, documentId, selfId, mayEdit, loadedTabIds } = opts;
  useEffect(() => {
    if (!hydrated || !documentId || !mayEdit) return;
    const o = latest.current;
    for (const tab of o.tabsRef.current) {
      if (!loadedTabIds.has(tab.id)) continue;
      const draft = apiTakeDraftReplay(selfId, documentId, tab.id);
      if (!draft) continue;
      const baseline = o.lastSavedTabsRef.current;
      // A tab edited since it loaded keeps those edits: the draft goes, so no later load brings it back over them.
      if (withDraft(o.tabsRef.current, baseline, draft) === o.tabsRef.current) {
        apiDiscardDraft(selfId, documentId, tab.id);
        continue;
      }
      o.applyLoaded((tabs) => withDraft(tabs, baseline, draft));
      o.toast.info(draftRestoredMessage(typeof draft.name === 'string' ? draft.name : null));
    }
  }, [replays, hydrated, documentId, selfId, mayEdit, loadedTabIds, latest]);
}
