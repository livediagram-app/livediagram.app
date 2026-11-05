import { describe, expect, it } from 'vitest';
import type { ElementLedger, ShapeElement, Tab, TabLedger, VoteLedger } from './index';
import {
  ledgerCommentAuthors,
  ledgerKey,
  mergeLedgerAnswersIntoTab,
  mergeLedgerIntoTab,
  opForTheWire,
  recordInLedger,
  RETIRED_ROUNDS_MAX,
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
    const next = recordInLedger(
      store.get(key) as ElementLedger | VoteLedger | undefined,
      op,
      startSeq + i,
    );
    if (next) store.set(key, next);
  });
  return tabLedgerFrom('t1', store);
}

describe('collab ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3)', () => {
  // A retired element's answers and ideas (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"):
  // a delta for one is refused, and a room's old entries are never written onto the element, which keeps its stored
  // fields exactly as they were.
  it('records no answer or idea, and merges none a room still holds', () => {
    expect(
      recordInLedger(
        undefined,
        delta({ kind: 'response', participantId: 'a', value: '3', at: 1 }),
        1,
      ),
    ).toBeNull();
    expect(recordInLedger(undefined, delta({ kind: 'idea', text: 'coffee' }), 1)).toBeNull();
    const stored = {
      ...card(),
      shape: 'estimate',
      responses: [{ participantId: 'a', value: '3', at: 1 }],
      collabRound: 'r1',
    } as unknown as ShapeElement;
    const old = {
      round: 'r1',
      responses: { b: { value: '5', at: 2, seq: 9 } },
      ideas: ['tea'],
    } as unknown as ElementLedger;
    const save = tab([stored]);
    expect(mergeLedgerIntoTab(save, { elements: { card: old } }, 0)).toBe(save);
    expect(mergeLedgerAnswersIntoTab(save, { elements: { card: old } })).toBe(save);
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

  // A late op naming a round the room has moved past used to flip the vote
  // back to that round, dropping the current round's dots.
  it('drops a late dot or withdraw naming a retired vote round', () => {
    const dot = (voter: string, round: string, d: 1 | -1 = 1) => ({
      kind: 'vote',
      tabId: 't1',
      elementId: 'e1',
      voter,
      delta: d,
      round,
    });
    const ledger = ledgerOf([dot('a', 'r1'), dot('b', 'r2'), dot('a', 'r1', -1), dot('c', 'r1')]);
    expect(ledger.vote).toMatchObject({ round: 'r2', votes: { e1: ['b'] }, retired: ['r1'] });
  });

  it(`remembers at most ${RETIRED_ROUNDS_MAX} retired rounds`, () => {
    const ops = Array.from({ length: RETIRED_ROUNDS_MAX + 5 }, (_, i) => ({
      kind: 'vote',
      tabId: 't1',
      elementId: 'e1',
      voter: 'a',
      delta: 1,
      round: `r${i}`,
    }));
    const retired = ledgerOf(ops).vote?.retired ?? [];
    expect(retired).toHaveLength(RETIRED_ROUNDS_MAX);
    expect(retired.at(-1)).toBe(`r${RETIRED_ROUNDS_MAX + 3}`);
  });

  it('skips malformed and untracked ops', () => {
    expect(ledgerKey({ kind: 'el', tabId: 't1' })).toBeNull();
    expect(recordInLedger(undefined, delta({ kind: 'check', index: -1 }), 1)).toBeNull();
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

// docs/specs/012-collaboration/session-tools.md "Voting on Plan cards": a dot on a card rides the ledger by its key.
describe('a dot on a Plan card', () => {
  it('records under the card’s vote key', () => {
    const op = {
      kind: 'vote',
      tabId: 't1',
      elementId: 'item:i1',
      voter: 'a',
      delta: 1,
      round: 'r1',
    };
    expect(recordInLedger(undefined, op, 4)).toEqual({
      round: 'r1',
      votes: { 'item:i1': ['a'] },
      seq: 4,
    });
  });
});

describe('mergeLedgerAnswersIntoTab (docs/specs/013-workspace/share-roles.md "Integrity")', () => {
  const dot = (voter: string) => ({
    kind: 'vote',
    tabId: 't1',
    elementId: 'e1',
    voter,
    delta: 1,
    round: 'r1',
  });

  it('writes every dot the room holds into the stored tab, once', () => {
    const ledger = ledgerOf([dot('a')]);
    const vote = { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r1' };
    const stored = tab([card()], { vote });
    const merged = mergeLedgerAnswersIntoTab(stored, ledger);
    expect(merged.vote?.votes).toEqual({ e1: ['a'] });
    expect(mergeLedgerAnswersIntoTab(merged, ledger)).toBe(merged);
  });

  it('leaves ticks, threads and board changes to an Editor', () => {
    const list = card({ shape: 'checklist', checklistItems: [{ text: 'one', done: false }] });
    const ledger = ledgerOf([delta({ kind: 'check', index: 0, text: 'one', done: true })]);
    const stored = tab([list]);
    expect(mergeLedgerAnswersIntoTab(stored, ledger)).toBe(stored);
  });

  it('ignores dots from a round the stored tab has moved past', () => {
    const ledger = ledgerOf([dot('a')]);
    const vote = { active: true, revealed: false, votesPerPerson: 3, votes: {}, round: 'r2' };
    const stored = tab([card()], { vote });
    expect(mergeLedgerAnswersIntoTab(stored, ledger)).toBe(stored);
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
    // A saver who had seen everything up to seq 4 keeps its own copy.
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
    // A change to a reaction already counted still lands.
    const changed = ledgerOf([...many, react('p0', false)]);
    expect(Object.values(changed.elements.card!.comments!.reacts!)[0]!.on).toBe(false);
  });

  it("writes a Participant's reactions into the stored tab, and nothing else of the thread", () => {
    const ledger = ledgerOf([react('a'), delta({ kind: 'comment-resolve', resolved: true })]);
    const merged = mergeLedgerAnswersIntoTab(tab([thread()]), ledger);
    expect(reactors(merged)).toEqual(['thumbs-up:a']);
    expect((merged.elements[0] as ShapeElement).commentThread?.resolved).toBe(false);
    expect(mergeLedgerAnswersIntoTab(merged, ledger)).toBe(merged);
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
