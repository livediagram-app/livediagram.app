'use client';

// The open design as the Automations screen reads it (blueprint automations.md "Editor", "The item"; the platform's
// item-ui.md "The helper": ItemView): its id and name, its tabs, the tab the person is on, the people rules may
// name, the share code, whether they are signed in, and how to open a tab. Worked out in the editor view and
// provided by the host (DesignAutomationsHost); the kit's `useItem` reads it inside the lazy screen. Each part is
// memoised on what it reads, so an edit, which gives the tab list a new identity with its ids and names
// unchanged, answers the same view and the open screen does not draw again. Light: the host loads it.

import { createContext, use, useCallback, useMemo } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
// A type alone: the editor's first load reaches nothing of the item kit (design-automations-lazy.test.ts).
import type { ItemView } from '@liveworkspace/automations-ui/item';

type Named = { id: string; name: string };

// A list's ids and names as one string: what the view's tabs and people are memoised on.
const keyOf = (list: readonly Named[]): string => JSON.stringify(list.map((n) => [n.id, n.name]));
const fromKey = (key: string): Named[] =>
  (JSON.parse(key) as [string, string][]).map(([id, name]) => ({ id, name }));

/** The people rules may name: the signed-in account, then the design team's joined members, each once. An
 *  invited member with no account yet has nobody to match or email. */
export function peopleOf(
  self: Named | null,
  team: readonly { userId: string | null; name: string; pending?: boolean }[],
): Named[] {
  const named = new Map<string, string>();
  if (self) named.set(self.id, self.name);
  for (const m of team)
    if (m.userId && !m.pending && !named.has(m.userId)) named.set(m.userId, m.name);
  return [...named].map(([id, name]) => ({ id, name }));
}

export type DesignItemInput = {
  designId: string | null;
  designName: string | null | undefined;
  tabs: readonly Named[];
  activeId: string | null;
  // The signed-in account; null for a guest.
  self: Named | null;
  // The design team's people (the comment mentions' candidates).
  team: readonly { userId: string | null; name: string; pending?: boolean }[];
  shareCode: string | null;
  openTab: (tabId: string) => void;
};

/** The ItemView, the same object while nothing in it changed. Null without a design. */
export function useDesignItemView(input: DesignItemInput): ItemView | null {
  const { designId, activeId, shareCode, self } = input;
  const name = input.designName?.trim() || 'Untitled design';
  // Held by their ids and names: a new list with the same ones answers the same list.
  const tabsKey = keyOf(input.tabs);
  const peopleKey = keyOf(peopleOf(self, input.team));
  const tabs = useMemo(() => fromKey(tabsKey), [tabsKey]);
  const named = useMemo(() => fromKey(peopleKey), [peopleKey]);
  // The editor's handler, read at the call: a new one never changes the view.
  const latest = useLatest(input.openTab);
  const openTab = useCallback((tabId: string) => latest.current(tabId), [latest]);
  const signedIn = self !== null;
  return useMemo<ItemView | null>(
    () =>
      designId
        ? {
            id: designId,
            name,
            tabs,
            currentTabId: activeId,
            people: named,
            shareCode,
            signedIn,
            openTab,
          }
        : null,
    [designId, name, tabs, activeId, named, shareCode, signedIn, openTab],
  );
}

export const DesignItemContext = createContext<ItemView | null>(null);

// An empty view, for a screen drawn with no design (never, as the host draws it only with a scope).
const NO_DESIGN: ItemView = {
  id: '',
  name: '',
  tabs: [],
  currentTabId: null,
  people: [],
  shareCode: null,
  signedIn: false,
  openTab: () => {},
};

/** The kit's `useItem`: the open design the host provides. */
export function useDesignItem(): ItemView {
  return use(DesignItemContext) ?? NO_DESIGN;
}
