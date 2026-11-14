import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { CommentReaction } from '@liveworkspace/model-core/comment-reactions';
import type { Comment, ElementLedger, ShapeElement, Tab, TabLedger, TabVote } from './index';
import { lockWholeTab, wholeTabLockNeeds, type WholeTabWriter } from './index';

// Collab keys are 32 hex; an old editor's browser key is a UUID.
const ME = 'a'.repeat(32);
const ANA = 'b'.repeat(32);
const SAM = 'c'.repeat(32);
const OLD = '6f2c1d3e-9a7b-4c5d-8e1f-0a2b3c4d5e6f';
const me: WholeTabWriter = { key: ME, isDerivedKey: (k) => /^[0-9a-f]{32}$/.test(k) };
const agent: WholeTabWriter = { ...me, key: null };
const EMPTY: TabLedger = { elements: {} };

const react = (
  by: string,
  name = by === ME ? 'Me' : 'Ana',
  emoji: CommentReaction['emoji'] = 'heart',
) => ({ emoji, by, name }) as CommentReaction;
const comment = (reactions?: CommentReaction[], id = 'c1'): Comment => ({
  id,
  text: 'hi',
  createdAt: 1,
  authorName: 'Bea',
  authorColor: '#f00',
  ...(reactions ? { reactions } : {}),
});
const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'card',
  type: 'shape',
  shape: 'estimate',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});
const threaded = (reactions?: CommentReaction[], over: Partial<ShapeElement> = {}) =>
  card({ commentThread: { comments: [comment(reactions)], resolved: false }, ...over });
const tab = (elements: ShapeElement[], vote?: TabVote): Tab => ({
  id: 't1',
  name: 'T',
  elements,
  ...(vote ? { vote } : {}),
});
const vote = (votes: Record<string, string[]>, round = 'r1'): TabVote => ({
  active: true,
  revealed: false,
  votesPerPerson: 3,
  votes,
  round,
});
const ledger = (entry: ElementLedger, voteEntry?: TabLedger['vote']): TabLedger => ({
  elements: { card: entry },
  ...(voteEntry ? { vote: voteEntry } : {}),
});
const reactionsOf = (t: Tab) =>
  (t.elements[0] as ShapeElement).commentThread?.comments[0]?.reactions?.map((r) => r.by);
const answers = (t: Tab) => (t.elements[0] as ShapeElement).responses;

// The two steps as the api runs them: read the ledger only for what the needs name.
function write(written: Tab, stored: Tab | null, full: TabLedger, writer: WholeTabWriter = me) {
  const needs = wholeTabLockNeeds(written, stored, writer.key);
  const handed: TabLedger = {
    elements: Object.fromEntries(
      needs.elementIds.flatMap((id) => {
        const entry = full.elements[id];
        return entry ? [[id, entry] as const] : [];
      }),
    ),
    ...(needs.vote && full.vote ? { vote: full.vote } : {}),
  };
  return { needs, tab: lockWholeTab(written, stored, handed, writer, needs) };
}

describe('wholeTabLockNeeds', () => {
  it('needs nothing when the write changes only the writer', () => {
    const stored = tab([threaded([react(ANA)])], vote({ card: [ANA] }));
    const written = tab([threaded([react(ANA), react(ME)])], vote({ card: [ANA, ME] }));
    expect(wholeTabLockNeeds(written, stored, ME)).toEqual({ elementIds: [], vote: false });
    expect(
      wholeTabLockNeeds(tab([card(), { ...card(), id: 'x', type: 'shape' }]), null, ME),
    ).toEqual({ elementIds: [], vote: false });
  });

  it("names the elements and the vote where someone else's entry differs", () => {
    const stored = tab([threaded()], vote({}));
    const written = tab(
      [
        threaded([react(ANA)]),
        card({ id: 'est', responses: [{ participantId: ANA, value: '3', at: 1 }] }),
      ],
      vote({ card: [ANA] }),
    );
    expect(wholeTabLockNeeds(written, stored, ME)).toEqual({
      elementIds: ['card', 'est'],
      vote: true,
    });
  });
});

describe('lockWholeTab: reactions', () => {
  it('keeps the same tab when nobody else changes', () => {
    const stored = tab([threaded([react(ANA)])]);
    const written = tab([threaded([react(ME), react(ANA)])]);
    expect(write(written, stored, EMPTY).tab).toBe(written);
  });

  it("drops a reaction made up in someone else's name, and puts back one taken away", () => {
    const stored = tab([threaded([react(SAM, 'Sam')])]);
    expect(reactionsOf(write(tab([threaded([react(ANA), react(ME)])]), stored, EMPTY).tab)).toEqual(
      [ME, SAM],
    );
  });

  it("keeps someone else's live reaction the ledger has on, and takes one the ledger has off", () => {
    const entry: ElementLedger = {
      comments: {
        adds: {},
        removes: {},
        reacts: {
          [`c1\u0000heart\u0000${ANA}`]: { on: true, name: 'Ana', seq: 4 },
          [`c1\u0000heart\u0000${SAM}`]: { on: false, name: 'Sam', seq: 5 },
        },
      },
    };
    const stored = tab([threaded([react(SAM, 'Sam')])]);
    const written = tab([threaded([react(ANA), react(SAM, 'Sam')])]);
    expect(reactionsOf(write(written, stored, ledger(entry)).tab)).toEqual([ANA]);
  });

  it('locks a new tab in a stored document: nobody else has entries there yet', () => {
    expect(reactionsOf(write(tab([threaded([react(ANA)])]), null, EMPTY).tab)).toBeUndefined();
  });

  it("lets an agent's token change nobody's reaction", () => {
    const stored = tab([threaded([react(ME)])]);
    const written = tab([threaded([])]);
    expect(reactionsOf(write(written, stored, EMPTY, agent).tab)).toEqual([ME]);
  });

  it("collapses an old editor's duplicate beside the person's derived key", () => {
    const stored = tab([threaded([react(OLD, 'Ana'), react(ANA)])]);
    const written = tab([threaded([react(OLD, 'Ana'), react(ANA)])]);
    expect(reactionsOf(write(written, stored, EMPTY).tab)).toEqual([ANA]);
  });

  it('leaves an element without a thread, and a thread without comments, alone', () => {
    const empty = card({ commentThread: { comments: [], resolved: false } });
    const written = tab([empty]);
    expect(write(written, tab([empty]), EMPTY).tab).toBe(written);
  });
});

describe('lockWholeTab: responses', () => {
  const answer = (participantId: string, value = '3', at = 1) => ({ participantId, value, at });

  it("keeps the writer's own answer and the stored answers of everyone else", () => {
    const stored = tab([card({ responses: [answer(ANA, '5')] })]);
    const written = tab([card({ responses: [answer(ME, '8'), answer(ANA, '1'), answer(SAM)] })]);
    expect(answers(write(written, stored, EMPTY).tab)).toEqual([answer(ME, '8'), answer(ANA, '5')]);
  });

  it("takes someone else's live answer from the ledger's round, never another round's", () => {
    const written = tab([card({ collabRound: 'r2', responses: [answer(ANA, '2', 9)] })]);
    const live = ledger({ round: 'r2', responses: { [ANA]: { value: '2', at: 9, seq: 3 } } });
    expect(write(written, null, live).tab).toBe(written);
    const stale = ledger({ round: 'r1', responses: { [ANA]: { value: '2', at: 9, seq: 3 } } });
    expect(answers(write(written, null, stale).tab)).toBeUndefined();
  });

  it('lets a clear empty the round for everyone, and drops answers made up in the new round', () => {
    const stored = tab([card({ collabRound: 'r1', responses: [answer(ANA)] })]);
    const cleared = tab([card({ collabRound: 'r2' })]);
    expect(write(cleared, stored, EMPTY).tab).toBe(cleared);
    const forged = tab([card({ collabRound: 'r2', responses: [answer(ANA)] })]);
    expect(answers(write(forged, stored, EMPTY).tab)).toBeUndefined();
  });
});

describe('lockWholeTab: dots', () => {
  it("keeps other people's dots as the stored round has them", () => {
    const stored = tab([card()], vote({ card: [ANA] }));
    const written = tab([card()], vote({ card: [ME, ANA, ANA, SAM] }));
    expect(write(written, stored, EMPTY).tab.vote?.votes).toEqual({ card: [ANA, ME] });
  });

  it("takes the ledger's round map when it has the round, and a new round starts empty", () => {
    const stored = tab([card()], vote({ card: [ANA] }));
    const written = tab([card()], vote({ card: [SAM] }));
    const live = { elements: {}, vote: { round: 'r1', votes: { card: [SAM, ANA] }, seq: 4 } };
    expect(write(written, stored, live).tab.vote?.votes).toEqual({ card: [SAM, ANA] });
    const fresh = tab([card()], vote({ card: [ANA] }, 'r2'));
    expect(write(fresh, stored, live).tab.vote?.votes).toEqual({ card: [] });
    // A save already holding the ledger's live dots keeps its own tab.
    const caughtUp = tab([card()], vote({ card: [SAM, ANA] }));
    expect(write(caughtUp, stored, live).tab).toBe(caughtUp);
  });

  it('leaves a tab with no vote alone, and one whose dots only the writer moved', () => {
    const written = tab([card()]);
    expect(write(written, tab([card()], vote({ card: [ANA] })), EMPTY).tab).toBe(written);
    const mine = tab([card()], vote({ card: [ANA, ME] }));
    expect(write(mine, tab([card()], vote({ card: [ANA] })), EMPTY).tab).toBe(mine);
  });

  it("locks the reactions on any element's thread, a sticky's too", () => {
    const sticky = (reactions: CommentReaction[]) =>
      ({
        ...threaded(reactions),
        type: 'sticky',
        text: 'note',
      }) as unknown as ShapeElement;
    const out = write(tab([sticky([react(ANA)])]), tab([sticky([])]), EMPTY).tab;
    expect(reactionsOf(out)).toBeUndefined();
  });
});

describe('lockWholeTab: cost', () => {
  it('walks a 2,000-element tab with threads and answers within budget', () => {
    const elements = Array.from({ length: 2_000 }, (_, i) =>
      card({
        id: `e${i}`,
        responses: [{ participantId: ANA, value: '3', at: 1 }],
        commentThread: { comments: [comment([react(ANA), react(SAM, 'Sam')])], resolved: false },
      }),
    );
    const stored = tab(elements);
    const written = tab(elements.map((e) => ({ ...e })));
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 5; i++) {
        const needs = wholeTabLockNeeds(written, stored, ME);
        lockWholeTab(written, stored, EMPTY, me, needs);
        expect(needs.elementIds).toHaveLength(0);
      }
    });
    expect(ms / 5).toBeLessThan(cpuBudgetMs(25));
  });
});
