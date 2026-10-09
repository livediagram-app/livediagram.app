// The maximised Plan element (docs/specs/026-plan/plan-board.md "Maximised board", plan-views.md "Maximised
// view"): which board or visualisation, if any, this person has filling the canvas area (the editor's header, tab
// bar, footer, palette and panels stay; no zen chrome). A view for them alone: a module store, never synced, saved
// or undone. A board filling its tab (plan-board.md "Fill Tab") is not this: it is the board's own setting.
import { useSyncExternalStore } from 'react';
import { track } from '@/lib/telemetry';

// What is maximised, which names its telemetry (BoardMaximised, ViewRestored...).
export type MaximisedKind = 'Board' | 'View';

let current: { id: string; kind: MaximisedKind } | null = null;
// Restoring: the element shrinks back to its place (MaximisedPlanLayer) before it stops being maximised.
let closing = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function set(next: { id: string; kind: MaximisedKind } | null): void {
  if (next?.id === current?.id && !closing) return;
  current = next;
  closing = false;
  notify();
}

export function isMaximisedPlanClosing(): boolean {
  return closing;
}

export function getMaximisedPlanId(): string | null {
  return current?.id ?? null;
}

// What is maximised: a board, a view, or nothing.
export function getMaximisedPlanKind(): MaximisedKind | null {
  return current?.kind ?? null;
}

export function subscribeMaximisedPlan(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The person maximises a board or a view (its header's Maximise button).
export function maximisePlanElement(id: string, kind: MaximisedKind = 'Board'): void {
  if (current?.id === id && !closing) return;
  track('Plan', 'Toggled', `${kind}Maximised`);
  set({ id, kind });
}

// The person restores it (Restore, or Escape): it starts closing, and the layer ends it once it has shrunk back
// (finishRestore), at once under reduced motion.
export function restorePlanElement(): void {
  if (current === null || closing) return;
  track('Plan', 'Toggled', `${current.kind}Restored`);
  closing = true;
  notify();
}

// The shrink back has finished: the element is on the canvas again.
export function finishRestore(): void {
  if (closing) set(null);
}

// The element left the screen or Plan mode: it stops being maximised, with no telemetry (the person did
// not ask). Only that element: another one maximised since is left alone.
export function releasePlanElement(id: string): void {
  if (current?.id === id) set(null);
}

export function useMaximisedPlanId(): string | null {
  return useSyncExternalStore(subscribeMaximisedPlan, getMaximisedPlanId, () => null);
}

export function useMaximisedPlanClosing(): boolean {
  return useSyncExternalStore(subscribeMaximisedPlan, isMaximisedPlanClosing, () => false);
}
