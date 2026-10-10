import { describe, expect, it } from 'vitest';
import type { Element, ElementDelta, ElementLedger, ShapeElement, Tab } from './index';
import {
  IDEA_MAX_CARDS,
  applyElementDelta,
  ledgerKey,
  mergeLedgerIntoTab,
  recordInLedger,
  tabLedgerFrom,
  yieldIdeaToPeer,
} from './index';

// Two people race for an idea box's last card (docs/specs/012-collaboration/idea-box.md "Racing for the last
// card", blueprint idea-box-race.md). The room numbers A's post first. Each browser applies its own post at
// the press, then the room's frames in the room's order; a poster's own post is pending until the room's
// cursor answers it. Every copy, and the D1 copy a save merges with the ledger, must end the same.

const box = (): ShapeElement => ({
  id: 'box',
  type: 'shape',
  shape: 'idea-box',
  x: 0,
  y: 0,
  width: 340,
  height: 420,
  ideaCards: Array.from({ length: IDEA_MAX_CARDS - 1 }, (_, i) => `seed ${i}`),
});

const postA: ElementDelta = { kind: 'idea', text: 'From A', id: 'a-card' };
const postB: ElementDelta = { kind: 'idea', text: 'From B', id: 'b-card' };

// One browser: its box, its own pending card ids, and the posts it lost.
class Browser {
  el: Element = box();
  pending: string[] = [];
  refused: string[] = [];
  post(delta: ElementDelta & { kind: 'idea' }) {
    this.el = applyElementDelta(this.el, delta);
    this.pending.push(delta.id!);
  }
  // The room's cursor for this browser's own post.
  answered(id: string) {
    this.pending = this.pending.filter((p) => p !== id);
  }
  peer(delta: ElementDelta) {
    const { el, yielded } = yieldIdeaToPeer(this.el, delta, this.pending);
    this.el = el;
    if (yielded) {
      this.pending = this.pending.filter((p) => p !== yielded);
      this.refused.push(yielded);
    }
  }
}

const cards = (b: Browser) => (b.el as ShapeElement).ideaCards!;

describe('two posters racing for the last card', () => {
  it('ends every copy with the first card the room numbered, and refuses the second to its poster', () => {
    const a = new Browser();
    const b = new Browser();
    const watcher = new Browser();
    a.post(postA as ElementDelta & { kind: 'idea' });
    b.post(postB as ElementDelta & { kind: 'idea' });
    // Both posters see their own card as the 300th.
    expect(cards(a).at(-1)).toBe('From A');
    expect(cards(b).at(-1)).toBe('From B');

    // The room numbers A's post: A gets its cursor, the others the frame.
    a.answered('a-card');
    b.peer(postA);
    watcher.peer(postA);
    // Then B's: B gets its cursor (nothing left pending), the others the frame, refused at the cap.
    b.answered('b-card');
    a.peer(postB);
    watcher.peer(postB);

    for (const copy of [a, b, watcher]) {
      expect(cards(copy)).toHaveLength(IDEA_MAX_CARDS);
      expect(cards(copy).at(-1)).toBe('From A');
      expect(cards(copy)).not.toContain('From B');
    }
    expect(b.refused).toEqual(['b-card']);
    expect(a.refused).toEqual([]);
    expect(watcher.refused).toEqual([]);
    expect((b.el as ShapeElement).ideaCardIds?.at(-1)).toBe('a-card');
  });

  it('settles the D1 copy the same way, whichever of B’s copies a save carries', () => {
    const ops = [postA, postB].map((d) => ({
      kind: 'el-delta',
      tabId: 't1',
      elementId: 'box',
      delta: d,
    }));
    const store = new Map<string, unknown>();
    ops.forEach((op, i) => {
      const key = ledgerKey(op)!;
      const next = recordInLedger(store.get(key) as ElementLedger | undefined, op, i + 1);
      if (next) store.set(key, next);
    });
    const ledger = tabLedgerFrom('t1', store);
    const save = (el: Element): string[] => {
      const tab: Tab = { id: 't1', name: 'T', elements: [el] };
      return (mergeLedgerIntoTab(tab, ledger, 0).elements[0] as ShapeElement).ideaCards!;
    };
    const before = applyElementDelta(box(), postB);
    // A save made before B's copy yielded still carries B's card (the merge cannot add A at the cap) ...
    expect(save(before).at(-1)).toBe('From B');
    // ... and B's next save, after the yield, carries A's.
    const after = yieldIdeaToPeer(before, postA, ['b-card']).el;
    const settled = save(after);
    expect(settled).toHaveLength(IDEA_MAX_CARDS);
    expect(settled.at(-1)).toBe('From A');
    expect(settled).not.toContain('From B');
  });
});
