import { describe, expect, it } from 'vitest';
import type { ElementLedger, ShapeElement, Tab, TabLedger } from './index';
import {
  ledgerCommentAuthors,
  ledgerKey,
  mergeLedgerIntoTab,
  opForTheWire,
  recordInLedger,
  stampCommentAuthor,
  tabLedgerFrom,
} from './index';

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'card',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});

const tab = (elements: ShapeElement[], over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'T',
  elements,
  ...over,
});

const delta = (d: Record<string, unknown>, elementId = 'card') => ({
  kind: 'el-delta',
  tabId: 't1',
  elementId,
  delta: d,
});
// Record ops in order the way the room does, one seq each.
function ledgerOf(ops: unknown[], startSeq = 1): TabLedger {
  const store = new Map<string, unknown>();
  ops.forEach((op, i) => {
    const key = ledgerKey(op);
    if (!key) return;
    const next = recordInLedger(store.get(key) as ElementLedger | undefined, op, startSeq + i);
    if (next) store.set(key, next);
  });
  return tabLedgerFrom('t1', store);
}

describe('collab ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  it("re-sets a tick the saver hadn't seen", () => {
    const list = card({
      shape: 'checklist',
      checklistItems: [
        { text: 'one', done: false },
        { text: 'two', done: false },
      ],
    });
    const ledger = ledgerOf([
      delta({ kind: 'check', index: 0, text: 'one', done: true }),
      delta({ kind: 'check', index: 1, text: 'two', done: true }),
    ]);
    const merged = mergeLedgerIntoTab(tab([list]), ledger, 1);
    expect((merged.elements[0] as ShapeElement).checklistItems?.map((i) => i.done)).toEqual([
      false,
      true,
    ]);
  });

  it('skips malformed and untracked ops', () => {
    expect(ledgerKey({ kind: 'el', tabId: 't1' })).toBeNull();
    expect(
      recordInLedger(
        undefined,
        delta({ kind: 'response', participantId: 'a', value: 'done', at: 1 }),
        1,
      ),
    ).toBeNull();
    expect(recordInLedger(undefined, delta({ kind: 'comment-add', comment: {} }), 1)).toBeNull();
    expect(
      recordInLedger(
        undefined,
        { kind: 'vote', tabId: 't1', elementId: 'e', voter: 'a', delta: 1 },
        1,
      ),
    ).toBeNull();
  });

  it('returns the same tab when nothing needs merging', () => {
    const save = tab([card()]);
    expect(mergeLedgerIntoTab(save, { elements: {} }, 0)).toBe(save);
  });
});

describe('comments in the ledger (docs/specs/012-collaboration/collab-race-hardening.md)', () => {
  const comment = (id: string, authorName = 'Bea') => ({
    id,
    text: id,
    createdAt: 1,
    authorName,
    authorColor: '#f00',
  });
  const add = (id: string) => delta({ kind: 'comment-add', comment: comment(id) });

  it("puts back a comment the saver hadn't seen, and a delete it hadn't seen", () => {
    const ledger = ledgerOf([
      add('c1'),
      add('c2'),
      delta({ kind: 'comment-remove', commentId: 'c1' }),
    ]);
    const save = tab([card({ commentThread: { comments: [comment('c1')], resolved: false } })]);
    const merged = mergeLedgerIntoTab(save, ledger, 0).elements[0] as ShapeElement;
    expect(merged.commentThread?.comments.map((c) => c.id)).toEqual(['c2']);
  });

  it('replays add and resolve in the order the room took them', () => {
    const ledger = ledgerOf([add('c1'), delta({ kind: 'comment-resolve', resolved: true })]);
    const merged = mergeLedgerIntoTab(tab([card()]), ledger, 0).elements[0] as ShapeElement;
    expect(merged.commentThread?.resolved).toBe(true);
  });

  it('merges a thread on a non-shape element too', () => {
    const sticky = {
      id: 'card',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } as unknown as ShapeElement;
    const merged = mergeLedgerIntoTab(tab([sticky]), ledgerOf([add('c1')]), 0);
    expect((merged.elements[0] as ShapeElement).commentThread?.comments).toHaveLength(1);
  });

  it('knows who posted each comment', () => {
    expect([...ledgerCommentAuthors(ledgerOf([add('c1')])).entries()]).toEqual([
      ['c1', { authorName: 'Bea', authorColor: '#f00' }],
    ]);
  });

  it("stamps a posted comment with its session's name, after the wire strip drops its author id", () => {
    const op = delta({ kind: 'comment-add', comment: { ...comment('c1', 'Boss'), authorId: 'x' } });
    const stamped = stampCommentAuthor(opForTheWire(op), { name: 'Bea', color: '#0f0' }) as {
      delta: { comment: Record<string, unknown> };
    };
    expect(stamped.delta.comment).toMatchObject({ authorName: 'Bea', authorColor: '#0f0' });
    expect('authorId' in stamped.delta.comment).toBe(false);
  });
});
