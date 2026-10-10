'use client';

// One name, one state (docs/specs/026-plan/plan-board.md "One name, one state"): a document whose boards hold two
// states of one name (a Plan template's tab added beside a board, a pasted or agent-written board, or a document
// from before the rule) merges them into the first, in tab, board and column order, so every client picks the
// same one. Its boards take the kept state (a board holding both drops the later column) and its cards move to it,
// as one write. Done by someone who may edit, once the cards have loaded, without an undo step: undoing it would
// only split the cards again. It runs whenever the document's duplicates change, so an undo that brings one back,
// or a board that arrives with one, is merged too.
import { useEffect, useMemo } from 'react';
import type { Tab } from '@livediagram/document';
import {
  duplicateStatuses,
  mergeBoardStatuses,
  mergedStatusPatches,
  normaliseBoardSetup,
  statusColumnsOfSetups,
  type Item,
  type ItemWrite,
} from '@livediagram/items';
import { debugLog } from '@/lib/debug-log';
import { documentBoardSetups } from './usePlanStatusNames';

export function useMergeDuplicateStatuses(opts: {
  tabs: readonly Tab[];
  // Someone who may edit, with Plan in play and every tab loaded.
  enabled: boolean;
  itemsReady: boolean;
  items: ReadonlyMap<string, Item>;
  tickTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  writeQuiet: (write: ItemWrite) => Promise<boolean>;
}): void {
  const { tabs, enabled, itemsReady, items, tickTabs, writeQuiet } = opts;
  // In tab order (no tab first), so the kept state is the same for everyone.
  const merged = useMemo(
    () => duplicateStatuses(statusColumnsOfSetups(documentBoardSetups(tabs, ''))),
    [tabs],
  );
  const signature = [...merged].map(([from, to]) => `${from}>${to}`).join(',');
  useEffect(() => {
    if (!enabled || !itemsReady || merged.size === 0) return;
    tickTabs((ts) =>
      ts.map((t) => {
        let changed = false;
        const elements = t.elements.map((el) => {
          if (el.type !== 'shape' || el.shape !== 'plan-board') return el;
          const setup = normaliseBoardSetup(el.planBoard);
          if (!setup || !setup.columns.some((c) => merged.has(c.status))) return el;
          changed = true;
          return { ...el, planBoard: mergeBoardStatuses(setup, merged) };
        });
        return changed ? { ...t, elements } : t;
      }),
    );
    const patches = mergedStatusPatches(items.values(), merged);
    if (patches.length) void writeQuiet({ kind: 'patches', patches });
    debugLog('[plan] states.merged', { states: merged.size, cards: patches.length });
    // Runs once per set of duplicates: the merge empties it, and a new duplicate changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, itemsReady]);
}
