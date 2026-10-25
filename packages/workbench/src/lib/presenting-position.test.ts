import { describe, expect, it } from 'vitest';
import { positionAt, presentingIndex } from './presenting-position';

const run = (...ids: string[]) => ids.map((id) => ({ slide: { id } }));

// docs/specs/012-collaboration/presentation-mode.md "Presenting": the presenter stays on their slide while
// the deck changes under them.
describe('presenting position', () => {
  it('follows its slide when slides before it come and go', () => {
    const pos = positionAt(1, run('a', 'b', 'c'));
    expect(pos).toEqual({ slideId: 'b', at: 1 });
    expect(presentingIndex(pos, run('b', 'c'))).toBe(0);
    expect(presentingIndex(pos, run('x', 'a', 'b', 'c'))).toBe(2);
  });

  it('hands a slide that has gone to the one now in its place, the last at the end', () => {
    expect(presentingIndex(positionAt(1, run('a', 'b', 'c')), run('a', 'c'))).toBe(1);
    expect(presentingIndex(positionAt(2, run('a', 'b', 'c')), run('a', 'b'))).toBe(1);
  });

  it('ends only once nothing is left', () => {
    expect(presentingIndex(positionAt(0, run('a')), run())).toBe(0);
  });

  it('keeps the end state at the end, however long the run becomes', () => {
    const end = positionAt(2, run('a', 'b'));
    expect(end).toEqual({ slideId: null, at: 2 });
    expect(presentingIndex(end, run('a', 'b', 'c'))).toBe(3);
    expect(presentingIndex(end, run('a'))).toBe(1);
  });
});
