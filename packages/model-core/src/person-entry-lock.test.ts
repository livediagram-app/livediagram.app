import { describe, expect, it } from 'vitest';
import type { CommentReaction } from './comment-reactions';
import {
  collapseLegacyReactions,
  foreignDotsDiffer,
  foreignEntriesDiffer,
  lockDots,
  lockEntries,
  lockedEntry,
  REACTION_KEYS,
  reactionWords,
  RESPONSE_KEYS,
  responseWords,
  type LedgerWord,
  type PersonResponse,
} from './person-entry-lock';

const ME = 'a'.repeat(32);
const ANA = 'b'.repeat(32);
const SAM = 'c'.repeat(32);
const r = (by: string, emoji: CommentReaction['emoji'] = 'heart', name = by.slice(0, 1)) =>
  ({ emoji, by, name }) as CommentReaction;
const words = (...pairs: [CommentReaction, boolean][]) =>
  new Map<string, LedgerWord<CommentReaction>>(
    pairs.map(([value, on]) => [
      REACTION_KEYS.slotOf(value),
      on ? { on: true, value } : { on: false },
    ]),
  );
const none = new Map<string, LedgerWord<CommentReaction>>();

describe('lockedEntry', () => {
  it("takes the writer's own as written, and anyone else's from the ledger, else the stored tab", () => {
    expect(lockedEntry(1, 2, { on: true, value: 3 }, true)).toBe(1);
    expect(lockedEntry(1, 2, { on: true, value: 3 }, false)).toBe(3);
    expect(lockedEntry(1, 2, { on: false }, false)).toBeUndefined();
    expect(lockedEntry(1, 2, undefined, false)).toBe(2);
    expect(lockedEntry(1, undefined, undefined, false)).toBeUndefined();
  });
});

describe('lockEntries: reactions', () => {
  it('keeps the same list when the write changes nobody else', () => {
    const written = [r(ME), r(ANA)];
    expect(lockEntries(written, [r(ANA)], none, REACTION_KEYS, ME)).toBe(written);
    expect(lockEntries(undefined, undefined, none, REACTION_KEYS, ME)).toBeUndefined();
  });

  it("drops a reaction the writer made up in someone else's name", () => {
    expect(lockEntries([r(ME), r(ANA)], [], none, REACTION_KEYS, ME)).toEqual([r(ME)]);
    expect(lockEntries([r(ANA)], undefined, none, REACTION_KEYS, ME)).toBeUndefined();
  });

  it("puts back someone else's reaction the writer took away, at the end", () => {
    expect(lockEntries([r(ME)], [r(ANA), r(ME)], none, REACTION_KEYS, ME)).toEqual([r(ME), r(ANA)]);
  });

  it("keeps someone else's live reaction the stored tab lacks, when the ledger has it on", () => {
    const written = [r(ANA), r(ME)];
    expect(lockEntries(written, [], words([r(ANA), true]), REACTION_KEYS, ME)).toBe(written);
  });

  it('takes away one the ledger has off, though the stored tab still holds it', () => {
    expect(
      lockEntries([r(ANA)], [r(ANA)], words([r(ANA), false]), REACTION_KEYS, ME),
    ).toBeUndefined();
  });

  it('restores one only the ledger knows, and a changed one as the ledger or stored tab has it', () => {
    const renamed = { ...r(ANA), name: 'Not Ana' };
    expect(lockEntries([renamed], [r(ANA)], none, REACTION_KEYS, ME)).toEqual([r(ANA)]);
    expect(lockEntries([], [], words([r(SAM), true]), REACTION_KEYS, ME)).toEqual([r(SAM)]);
    expect(lockEntries([], [], words([r(SAM), false]), REACTION_KEYS, ME)).toEqual([]);
  });

  it("lets the writer add and take back their own, and a null writer change nobody's", () => {
    expect(lockEntries([], [r(ME)], none, REACTION_KEYS, ME)).toEqual([]);
    expect(lockEntries([], [r(ME)], words([r(ME), true]), REACTION_KEYS, ME)).toEqual([]);
    expect(lockEntries([r(ME)], [], none, REACTION_KEYS, null)).toBeUndefined();
    expect(lockEntries([], [r(ME)], none, REACTION_KEYS, null)).toEqual([r(ME)]);
  });

  it('keeps one entry per slot', () => {
    expect(lockEntries([r(ME), r(ME)], [], none, REACTION_KEYS, ME)).toEqual([r(ME)]);
    expect(lockEntries([r(ANA)], [r(ANA), r(ANA)], none, REACTION_KEYS, ME)).toEqual([r(ANA)]);
  });
});

describe('foreignEntriesDiffer', () => {
  it("is false only when everyone else's entries match the stored ones", () => {
    expect(foreignEntriesDiffer([r(ME), r(ANA)], [r(ANA)], REACTION_KEYS, ME)).toBe(false);
    expect(foreignEntriesDiffer(undefined, undefined, REACTION_KEYS, ME)).toBe(false);
    expect(foreignEntriesDiffer([], [r(ME)], REACTION_KEYS, ME)).toBe(false);
    expect(foreignEntriesDiffer([r(ANA)], [], REACTION_KEYS, ME)).toBe(true);
    expect(foreignEntriesDiffer([], [r(ANA)], REACTION_KEYS, ME)).toBe(true);
    expect(foreignEntriesDiffer([{ ...r(ANA), name: 'x' }], [r(ANA)], REACTION_KEYS, ME)).toBe(
      true,
    );
    expect(foreignEntriesDiffer([r(ME)], [], REACTION_KEYS, null)).toBe(true);
    expect(foreignEntriesDiffer(undefined, [r(ANA)], REACTION_KEYS, ME)).toBe(true);
    // The same entries in another order change nobody.
    expect(foreignEntriesDiffer([r(SAM), r(ANA)], [r(ANA), r(SAM)], REACTION_KEYS, ME)).toBe(false);
  });
});

describe('reactionWords', () => {
  it("reads one comment's reaction records, with the person when stamped", () => {
    const got = reactionWords(
      {
        [`c1\u0000heart\u0000${ANA}`]: { on: true, name: 'Ana', person: 'p'.repeat(24) },
        [`c1\u0000eyes\u0000${SAM}`]: { on: false, name: 'Sam' },
        [`c2\u0000heart\u0000${ANA}`]: { on: true, name: 'Ana' },
        'c1\u0000broken': { on: true, name: 'x' },
      },
      'c1',
    );
    expect([...got]).toEqual([
      [
        `heart\u0000${ANA}`,
        { on: true, value: { emoji: 'heart', by: ANA, name: 'Ana', person: 'p'.repeat(24) } },
      ],
      [`eyes\u0000${SAM}`, { on: false }],
    ]);
    expect(reactionWords(undefined, 'c1').size).toBe(0);
  });
});

describe('collapseLegacyReactions', () => {
  const derived = (key: string) => key.length === 32;
  it('drops a browser-keyed reaction beside the same emoji and name from a derived key', () => {
    const old = r('9f1c2d3e-0000-4000-8000-000000000000', 'heart', 'Ana');
    const fresh = r(ANA, 'heart', 'Ana');
    expect(collapseLegacyReactions([old, fresh], derived)).toEqual([fresh]);
  });

  it('keeps the list when there is nothing to collapse', () => {
    const old = r('legacy-key', 'heart', 'Ana');
    const list = [old, r(ANA, 'eyes', 'Ana'), r(SAM, 'heart', 'Sam')];
    expect(collapseLegacyReactions(list, derived)).toBe(list);
    const legacy = [old, r('other-legacy', 'heart', 'Ana')];
    expect(collapseLegacyReactions(legacy, derived)).toBe(legacy);
    expect(collapseLegacyReactions(undefined, derived)).toBeUndefined();
    const one = [old];
    expect(collapseLegacyReactions(one, derived)).toBe(one);
    const fresh = [r(ANA, 'heart', 'Ana'), r(SAM, 'heart', 'Ana')];
    expect(collapseLegacyReactions(fresh, derived)).toBe(fresh);
  });
});

describe('responses', () => {
  const res = (participantId: string, value = '3', at = 1): PersonResponse => ({
    participantId,
    value,
    at,
  });
  it('reads the ledger, a withdraw as off', () => {
    expect([
      ...responseWords({ [ANA]: { value: '5', at: 2 }, [SAM]: { value: null, at: 3 } }),
    ]).toEqual([
      [ANA, { on: true, value: res(ANA, '5', 2) }],
      [SAM, { on: false }],
    ]);
    expect(responseWords(undefined).size).toBe(0);
  });

  it("locks someone else's answer and lets the writer change theirs", () => {
    const ledger = responseWords({ [ANA]: { value: '5', at: 2 } });
    expect(
      lockEntries([res(ME, '8'), res(ANA, '1')], [res(ANA, '2')], ledger, RESPONSE_KEYS, ME),
    ).toEqual([res(ME, '8'), res(ANA, '5', 2)]);
  });
});

describe('dots', () => {
  it('sees a change to anyone else but the writer', () => {
    expect(foreignDotsDiffer({ e1: [ME, ANA] }, { e1: [ANA] }, ME)).toBe(false);
    expect(foreignDotsDiffer({ e1: [ANA, ANA] }, { e1: [ANA] }, ME)).toBe(true);
    expect(foreignDotsDiffer({}, { e1: [ANA] }, ME)).toBe(true);
    expect(foreignDotsDiffer({ e1: [SAM] }, { e1: [ANA] }, ME)).toBe(true);
    expect(foreignDotsDiffer({ e1: [ANA] }, undefined, ME)).toBe(true);
  });

  it("keeps the written map when only the writer's dots moved", () => {
    const written = { e1: [ANA, ME], e2: [ME] };
    expect(lockDots(written, { e1: [ANA] }, undefined, ME)).toBe(written);
  });

  it("takes other people's dots from the ledger's round, else the stored round, else none", () => {
    expect(lockDots({ e1: [ME, ANA, ANA], e2: [ME] }, { e1: [ANA] }, undefined, ME)).toEqual({
      e1: [ANA, ME],
      e2: [ME],
    });
    expect(lockDots({ e1: [ME] }, { e1: [ANA] }, { e1: [SAM], e3: [ANA, ME] }, ME)).toEqual({
      e1: [SAM, ME],
      e3: [ANA],
    });
    expect(lockDots({ e1: [ANA] }, undefined, undefined, ME)).toEqual({ e1: [] });
    // The writer took back their own last dot on e2: it stays gone.
    expect(lockDots({ e1: [ANA] }, { e2: [ME] }, undefined, ME)).toEqual({ e1: [] });
    expect(lockDots({ e1: [ME] }, undefined, undefined, null)).toEqual({ e1: [] });
  });
});
