import { describe, expect, it } from 'vitest';
import { pickerCandidates, rollPicker, spinReel } from './picker';

describe('pickerCandidates', () => {
  it('uses the written list when the source is options, trimmed and de-blanked', () => {
    expect(
      pickerCandidates({
        source: 'options',
        options: ['  Frontend ', '', '   ', 'Backend'],
        participantNames: ['Ignored'],
      }),
    ).toEqual(['Frontend', 'Backend']);
  });

  it('uses the people in the room when the source is participants', () => {
    expect(
      pickerCandidates({
        source: 'participants',
        options: ['Ignored'],
        participantNames: ['Ada', 'Grace'],
      }),
    ).toEqual(['Ada', 'Grace']);
  });

  it('folds out a duplicate of the same person', () => {
    // Our own name arrives from local identity AND can appear in presence;
    // one person should be one candidate.
    expect(
      pickerCandidates({ source: 'participants', options: [], participantNames: ['Ada', 'Ada'] }),
    ).toEqual(['Ada']);
  });

  it('keeps the only person in the room as a candidate', () => {
    // A picker that refuses to choose when you are alone is a broken picker.
    expect(
      pickerCandidates({ source: 'participants', options: [], participantNames: ['Ada'] }),
    ).toEqual(['Ada']);
  });
});

describe('rollPicker', () => {
  it('returns null when there is nothing to pick', () => {
    expect(rollPicker([])).toBeNull();
  });

  it('always returns one of the candidates', () => {
    const candidates = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(candidates).toContain(rollPicker(candidates));
  });

  it('reaches every candidate over enough rolls', () => {
    const candidates = ['a', 'b', 'c'];
    const seen = new Set(Array.from({ length: 200 }, () => rollPicker(candidates)));
    expect(seen.size).toBe(3);
  });
});

describe('spinReel', () => {
  it('ends on the result, so the last frame and the answer agree', () => {
    const reel = spinReel(['a', 'b'], 'b', 5);
    expect(reel).toHaveLength(6);
    expect(reel.at(-1)).toBe('b');
  });

  it('still reads as a reel for a one-item list', () => {
    expect(spinReel(['only'], 'only', 3)).toEqual(['only', 'only', 'only', 'only']);
  });

  it('has nothing to spin when there are no candidates', () => {
    expect(spinReel([], 'x')).toEqual([]);
  });
});
