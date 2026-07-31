import { describe, expect, it } from 'vitest';
import {
  clearResponse,
  responseOf,
  responseStats,
  responseTally,
  setResponse,
  type ParticipantResponse,
} from './responses';

const cast = (id: string, value: string, at = 1): ParticipantResponse => ({
  participantId: id,
  value,
  at,
});

describe('setResponse', () => {
  it('appends a first answer', () => {
    expect(setResponse(undefined, 'a', '5', 10)).toEqual([cast('a', '5', 10)]);
  });

  it('REPLACES the same participant rather than stacking (spec/122)', () => {
    const once = setResponse(undefined, 'a', '5', 10);
    const twice = setResponse(once, 'a', '8', 20);
    expect(twice).toHaveLength(1);
    expect(twice[0]).toEqual(cast('a', '8', 20));
  });

  it('keeps other participants untouched', () => {
    let list = setResponse(undefined, 'a', '5', 10);
    list = setResponse(list, 'b', '3', 11);
    list = setResponse(list, 'a', '13', 12);
    expect(list.map((r) => [r.participantId, r.value])).toEqual([
      ['b', '3'],
      ['a', '13'],
    ]);
  });
});

describe('clearResponse / responseOf', () => {
  it('withdraws one answer and leaves the rest', () => {
    let list = setResponse(undefined, 'a', '5', 1);
    list = setResponse(list, 'b', '8', 2);
    expect(responseOf(clearResponse(list, 'a'), 'a')).toBeUndefined();
    expect(responseOf(clearResponse(list, 'a'), 'b')).toBe('8');
  });

  it('is safe on an element that has never been answered', () => {
    expect(clearResponse(undefined, 'a')).toEqual([]);
    expect(responseOf(undefined, 'a')).toBeUndefined();
  });
});

describe('responseStats', () => {
  it('averages the numeric answers', () => {
    const list = [cast('a', '2'), cast('b', '4'), cast('c', '6')];
    const stats = responseStats(list);
    expect(stats.count).toBe(3);
    expect(stats.average).toBe(4);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(6);
  });

  it('counts a non-numeric answer as answered but excludes it from the maths', () => {
    // Someone who can't size a story HAS answered; folding their '?' in as a
    // zero would misreport the room (spec/122).
    const stats = responseStats([cast('a', '8'), cast('b', '?')]);
    expect(stats.count).toBe(2);
    expect(stats.numericCount).toBe(1);
    expect(stats.average).toBe(8);
    expect(stats.max).toBe(8);
  });

  it('handles a t-shirt scale with no numbers at all', () => {
    const stats = responseStats([cast('a', 'M'), cast('b', 'XL')]);
    expect(stats.average).toBeNull();
    expect(stats.min).toBeNull();
    expect(stats.distinct).toEqual(['M', 'XL']);
  });

  it('sorts distinct answers numerically, with non-numeric ones last', () => {
    const list = [cast('a', '13'), cast('b', '?'), cast('c', '2'), cast('d', '13')];
    expect(responseStats(list).distinct).toEqual(['2', '13', '?']);
  });

  it('reports one distinct answer for a unanimous round', () => {
    const stats = responseStats([cast('a', '5'), cast('b', '5'), cast('c', '5')]);
    expect(stats.distinct).toEqual(['5']);
  });

  it('is empty, not zero, with no answers', () => {
    const stats = responseStats(undefined);
    expect(stats.count).toBe(0);
    expect(stats.average).toBeNull();
  });

  it('does not read an empty string as a zero', () => {
    expect(responseStats([cast('a', '')]).numericCount).toBe(0);
  });
});

describe('responseTally', () => {
  it('counts each value in order', () => {
    const list = [cast('a', '1'), cast('b', '3'), cast('c', '3'), cast('d', '5')];
    expect(responseTally(list, ['1', '2', '3', '4', '5'])).toEqual([1, 0, 2, 0, 1]);
  });

  it('is all zeroes with no answers', () => {
    expect(responseTally(undefined, ['1', '2'])).toEqual([0, 0]);
  });
});
