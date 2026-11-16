'use client';

// A board brings its card types (docs/specs/026-plan/item-types.md "The type catalogue", plan-mode.md "The palette"):
// it adds the ones it names that the project lacks, so in a fresh project the first boards choose them (a Kanban
// board's project has Task and Action); a Blank board brings none. Only a board that appears while the project is
// open counts (placed here, by a template, or by someone else): the boards it opened with never add a type back, so a
// type someone deleted stays deleted.
//
// The effect reads the open tab only. A template's tabs bring theirs as they are made, every tab at once
// (docs/specs/026-plan/plan-templates.md "Card types a template uses"): Quick Start hands their elements to `bring`.
// Nothing is decided before the project's items are read (an old project with cards reads as the default types,
// legacyCatalogue): a `bring` made earlier (a Plan template picked outside Plan mode) waits for them.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Tab } from '@liveplanner/project';
import {
  boardCardType,
  boardTypeIdsOf,
  catalogueWithBoardTypes,
  localeCurrency,
  templateCardTypesProvided,
  typesOf,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

type Elements = Tab['elements'];

// What can bring card types: boards, and Gantt charts (boardTypeIdsOf).
const brings = (el: Elements[number]) =>
  el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-view');

function boardsOf(tab: Tab | undefined): Elements {
  return (tab?.elements ?? []).filter(brings);
}

// What applyBoards last saved, over which catalogue: until a render hands the saved one back, a second bring in the
// same tick builds on it, so two brings never save over each other.
type Saved = { over: ItemTypeCatalogue | null; next: ItemTypeCatalogue } | null;

type Latest = RefObject<{
  catalogue: ItemTypeCatalogue | null;
  saveCatalogue: (next: ItemTypeCatalogue) => void;
}>;

// Saves the catalogue `boards` leave, when it changes; `via` names the path in the log.
function applyBoards(latest: Latest, saved: { current: Saved }, boards: Elements, via: string): void {
  const now = latest.current;
  const base =
    saved.current && saved.current.over === now.catalogue ? saved.current.next : now.catalogue;
  const next = catalogueWithBoardTypes(base, boards, {
    currency: localeCurrency(typeof navigator === 'undefined' ? undefined : navigator.language),
  });
  if (!next) return;
  debugLog('[item-types] brought', {
    via,
    chosen: now.catalogue === null,
    types: next.types.map((t) => t.id),
  });
  saved.current = { over: now.catalogue, next };
  now.saveCatalogue(next);
}

// Whether `boards` name a type neither the plan nor the board lookup knows yet: a Plan template's own type
// (docs/specs/026-plan/plan-templates.md "Card types a template makes"), whose catalogue loads only then.
function needsTemplateTypes(boards: Elements, catalogue: ItemTypeCatalogue | null): boolean {
  if (templateCardTypesProvided()) return false;
  const have = new Set(typesOf(catalogue).map((t) => t.id));
  return boardTypeIdsOf(boards).some((id) => !have.has(id) && !boardCardType(id));
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
  // Plan in play, the project's types read, and this person may change them.
  enabled: boolean;
  // The project's types read and this person may change them, in any mode (a template is made from any).
  canBring: boolean;
  // The project's items are read.
  itemsReady: boolean;
  // The stored catalogue, null while the project's card types are not chosen.
  catalogue: ItemTypeCatalogue | null;
  saveCatalogue: (next: ItemTypeCatalogue) => void;
}): { bring: (elements: Elements) => void } {
  const latest = useLatest({ catalogue, saveCatalogue });
  const saved = useRef<Saved>(null);
  const apply = useCallback(
    (boards: Elements, via: string) => {
      if (!needsTemplateTypes(boards, latest.current.catalogue)) {
        applyBoards(latest, saved, boards, via);
        return;
      }
      void import('@liveplanner/items/template-card-types').then((m) => {
        m.provideTemplateCardTypes(m.TEMPLATE_CARD_TYPES);
        applyBoards(latest, saved, boards, via);
      });
    },
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
