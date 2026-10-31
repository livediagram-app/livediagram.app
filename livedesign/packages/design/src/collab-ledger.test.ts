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

describe('reactions in the ledger (docs/specs/012-collaboration/comment-reactions.md)', () => {
  const comment = { id: 'c1', text: 'hi', createdAt: 1, authorName: 'Bea', authorColor: '#f00' };
  const thread = () => card({ commentThread: { comments: [comment], resolved: false } });
  const react = (by: string, on = true, emoji = 'thumbs-up') =>
    delta({ kind: 'comment-react', commentId: 'c1', emoji, by, name: by.toUpperCase(), on });
  const reactors = (t: Tab) =>
    ((t.elements[0] as ShapeElement).commentThread?.comments[0]?.reactions ?? []).map(
      (r) => `${r.emoji}:${r.by}`,
    );

  it("puts back a reaction the saver hadn't seen, and keeps each person's latest", () => {
    const ledger = ledgerOf([react('a'), react('b'), react('a', false), react('b', true, 'eyes')]);
    expect(reactors(mergeLedgerIntoTab(tab([thread()]), ledger, 0))).toEqual([
      'thumbs-up:b',
      'eyes:b',
    ]);
    const stored = tab([thread()]);
    expect(mergeLedgerIntoTab(stored, ledger, 4)).toBe(stored);
  });

  it('refuses a malformed reaction, and one past the thread bound', () => {
    expect(ledgerOf([react('a', true, 'rocket')]).elements).toEqual({});
    expect(
      ledgerOf([delta({ kind: 'comment-react', commentId: 'c1', emoji: 'eyes', by: 'a' })])
        .elements,
    ).toEqual({});
    const many = Array.from({ length: 500 }, (_, i) => react(`p${i}`));
    const full = ledgerOf([...many, react('late')]);
    expect(Object.keys(full.elements.card!.comments!.reacts!)).toHaveLength(500);
    const changed = ledgerOf([...many, react('p0', false)]);
    expect(Object.values(changed.elements.card!.comments!.reacts!)[0]!.on).toBe(false);
  });

  it("stamps a reaction with the session's name and key", () => {
    const op = delta({
      kind: 'comment-react',
      commentId: 'c1',
      emoji: 'eyes',
      by: 'someone-else',
      name: 'Boss',
      on: true,
    });
    const stamped = stampCommentAuthor(op, { name: 'Bea', color: '#0f0', key: 'k-bea' }) as {
      delta: Record<string, unknown>;
    };
    expect(stamped.delta).toMatchObject({ name: 'Bea', by: 'k-bea' });
    const keyless = stampCommentAuthor(op, { name: 'Bea', color: '#0f0' }) as {
      delta: Record<string, unknown>;
    };
    expect(keyless.delta).toMatchObject({ name: 'Bea', by: 'someone-else' });
  });
});
