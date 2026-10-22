'use client';

// A board brings its card types (docs/specs/026-plan/item-types.md "The type catalogue", plan-mode.md "The palette"):
// it adds the ones it names that the document lacks, so in a fresh document the first boards choose them (a Kanban
// board's document has Task and Action); a Blank board brings none. Only a board that appears while the document is
// open counts (placed here, by a template, or by someone else): the boards it opened with never add a type back, so a
// type someone deleted stays deleted.
//
// The effect reads the open tab only. A template's tabs bring theirs as they are made, every tab at once
// (docs/specs/026-plan/plan-templates.md "Card types a template uses"): Quick Start hands their elements to `bring`.
// Nothing is decided before the document's items are read (an old document with cards reads as the default types,
// legacyCatalogue): a `bring` made earlier (a Plan template picked outside Plan mode) waits for them.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Tab } from '@livepages/document';
import { catalogueWithBoardTypes, type ItemTypeCatalogue } from '@livepages/items';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';

type Elements = Tab['elements'];

// What can bring card types: boards, and Gantt charts (boardTypeIdsOf).
const brings = (el: Elements[number]) =>
  el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-view');

function boardsOf(tab: Tab | undefined): Elements {
  return (tab?.elements ?? []).filter(brings);
}

// Saves the catalogue `boards` leave, when it changes; `via` names the path in the log.
function applyBoards(
  latest: RefObject<{
    catalogue: ItemTypeCatalogue | null;
    saveCatalogue: (next: ItemTypeCatalogue) => void;
  }>,
  boards: Elements,
  via: string,
): void {
  const now = latest.current;
  const next = catalogueWithBoardTypes(now.catalogue, boards);
  if (!next) return;
  debugLog('[item-types] brought', {
    via,
    chosen: now.catalogue === null,
    types: next.types.map((t) => t.id),
  });
  now.saveCatalogue(next);
}

export function usePresetCardTypes({
  tabs,
  activeId,
  enabled,
  canBring,
  itemsReady,
  catalogue,
  saveCatalogue,
}: {
  tabs: readonly Tab[];
  activeId: string;
  // Plan in play, the document's types read, and this person may change them.
  enabled: boolean;
  // The document's types read and this person may change them, in any mode (a template is made from any).
  canBring: boolean;
  // The document's items are read.
  itemsReady: boolean;
  // The stored catalogue, null while the document's card types are not chosen.
  catalogue: ItemTypeCatalogue | null;
  saveCatalogue: (next: ItemTypeCatalogue) => void;
}): { bring: (elements: Elements) => void } {
  const latest = useLatest({ catalogue, saveCatalogue });
  const apply = useCallback(
    (boards: Elements, via: string) => applyBoards(latest, boards, via),
    [latest],
  );

  // The boards seen so far, per tab; null until the tab is first read (its boards then are where it started).
  const seen = useRef(new Map<string, Set<string>>());
  const tab = tabs.find((t) => t.id === activeId);
  useEffect(() => {
    if (!enabled || !itemsReady || !tab) return;
    const boards = boardsOf(tab);
    const known = seen.current.get(tab.id);
    seen.current.set(tab.id, new Set(boards.map((b) => b.id)));
    if (!known) return;
    const fresh = boards.filter((b) => !known.has(b.id));
    if (fresh.length > 0) apply(fresh, 'board');
  }, [enabled, itemsReady, tab, apply]);

  // Elements handed to `bring` before the items were read.
  const pending = useRef<Elements>([]);
  useEffect(() => {
    if (!canBring || !itemsReady || pending.current.length === 0) return;
    const held = pending.current;
    pending.current = [];
    apply(held, 'template');
  }, [canBring, itemsReady, apply]);

  const ready = useLatest({ canBring, itemsReady });
  // Called before the elements are committed, so the effect above then finds nothing to change.
  const bring = useCallback(
    (elements: Elements) => {
      const { canBring: can, itemsReady: read } = ready.current;
      if (!can) return;
      const boards = elements.filter(brings);
      if (boards.length === 0) return;
      if (read) apply(boards, 'template');
      else pending.current = [...pending.current, ...boards];
    },
    [ready, apply],
  );
  return { bring };
}
