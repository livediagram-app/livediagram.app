import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import { sprintDashboard } from './fixtures/sprint-dashboard';
import { editDistanceWithin, nearestElements, nearestName } from './nearest';

describe('editDistanceWithin', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistanceWithin('kitten', 'sitting', 3)).toBe(3);
    expect(editDistanceWithin('n3', 'n3', 3)).toBe(0);
    expect(editDistanceWithin('', 'abc', 3)).toBe(3);
  });

  it('stops past the band', () => {
    expect(editDistanceWithin('a', 'abcdef', 2)).toBe(3);
    expect(editDistanceWithin('abcdef', 'uvwxyz', 2)).toBe(3);
  });
});

describe('nearestName', () => {
  it('offers the closest name within the distance', () => {
    expect(nearestName('sett', ['add', 'set', 'rm'], 2)).toBe('set');
  });

  it('offers nothing when every name is too far', () => {
    expect(nearestName('paint', ['add', 'set', 'rm'], 2)).toBeUndefined();
  });
});

describe('nearestElements', () => {
  const elements = sprintDashboard().elements;

  it('finds elements by a near id, nearest first', () => {
    expect(nearestElements('m33', elements).map((el) => el.id)[0]).toBe('m3');
  });

  it('finds elements by a near label, ignoring case', () => {
    expect(nearestElements('WORKLOD', elements).map((el) => el.id)).toEqual(['w1']);
  });

  it('keeps at most five, in element order on a tie', () => {
    const near = nearestElements('x', elements).map((el) => el.id);
    expect(near).toEqual(['m1', 'm2', 'm3', 'm4', 'w1']);
  });

  it('finds nothing far from every id and label', () => {
    expect(nearestElements('zzzzzzzzzz', elements)).toEqual([]);
  });

  it('reads an element without a label by its id alone', () => {
    const bare = [{ id: 'x1', type: 'shape', shape: 'plan-view' }] as unknown as Element[];
    expect(nearestElements('x2', bare).map((el) => el.id)).toEqual(['x1']);
  });
});
