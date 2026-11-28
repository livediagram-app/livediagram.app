import { describe, expect, it } from 'vitest';
import {
  drawnAfter,
  drawnStillListed,
  pickerCandidates,
  rollPicker,
  spinFrameDelays,
  spinReel,
  undrawnCandidates,
  withDraw,
  withRoundCleared,
  pickerOffer,
} from './picker';

// An editor's Participant, cut down.
type Participant = { id: string; name: string; color: string; status: 'online' };

// A participant is identified by id, not by name, two people can share one.
const person = (id: string, name: string): Participant => ({
  id,
  name,
  color: '#0ea5e9',
  status: 'online',
});
const labels = (candidates: { label: string }[]) => candidates.map((c) => c.label);

describe('pickerCandidates', () => {
  it('uses the written list when the source is options, trimmed and de-blanked', () => {
    expect(
      labels(
        pickerCandidates({
          source: 'options',
          options: ['  Frontend ', '', '   ', 'Backend'],
          participants: [person('p1', 'Ignored')],
        }),
      ),
    ).toEqual(['Frontend', 'Backend']);
  });

  it('uses the people in the room when the source is participants', () => {
    const candidates = pickerCandidates({
      source: 'participants',
      options: ['Ignored'],
      participants: [person('p1', 'Ada'), person('p2', 'Grace')],
    });
    expect(labels(candidates)).toEqual(['Ada', 'Grace']);
    // Each carries its person, so the face can draw them with their avatar.
    expect(candidates[0]?.participant?.id).toBe('p1');
  });

  it('folds out a duplicate of the same person, but not a namesake', () => {
    // We arrive from local identity AND from presence: one person, one
    // candidate. Two different people who happen to share a name are two.
    expect(
      labels(
        pickerCandidates({
          source: 'participants',
          options: [],
          participants: [person('p1', 'Ada'), person('p1', 'Ada')],
        }),
      ),
    ).toEqual(['Ada']);
    expect(
      labels(
        pickerCandidates({
          source: 'participants',
          options: [],
          participants: [person('p1', 'Alex'), person('p2', 'Alex')],
        }),
      ),
    ).toEqual(['Alex', 'Alex']);
  });

  it('keeps the only person in the room as a candidate', () => {
    // A picker that refuses to choose when you are alone is a broken picker.
    expect(
      labels(
        pickerCandidates({
          source: 'participants',
          options: [],
          participants: [person('p1', 'Ada')],
        }),
      ),
    ).toEqual(['Ada']);
  });
});

describe('rollPicker', () => {
  it('returns null when there is nothing to pick', () => {
    expect(rollPicker([])).toBeNull();
  });

  it('always returns one of the candidates', () => {
    const candidates = [{ label: 'a' }, { label: 'b' }, { label: 'c' }];
    for (let i = 0; i < 100; i++) expect(candidates).toContain(rollPicker(candidates));
  });

  it('reaches every candidate over enough rolls', () => {
    const candidates = [{ label: 'a' }, { label: 'b' }, { label: 'c' }];
    const seen = new Set(Array.from({ length: 200 }, () => rollPicker(candidates)?.label));
    expect(seen.size).toBe(3);
  });
});

describe('spinReel', () => {
  it('ends on the result, so the last frame and the answer agree', () => {
    const reel = spinReel([{ label: 'a' }, { label: 'b' }], { label: 'b' }, 5);
    expect(reel).toHaveLength(6);
    expect(reel.at(-1)?.label).toBe('b');
  });

  it('still reads as a reel for a one-item list', () => {
    expect(labels(spinReel([{ label: 'only' }], { label: 'only' }, 3))).toEqual([
      'only',
      'only',
      'only',
      'only',
    ]);
  });

  it('has nothing to spin when there are no candidates', () => {
    expect(spinReel([], { label: 'x' })).toEqual([]);
  });
});

describe('spinFrameDelays', () => {
  it('starts fast and slows down, so it reads as a wheel stopping', () => {
    const delays = spinFrameDelays(10, 1000);
    const gaps = delays.slice(1).map((d, i) => d - delays[i]!);
    // Every gap is at least as long as the one before it.
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeGreaterThanOrEqual(gaps[i - 1]!);
    // And the whole thing fits inside the spin.
    expect(delays[0]).toBe(0);
    expect(delays.at(-1)!).toBeLessThan(1000);
  });

  it('has no frames to schedule for an empty reel', () => {
    expect(spinFrameDelays(0)).toEqual([]);
  });
});

describe('Remove Once Drawn', () => {
  const pool = [{ label: 'Ada' }, { label: 'Grace' }, { label: 'Linus' }];

  it('leaves the drawn names out of the pool only while the setting is on', () => {
    expect(labels(undrawnCandidates(pool, ['Grace'], true))).toEqual(['Ada', 'Linus']);
    expect(labels(undrawnCandidates(pool, ['Grace'], false))).toEqual(['Ada', 'Grace', 'Linus']);
    expect(undrawnCandidates(pool, undefined, true)).toBe(pool);
    expect(undrawnCandidates(pool, [], true)).toBe(pool);
  });

  it('empties the pool once every name is drawn, so the face can offer Reset', () => {
    expect(undrawnCandidates(pool, ['Ada', 'Grace', 'Linus'], true)).toEqual([]);
  });

  it('appends a draw once, in order', () => {
    expect(drawnAfter(undefined, 'Ada')).toEqual(['Ada']);
    expect(drawnAfter(['Ada'], 'Linus')).toEqual(['Ada', 'Linus']);
    // A replayed write of the same draw does not double it.
    expect(drawnAfter(['Ada', 'Linus'], 'Ada')).toEqual(['Ada', 'Linus']);
  });

  it('counts only drawn names still on the list, once each', () => {
    expect(drawnStillListed(pool, ['Linus', 'Gone', 'Ada', 'Linus'])).toEqual(['Linus', 'Ada']);
    expect(drawnStillListed(pool, undefined)).toEqual([]);
  });
});

describe('the draw and the reset', () => {
  it('writes only the result while Remove Once Drawn is off', () => {
    expect(withDraw({ pickerDrawn: ['Ada'] }, 'Grace', 500)).toEqual({
      pickerDrawn: ['Ada'],
      pickerResult: 'Grace',
      pickerRolledAt: 500,
    });
  });

  it('writes the result and the drawn list together while it is on', () => {
    expect(withDraw({ pickerRemoveDrawn: true, pickerDrawn: ['Ada'] }, 'Grace', 500)).toEqual({
      pickerRemoveDrawn: true,
      pickerResult: 'Grace',
      pickerDrawn: ['Ada', 'Grace'],
      pickerRolledAt: 500,
    });
  });

  it('stamps every press anew, even the same name again from a clock running behind', () => {
    const blank: { pickerResult?: string; pickerRolledAt?: number } = {};
    const first = withDraw(blank, 'Ada', 900);
    const again = withDraw(first, 'Ada', 400);
    expect(again.pickerResult).toBe('Ada');
    expect(again.pickerRolledAt).toBe(901);
    expect(withDraw(blank, 'Ada').pickerRolledAt).toBeGreaterThan(0);
  });

  it('drops the result and the drawn list on a reset, keeping the setting', () => {
    const cleared = withRoundCleared({
      pickerRemoveDrawn: true,
      pickerResult: 'Grace',
      pickerDrawn: ['Ada', 'Grace'],
      pickerRolledAt: 5,
    });
    expect(cleared).toEqual({ pickerRemoveDrawn: true });
    expect('pickerResult' in cleared).toBe(false);
  });
});

describe('pickerOffer', () => {
  const offer = { candidates: [], shared: true, roll: () => null, reset: () => {} };

  it('gives an Editor spinning for the room both the spin and the reset', () => {
    const got = pickerOffer(offer, false);
    expect(got?.roll).toBe(offer.roll);
    expect(got?.reset).toBe(offer.reset);
  });

  it('gives a read-only viewer the reel alone', () => {
    const got = pickerOffer(offer, true);
    expect(got?.roll).toBeUndefined();
    expect(got?.reset).toBeUndefined();
  });

  it('gives a private roller (somebody else facilitating) the spin but no reset', () => {
    const got = pickerOffer({ ...offer, shared: false }, false);
    expect(got?.roll).toBe(offer.roll);
    expect(got?.reset).toBeUndefined();
  });

  it('offers nothing with no session behind the canvas', () => {
    expect(pickerOffer(undefined, false)).toBeUndefined();
  });
});
