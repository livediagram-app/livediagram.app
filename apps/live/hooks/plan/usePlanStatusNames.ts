'use client';

// The names the tab's boards give their statuses (docs/specs/025-plan/plan-board.md "All Cards"), in
// board and column order: an All Cards board's status rows and the item panel's status picker. Keyed by
// a signature of the columns, so the map (and the Plan context) changes only when a column does.
import { useMemo } from 'react';
import type { Element } from '@livediagram/document';
import { normaliseBoardSetup, statusPhasesOf, type StatusPhase } from '@livediagram/items';

export function statusColumnsOf(elements: readonly Element[]): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
    const setup = normaliseBoardSetup(el.planBoard);
    if (!setup || setup.allCards || setup.archive) continue;
    for (const c of setup.columns) {
      if (seen.has(c.status)) continue;
      seen.add(c.status);
      out.push([c.status, c.name]);
    }
  }
  return out;
}

export function usePlanStatusNames(
  elements: readonly Element[],
  enabled: boolean,
): ReadonlyMap<string, string> {
  const signature = enabled ? JSON.stringify(statusColumnsOf(elements)) : '[]';
  return useMemo(() => new Map(JSON.parse(signature) as [string, string][]), [signature]);
}

// The phase the tab's boards give each status (docs/specs/025-plan/plan-views.md "What a plan view reads"):
// what the plan views count as Not Started, In Progress and Done. Keyed by a signature, like the names.
export function usePlanStatusPhases(
  elements: readonly Element[],
  enabled: boolean,
): ReadonlyMap<string, StatusPhase> {
  const signature = enabled
    ? JSON.stringify([
        ...statusPhasesOf(
          elements.flatMap((el) =>
            el.type === 'shape' && el.shape === 'plan-board' ? [el.planBoard] : [],
          ),
        ),
      ])
    : '[]';
  return useMemo(() => new Map(JSON.parse(signature) as [string, StatusPhase][]), [signature]);
}
