import { describe, expect, it } from 'vitest';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { validateEditOperations } from '../parse-json';
import type { EditOperation } from '../types';

const run = (operations: EditOperation[]) =>
  applyEditOperations(checkoutFlow(), operations, { makeId: fixedIds() });
const rm = (target: string): EditOperation => ({ op: 'rm', target });

// A stored arrow is a retired element (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part
// 4): removing what it is pinned to removes only what was named, and leaves the arrow exactly as stored (D23).
describe('rm', () => {
  it('removes only the element named, leaving the stored arrows pinned to it as stored', () => {
    const before = checkoutFlow();
    const outcome = run([rm('n4')]);
    const { tab } = applied(outcome);
    expect(tab.elements.map((el) => el.id)).not.toContain('n4');
    for (const id of ['a3', 'a4'])
      expect(tab.elements.find((el) => el.id === id)).toEqual(
        before.elements.find((el) => el.id === id),
      );
    expect(applied(outcome).targets).toEqual(['n4']);
    expect(applied(outcome).warnings).toEqual([]);
    expect(lines(outcome)).toEqual(['- n4  signpost "Address"']);
  });

  it('removes a stored arrow named by its ref, as a retired element', () => {
    expect(lines(run([rm('a3')]))).toEqual(['- a3  ? arrow']);
  });

  it('refuses keep-arrows: nothing goes with an element any more', () => {
    expect(validateEditOperations([{ op: 'rm', target: 'n4', keepArrows: true }])).toHaveProperty(
      'errors',
    );
  });

  it('cannot find an element an earlier operation removed (E3)', () => {
    expect(refused(run([rm('n4'), rm('n4')]))).toMatchObject({
      code: 'target_not_found',
      operation: 2,
    });
  });
});

describe('rm with selectors', () => {
  it('removes every match with all, once each', () => {
    const outcome = run([{ op: 'rm', target: 'label~s', all: true }]);
    expect(lines(outcome)).toEqual([
      '- n1  room-sign "Start"',
      '- n4  signpost "Address"',
      '- n5  signpost "Card details"',
      '- n6  directory "3-D Secure?"',
      '- t1  text "Retry up to 3 times"',
      '- a6  ? arrow "yes"',
    ]);
  });

  it('needs all for several matches', () => {
    expect(refused(run([rm('type:room-sign')])).code).toBe('target_ambiguous');
  });
});
