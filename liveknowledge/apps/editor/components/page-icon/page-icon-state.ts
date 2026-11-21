'use client';

// The open page's icon in the editor (docs/specs/030-knowledgebase/page-surface.md "The page icon"; blueprint:
// docs/specs/030-knowledgebase/blueprints/page-surface.md "The page icon"): read from the store, settled as every
// stored icon is (a peer's tab-meta patch is untrusted), and written as the page's own meta, outside the writing and
// its draft, so it rides the tab's save and its `tab-meta` op as the cover does. Who may change it is the cover's
// rule (coverEditable).
import { parseTabIcon, samePageIcon, type Tab, type TabIcon } from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useCoverEditable } from '@/components/page-cover/page-cover-state';
import { track } from '@/lib/telemetry';

// Settled once per stored value: the head and the meta row read it on every store change.
const settled = new WeakMap<object, TabIcon | undefined>();
export function iconOfTab(tab: Pick<Tab, 'icon'>): TabIcon | undefined {
  const raw: unknown = tab.icon;
  if (!raw || typeof raw !== 'object') return undefined;
  if (settled.has(raw)) return settled.get(raw);
  const icon = parseTabIcon(raw);
  settled.set(raw, icon);
  return icon;
}

/** The open page's icon, settled; undefined when it has none. */
export function usePageIcon(): TabIcon | undefined {
  return useEditorChrome((s) => iconOfTab(s.activeTab));
}

/** Whether this person may change the open page's icon: the cover's rule (an Editor or a Participant, in edit mode). */
export const usePageIconEditable = useCoverEditable;

/** Puts `icon` on a tab, or takes it off with undefined; the same tab when nothing changes. */
export function withTabIcon<T extends Tab>(tab: T, icon: TabIcon | undefined): T {
  if (icon === undefined) {
    if (!('icon' in tab)) return tab;
    const { icon: _gone, ...rest } = tab;
    void _gone;
    return rest as T;
  }
  if (samePageIcon(iconOfTab(tab), icon)) return tab;
  return { ...tab, icon };
}

export type IconWriter = (icon: TabIcon | undefined) => void;

/** The writer of the open page's icon: one commit, which saves it and tells the room. */
export function useSetPageIcon(): IconWriter {
  const chrome = useEditorChromeStore();
  return (icon) => {
    const s = chrome.get();
    const id = s.activeTab.id;
    const was = iconOfTab(s.activeTab);
    if (samePageIcon(was, icon)) return;
    s.commitTabs((ts) => ts.map((t) => (t.id === id ? withTabIcon(t, icon) : t)));
    track('Element', !icon ? 'Deleted' : was ? 'Changed' : 'Added', 'PageIcon');
  };
}
