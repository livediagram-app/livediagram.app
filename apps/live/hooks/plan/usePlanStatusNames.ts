'use client';

// The names and phases the document's boards give their statuses (docs/specs/026-plan/plan-templates.md
// "Hand-offs"): the open tab's boards first, then every other tab's in tab order, in board and column
// order. They feed an All Cards board's status rows, the item panel's status picker, the Cards panel's
// Not on a Board, and what the plan views count as Not Started, In Progress and Done. Keyed by a
// signature of the columns, so the maps (and the Plan context) change only when a column does.
import { useMemo } from 'react';
import type { Element, Tab } from '@livediagram/document';
import { normaliseBoardSetup, statusPhasesOf, type StatusPhase } from '@livediagram/items';

// A tab's board set-ups, cached by its elements array: a tab's elements are replaced, never mutated,
// so an unchanged tab is not walked again on the next render.
const setupsCache = new WeakMap<readonly Element[], readonly unknown[]>();
function boardSetupsIn(elements: readonly Element[]): readonly unknown[] {
  let setups = setupsCache.get(elements);
  if (!setups) {
    setups = elements.flatMap((el) =>
      el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
    );
    setupsCache.set(elements, setups);
  }
  return setups;
}

// Every board set-up of the document, the open tab's first.
export function documentBoardSetups(tabs: readonly Tab[], activeId: string): unknown[] {
  const active = tabs.find((t) => t.id === activeId);
  const rest = tabs.filter((t) => t !== active);
  return [active, ...rest].flatMap((t) => (t ? boardSetupsIn(t.elements) : []));
}

export function statusColumnsOfSetups(setups: readonly unknown[]): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  for (const raw of setups) {
    const setup = normaliseBoardSetup(raw);
    if (!setup || setup.allCards || setup.archive) continue;
    for (const c of setup.columns) {
      if (seen.has(c.status)) continue;
      seen.add(c.status);
      out.push([c.status, c.name]);
    }
  }
  return out;
}

export function statusColumnsOf(elements: readonly Element[]): [string, string][] {
  return statusColumnsOfSetups(boardSetupsIn(elements));
}

// The two signatures, cached by the identity of each tab's set-up list: a render that changes no board
// (a drag, a keystroke) finds the same lists and reuses them, without normalising a set-up again. A few
// entries are kept (the open tab may change back and forth), oldest dropped first.
const sourceIds = new WeakMap<readonly unknown[], number>();
let nextSourceId = 0;
function sourceId(setups: readonly unknown[]): number {
  let id = sourceIds.get(setups);
  if (id === undefined) {
    id = nextSourceId++;
    sourceIds.set(setups, id);
  }
  return id;
}

export const STATUS_SIGNATURE_CACHE_MAX = 8;
type Signatures = { names: string; phases: string };
const signatures = new Map<string, Signatures>();

export function documentStatusSignatures(tabs: readonly Tab[], activeId: string): Signatures {
  const active = tabs.find((t) => t.id === activeId);
  const ordered = [active, ...tabs.filter((t) => t !== active)].flatMap((t) =>
    t ? [boardSetupsIn(t.elements)] : [],
  );
  const key = ordered.map(sourceId).join(',');
  const cached = signatures.get(key);
  if (cached) return cached;
  const setups = ordered.flat();
  const next = {
    names: JSON.stringify(statusColumnsOfSetups(setups)),
    phases: JSON.stringify([...statusPhasesOf(setups)]),
  };
  signatures.set(key, next);
  if (signatures.size > STATUS_SIGNATURE_CACHE_MAX)
    signatures.delete(signatures.keys().next().value!);
  return next;
}

const OFF: Signatures = { names: '[]', phases: '[]' };

// The document's status names and phases, read only where Plan is in play
// (docs/specs/026-plan/plan-mode.md "Cost"); each map keeps its identity while its signature does.
export function usePlanStatuses(
  tabs: readonly Tab[],
  activeId: string,
  enabled: boolean,
): { names: ReadonlyMap<string, string>; phases: ReadonlyMap<string, StatusPhase> } {
  const sig = enabled ? documentStatusSignatures(tabs, activeId) : OFF;
  const names = useMemo(() => new Map(JSON.parse(sig.names) as [string, string][]), [sig.names]);
  const phases = useMemo(
    () => new Map(JSON.parse(sig.phases) as [string, StatusPhase][]),
    [sig.phases],
  );
  return { names, phases };
}
