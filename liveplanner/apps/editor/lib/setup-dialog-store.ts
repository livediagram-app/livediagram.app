// Setup Board and Setup Sheet as dialogs (docs/specs/026-plan/plan-board.md "Setup Board", docs/specs/029-sheets/sheet.md
// "Setup Sheet"): which one is open, for this person only, and what they had picked. Never synced, never on
// PlanContext, so opening one re-renders only the board or Sheet it is for. Main bundle, and tiny: the dialogs
// themselves load with their element's chunk, only when opened.
//
// Keys are a board's element id or a Sheet's sheet id (both UUIDs, so they never collide).
import { useSyncExternalStore } from 'react';

// The dialog open now: its key, and whether it was asked for again on a board already set up (Board Setup's Setup
// Board), which starts from the board as it is rather than from a draft.
type Open = { key: string; again: boolean };

let open: Open | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function openSetup(key: string, opts: { again?: boolean } = {}): void {
  const again = opts.again === true;
  if (open?.key === key && open.again === again) return;
  open = { key, again };
  emit();
}

// Closes the dialog for `key` (any open one without a key). Placed here once, it no longer opens by itself.
export function closeSetup(key?: string): void {
  const forgot = !!key && placedHere.delete(key);
  if (!open || (key && open.key !== key)) {
    if (forgot) emit();
    return;
  }
  open = null;
  emit();
}

// How the dialog for `key` is open: 'new', 'again', or null. A string, so the snapshot is stable between renders.
export function useSetupOpen(key: string): 'new' | 'again' | null {
  return useSyncExternalStore(
    subscribe,
    () => (open?.key === key ? (open.again ? 'again' : 'new') : null),
    () => null,
  );
}

// Elements this person placed and has not set up or dismissed yet: their dialog opens by itself the first time they
// draw unset (a peer's, a template's or an undone one shows the placeholder only). Kept until the dialog closes, so a
// remount (React's development double effects, a maximise) opens it again rather than losing it. Subscribed to, so a
// mark made after the element first draws (its add is seen a render later) still opens it.
const placedHere = new Set<string>();

export function markPlacedHere(key: string): void {
  if (placedHere.has(key)) return;
  placedHere.add(key);
  emit();
}

export function usePlacedHere(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => placedHere.has(key),
    () => false,
  );
}

// What was picked in a dialog closed before it finished (its step and choices), to start from when it opens again
// this session. Bounded: the oldest goes past SETUP_DRAFTS_MAX (a person sets up a handful of things at a time).
export const SETUP_DRAFTS_MAX = 20;
const drafts = new Map<string, unknown>();

export function saveSetupDraft(key: string, draft: unknown): void {
  drafts.delete(key);
  drafts.set(key, draft);
  if (drafts.size > SETUP_DRAFTS_MAX) drafts.delete(drafts.keys().next().value as string);
}

export function readSetupDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function dropSetupDraft(key: string): void {
  drafts.delete(key);
}

// Tests only: everything back to the start.
export function resetSetupDialogs(): void {
  open = null;
  placedHere.clear();
  drafts.clear();
  emit();
}
