'use client';

// The walkthroughs as a canvas editor mounts them (liveworkspace/docs/specs/006-media/walkthroughs.md "One package,
// four apps"): the editor hands in its own facts, this says where walkthroughs fit and binds the host. Off (no
// Tools row, no request) in an embed, the workbench frame, Offline, a tab-scoped link, on a phone and until the
// item is up.

import { selectionIds, type SelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { useMemo } from 'react';
import type { WalkthroughApiDeps } from './api';
import type { WalkthroughHideable, WalkthroughViewport } from './host';
import { useWalkthroughs, type Walkthroughs } from './useWalkthroughs';
import {
  slidesOfDeck,
  useWalkthroughHost,
  type EditorTab,
  type SlideDeckLike,
} from './useWalkthroughHost';

export type EditorWalkthroughsInput = {
  itemId: string | null;
  hydrated: boolean;
  embedMode: boolean;
  workbench: unknown;
  offline: boolean;
  phone: boolean;
  tabScope: unknown;
  apiBase: string;
  // The app's api funnel; `uploadProgress` reports a save's bytes sent (the app's apiFetch option of that name).
  apiFetch: WalkthroughApiDeps['fetch'];
  apiHeaders: (ownerId: string, opts: { share: string | null }) => Promise<HeadersInit>;
  self: { id: string; name: string };
  shareCode: string | null;
  viewport: WalkthroughViewport;
  tabs: readonly EditorTab[];
  activeTab: string;
  selectTab: (tab: string) => void;
  selectionStore: Pick<SelectionStore, 'get'>;
  // livediagram's and livedocuments' slide deck; the others have none.
  deck?: SlideDeckLike | undefined;
  // liveplanner's board cards and dashboard widgets (host.ts WalkthroughHideable); the others hide canvas elements alone.
  hideable?: WalkthroughHideable | undefined;
};

/** Whether walkthroughs fit this editor session at all. */
export function walkthroughsFit(
  input: Pick<
    EditorWalkthroughsInput,
    'hydrated' | 'embedMode' | 'workbench' | 'offline' | 'phone' | 'tabScope'
  >,
): boolean {
  return (
    input.hydrated &&
    !input.embedMode &&
    !input.workbench &&
    !input.offline &&
    !input.phone &&
    (input.tabScope === null || input.tabScope === undefined)
  );
}

export function useEditorWalkthroughs(input: EditorWalkthroughsInput): Walkthroughs {
  const { deck, self, shareCode, apiHeaders, apiFetch, selectionStore } = input;
  const slides = useMemo(() => (deck ? slidesOfDeck(deck) : undefined), [deck]);
  const host = useWalkthroughHost({
    itemId: walkthroughsFit(input) ? input.itemId : null,
    apiBase: input.apiBase,
    apiFetch: (url, init, opts) => apiFetch(url, init, opts),
    apiHeaders: () => apiHeaders(self.id, { share: shareCode }),
    viewport: input.viewport,
    tabs: input.tabs,
    activeTab: input.activeTab,
    selectTab: input.selectTab,
    slides,
    selection: () => {
      const { selectedId, multiSelectedIds } = selectionStore.get();
      return selectionIds(selectedId, multiSelectedIds);
    },
    author: self.name || null,
    hideable: input.hideable,
  });
  return useWalkthroughs(host);
}
