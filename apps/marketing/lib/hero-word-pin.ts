import { useSyncExternalStore } from 'react';

// The headline's word follows the hero stage (docs/specs/019-marketing/marketing-site.md "Hero"): while
// a mode window is centred the stage pins that window's word (the flowchart's "Diagram", the
// whiteboard's "Whiteboard" and so on) and the headline holds it; on the overview nothing is pinned
// and the headline cycles. A tiny external store, so the stage and the headline (two separate
// client components) share it without a context around the hero.

let pinned: string | null = null;
const listeners = new Set<() => void>();

export function pinHeroWord(word: string | null): void {
  if (word === pinned) return;
  pinned = word;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => pinned;
const none = () => null;

export function useHeroWordPin(): string | null {
  return useSyncExternalStore(subscribe, read, none);
}
