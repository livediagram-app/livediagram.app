import { describe, expect, it } from 'vitest';
import type { ElementLedger, ShapeElement, Tab, TabLedger, VoteLedger } from './index';
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
  shape: 'done-check',
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
const done = (participantId: string, value: string | null = 'done') =>
  delta({ kind: 'response', participantId, value, at: 1 });

// Record ops in order the way the room does, one seq each.
function ledgerOf(ops: unknown[], startSeq = 1): TabLedger {
  const store = new Map<string, unknown>();
  ops.forEach((op, i) => {
    const key = ledgerKey(op);
    if (!key) return;
    const next = recordInLedger(
      store.get(key) as ElementLedger | VoteLedger | undefined,
      op,
      startSeq + i,
    );
    if (next) store.set(key, next);
  });
  return tabLedgerFrom('t1', store);
}

const who = (t: Tab) =>
  ((t.elements[0] as ShapeElement).responses ?? []).map((r) => r.participantId).sort();

describe('collab ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  // THE bug: a save snapshotted before b's mark reached the saver wrote D1
  // without it.
  it("puts back an answer the saver hadn't seen", () => {
    const ledger = ledgerOf([done('a'), done('b')]);
    const staleSave = tab([card({ responses: [{ participantId: 'a', value: 'done', at: 1 }] })]);
    // The saver had seen seq 1 (its own cast), not seq 2.
    expect(who(mergeLedgerIntoTab(staleSave, ledger, 1))).toEqual(['a', 'b']);
  });

  it('does not overrule what the saver HAD seen (a withdraw made offline stays)', () => {
    // a cast (seq 1), then withdrew with the socket down: the room never
    // heard, and the save is the newer truth.
    const ledger = ledgerOf([done('a')]);
    expect(who(mergeLedgerIntoTab(tab([card()]), ledger, 1))).toEqual([]);
  });

  it('applies a withdraw it had not seen', () => {
    const ledger = ledgerOf([done('a'), done('a', null)]);
    const stale = tab([card({ responses: [{ participantId: 'a', value: 'done', at: 1 }] })]);
    expect(who(mergeLedgerIntoTab(stale, ledger, 1))).toEqual([]);
  });

  it('ignores answers from another round than the save (a clear it had not seen)', () => {
    const ledger = ledgerOf([done('a')]);
    const cleared = tab([card({ collabRound: 'r2', responses: [] })]);
    expect(who(mergeLedgerIntoTab(cleared, ledger, 0))).toEqual([]);
  });

  it('appends ideas the snapshot is missing, without duplicating ones it has', () => {
    const box = (ideaCards: string[]) => tab([card({ shape: 'idea-box', ideaCards })]);
    const ledger = ledgerOf([
      delta({ kind: 'idea', text: 'coffee' }),
      delta({ kind: 'idea', text: 'tea' }),
      delta({ kind: 'idea', text: 'coffee' }),
    ]);
    const merged = mergeLedgerIntoTab(box(['coffee']), ledger, 0);
    expect((merged.elements[0] as ShapeElement).ideaCards).toEqual(['coffee', 'tea', 'coffee']);
  });

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

  it("replaces the round's dots when some arrived after the saver's cursor", () => {
    const dot = (voter: string, round = 'r1') => ({
      kind: 'vote',
      tabId: 't1',
      elementId: 'e1',
      voter,
      delta: 1,
      round,
    });
    const ledger = ledgerOf([dot('a'), dot('b')]);
    const vote = { active: true, revealed: false, votesPerPerson: 3, votes: { e1: ['a'] } };
    const save = tab([], { vote: { ...vote, round: 'r1' } });
    expect(mergeLedgerIntoTab(save, ledger, 1).vote?.votes).toEqual({ e1: ['a', 'b'] });
    // Seen everything: the save stands.
    expect(mergeLedgerIntoTab(save, ledger, 2)).toBe(save);
    // Another round: ignored.
    const next = tab([], { vote: { ...vote, votes: {}, round: 'r2' } });
    expect(mergeLedgerIntoTab(next, ledger, 0)).toBe(next);
  });

  it('skips malformed and untracked ops', () => {
    expect(ledgerKey({ kind: 'el', tabId: 't1' })).toBeNull();
    expect(recordInLedger(undefined, delta({ kind: 'response', participantId: 7 }), 1)).toBeNull();
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
