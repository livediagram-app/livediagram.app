import { describe, expect, it } from 'vitest';

import { allDone, doneSplit, DONE_VALUE, isDone, setResponse } from './responses';

// The Done check's rules (spec/137). The interesting ones are about WHO the
// card is waiting on, because that is what decides when it completes.

const room = ['a', 'b', 'c'];
const mark = (ids: string[]) =>
  ids.reduce<Parameters<typeof allDone>[0]>(
    (acc, id) => setResponse(acc, id, DONE_VALUE, 1),
    undefined,
  );

describe('done check', () => {
  it('reads one person as done or not', () => {
    const r = mark(['a']);
    expect(isDone(r, 'a')).toBe(true);
    expect(isDone(r, 'b')).toBe(false);
  });

  it('splits the room into done and waiting', () => {
    expect(doneSplit(mark(['a', 'c']), room)).toEqual({ done: ['a', 'c'], waiting: ['b'] });
  });

  it('is not done until everyone in the room is', () => {
    expect(allDone(mark(['a', 'b']), room)).toBe(false);
    expect(allDone(mark(['a', 'b', 'c']), room)).toBe(true);
  });

  it('ignores answers from people who have left, so the card can complete', () => {
    // 'ghost' marked done and then closed the tab. The room is now a and b.
    const r = mark(['ghost', 'a', 'b']);
    expect(allDone(r, ['a', 'b'])).toBe(true);
    expect(doneSplit(r, ['a', 'b']).waiting).toEqual([]);
  });

  it('keeps a departed answer rather than deleting it, for the rejoin', () => {
    const r = mark(['ghost', 'a']);
    // Not in the split for a room without them...
    expect(doneSplit(r, ['a']).done).toEqual(['a']);
    // ...but still there if they come back.
    expect(isDone(r, 'ghost')).toBe(true);
  });

  it('an empty room is never done', () => {
    // Nobody present means nothing has been finished; flashing at an empty
    // board would be celebrating the absence of people.
    expect(allDone(undefined, [])).toBe(false);
    expect(allDone(mark(['ghost']), [])).toBe(false);
  });

  it('withdrawing is just clearing the response', () => {
    const r = mark(['a', 'b']);
    expect(allDone(r, ['a', 'b'])).toBe(true);
    const withdrawn = r!.filter((x) => x.participantId !== 'b');
    expect(allDone(withdrawn, ['a', 'b'])).toBe(false);
  });
});
