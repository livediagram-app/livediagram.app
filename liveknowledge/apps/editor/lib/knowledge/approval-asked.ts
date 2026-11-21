// The page whose approval was just asked for from the page menu (docs/specs/030-knowledgebase/approval.md "Asking"):
// Page Health's Approval section stays hidden on a page with no approval until then (owner 2026-11-21: "don't show
// it in the sidebar till it's activated"), and shows its request form for that page once asked. One page at a time.
import { useSyncExternalStore } from 'react';

let asked: string | null = null;
const listeners = new Set<() => void>();

/** Ask for this page's approval: its Page Health opens its request form. */
export function askApproval(pageId: string): void {
  asked = pageId;
  listeners.forEach((l) => l());
}

/** The ask was sent or put away. */
export function clearApprovalAsk(): void {
  if (asked === null) return;
  asked = null;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether this page's approval was just asked for. */
export function useApprovalAsked(pageId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => asked === pageId,
    () => false,
  );
}
