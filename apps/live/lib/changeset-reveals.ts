import { elementBounds, type Element } from '@livediagram/document';

// The outlines a relayed changeset draws around what it touched, in its author's colour, for
// CHANGESET_REVEAL_MS (docs/specs/024-agents/agent-changesets.md "In the editor"). A small external
// store: the changeset feed adds to it, the canvas overlay subscribes to it, and nothing between
// them re-renders for a reveal.

export type ChangesetReveal = {
  changesetId: string;
  tabId: string;
  color: string;
  ids: string[];
  // Epoch ms when the outline goes.
  until: number;
};

export type RevealStore = {
  add: (reveal: ChangesetReveal) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly ChangesetReveal[];
};

const NONE: readonly ChangesetReveal[] = Object.freeze([]);

export function createRevealStore(now: () => number = Date.now): RevealStore {
  let reveals: readonly ChangesetReveal[] = NONE;
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const set = (next: readonly ChangesetReveal[]) => {
    reveals = next.length === 0 ? NONE : next;
    emit();
  };
  return {
    add(reveal) {
      set([...reveals.filter((r) => r.changesetId !== reveal.changesetId), reveal]);
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          set(reveals.filter((r) => r.until > now()));
        },
        Math.max(0, reveal.until - now()),
      );
      timers.add(timer);
    },
    clear() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (reveals !== NONE) set(NONE);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => reveals,
  };
}

// The box around every named element still on the tab, for the toast's Show; null when none is.
export function boundsOfElements(
  elements: Element[],
  ids: readonly string[],
): { x: number; y: number; w: number; h: number } | null {
  const wanted = new Set(ids);
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  for (const el of elements) {
    if (!wanted.has(el.id)) continue;
    const r = elementBounds(el, elements);
    box = box
      ? {
          x0: Math.min(box.x0, r.x),
          y0: Math.min(box.y0, r.y),
          x1: Math.max(box.x1, r.x + r.width),
          y1: Math.max(box.y1, r.y + r.height),
        }
      : { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height };
  }
  return box ? { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 } : null;
}
