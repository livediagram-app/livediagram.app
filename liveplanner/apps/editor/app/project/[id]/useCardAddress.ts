'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { cardEntryState, cardHash, hashCardId, isCardEntry } from '@/lib/card-address';
import { isEditorPath } from '@/lib/editor-path';

// Keeps the open card in the page's address (docs/specs/026-plan/plan-board.md "Its address"), beside the tab pin
// useTabEntryEffects writes. Reading the address on load is the deep link's (useCollabDeepLink), which opens the
// card; this hook writes it while the card is shown and walks it with the browser's Back and Forward:
//
// - a card opened from the plan pushes one entry (marked, lib/card-address.ts), so Back closes it;
// - a card opened by its address (`arrivingRef` names it) replaces: that entry is already the card's;
// - moving from card to card replaces, adding no entry;
// - closing steps back off the card's own entry, else replaces, so no second copy of the plan's address is left.
//
// `shownId` is the card the panel draws: the open card once the item store holds it. A card that is not there
// (deleted, or out of the share's scope) is never written, so its address drops quietly. Only the editor's own
// path is written, as the tab pin is: an embed and the workbench frame keep their addresses.
export function useCardAddress({
  hydrated,
  activeId,
  shownId,
  openItemId,
  arrivingRef,
  openItem,
  closeItem,
}: {
  hydrated: boolean;
  activeId: string | null;
  shownId: string | null;
  // The open card, shown or not: Back and Forward compare against it.
  openItemId: string | null;
  // The card being opened from an address, set before it opens; cleared once it is written.
  arrivingRef: MutableRefObject<string | null>;
  openItem: (itemId: string) => void;
  closeItem: () => void;
}): void {
  const written = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !activeId) return;
    const url = new URL(window.location.href);
    if (!isEditorPath(url.pathname)) return;
    const was = written.current;
    written.current = shownId;
    const arriving = shownId !== null && arrivingRef.current === shownId;
    if (arriving) arrivingRef.current = null;
    const want = cardHash(activeId, shownId);
    if (url.hash === want) return;
    url.hash = want;
    const history = window.history;
    if (shownId && !was && !arriving) history.pushState(cardEntryState(true), '', url);
    else if (!shownId && was && isCardEntry(history.state)) history.back();
    else history.replaceState(cardEntryState(isCardEntry(history.state)), '', url);
  }, [hydrated, activeId, shownId, arrivingRef]);

  // Back off a card's entry closes it; Forward onto one opens it again, as an arrival (its entry is already there).
  const openRef = useLatest(openItemId);
  const openItemRef = useLatest(openItem);
  const closeItemRef = useLatest(closeItem);
  useEffect(() => {
    if (!hydrated) return;
    const onPop = () => {
      if (!isEditorPath(window.location.pathname)) return;
      const id = hashCardId(window.location.hash);
      if (id === openRef.current) return;
      if (id) {
        arrivingRef.current = id;
        openItemRef.current(id);
      } else closeItemRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hydrated, arrivingRef, openRef, openItemRef, closeItemRef]);
}
