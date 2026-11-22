import { describe, expect, it } from 'vitest';
import { findMatches, firstMatchFrom, sameMatchAgain, stepMatch } from './find-matches';
import type { FindTarget } from './find-targets';
import { DEFAULT_FIND_OPTIONS } from './find-text';

// docs/specs/007-editor/find-and-replace.md "The count and stepping".
const target = (key: string, pageId: string, text: string): FindTarget => ({
  key,
  pageId,
  text,
  held: null,
  ref: { kind: 'field', id: key, field: 'label' },
});
const targets = [
  target('a', 'p1', 'plan and plan'),
  target('b', 'p2', 'no match here'),
  target('c', 'p3', 'plan'),
];

describe('findMatches', () => {
  it('finds every match in order, each with its text and place', () => {
    const { matches, capped } = findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS);
    expect(matches).toEqual([
      { target: 0, start: 0, end: 4 },
      { target: 0, start: 9, end: 13 },
      { target: 2, start: 0, end: 4 },
    ]);
    expect(capped).toBe(false);
  });

  it('stops at the cap and says so', () => {
    expect(findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS, 2)).toEqual({
      matches: [
        { target: 0, start: 0, end: 4 },
        { target: 0, start: 9, end: 13 },
      ],
      capped: true,
    });
    expect(findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS, 3).capped).toBe(false);
    expect(findMatches(targets, '', DEFAULT_FIND_OPTIONS).matches).toEqual([]);
  });
});

describe('the match in hand', () => {
  const { matches } = findMatches(targets, 'plan', DEFAULT_FIND_OPTIONS);
  const order = ['p1', 'p2', 'p3'];

  it('starts on the first match on or after the page in view', () => {
    expect(firstMatchFrom(matches, targets, order, 'p2')).toBe(2);
    expect(firstMatchFrom(matches, targets, order, 'p1')).toBe(0);
    expect(firstMatchFrom(matches, targets, order, undefined)).toBe(0);
    // Nothing after it: round to the first.
    expect(firstMatchFrom(matches.slice(0, 2), targets, order, 'p3')).toBe(0);
    expect(firstMatchFrom([], targets, order, 'p1')).toBeNull();
  });

  it('keeps the same match after an edit, else the next one, else the first', () => {
    expect(sameMatchAgain({ key: 'a', start: 9, order: 0 }, matches, targets)).toBe(1);
    // Its words went: the first after where it was.
    expect(sameMatchAgain({ key: 'a', start: 5, order: 0 }, matches, targets)).toBe(1);
    expect(sameMatchAgain({ key: 'a', start: 20, order: 0 }, matches, targets)).toBe(2);
    // Its text went: the next text's.
    expect(sameMatchAgain({ key: 'gone', start: 0, order: 1 }, matches, targets)).toBe(2);
    expect(sameMatchAgain({ key: 'c', start: 2, order: 2 }, matches, targets)).toBe(0);
    expect(sameMatchAgain(null, matches, targets)).toBe(0);
    expect(sameMatchAgain(null, [], targets)).toBeNull();
  });

  it('steps round at either end', () => {
    expect(stepMatch(0, 3, 1)).toBe(1);
    expect(stepMatch(2, 3, 1)).toBe(0);
    expect(stepMatch(0, 3, -1)).toBe(2);
    expect(stepMatch(null, 3, 1)).toBe(0);
    expect(stepMatch(null, 3, -1)).toBe(2);
    expect(stepMatch(1, 0, 1)).toBeNull();
  });
});
