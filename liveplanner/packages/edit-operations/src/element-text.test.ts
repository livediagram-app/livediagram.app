import { describe, expect, it } from 'vitest';
import { sprintDashboard } from './fixtures/sprint-dashboard';
import { describeElement, kindOf, labelOf, quoteCut } from './element-text';

const byId = (id: string) => sprintDashboard().elements.find((el) => el.id === id)!;

describe('kindOf', () => {
  it('reads a Plan element by its kind', () => {
    expect(kindOf(byId('w1'))).toBe('plan-view');
    expect(kindOf(byId('b1'))).toBe('bar-chart');
  });
});

describe('labelOf', () => {
  it('reads the label, or nothing', () => {
    expect(labelOf(byId('w1'))).toBe('Workload');
    expect(labelOf(byId('m3'))).toBeUndefined();
  });
});

describe('quoteCut', () => {
  it('quotes a short string whole', () => {
    expect(quoteCut('Sprint board', 60)).toBe('"Sprint board"');
  });

  it('cuts at the last space in the slice, the ellipsis after the quote', () => {
    expect(quoteCut('Sprint board for the launch team', 18)).toBe('"Sprint board for"…');
  });

  it('keeps a word that ends exactly at the cut', () => {
    expect(quoteCut('Sprint board which', 12)).toBe('"Sprint board"…');
  });

  it('cuts hard when the slice has no space', () => {
    expect(quoteCut('abcdefghij', 4)).toBe('"abcd"…');
  });

  it('counts code points, not UTF-16 units', () => {
    expect(quoteCut('😀😀😀', 3)).toBe('"😀😀😀"');
  });
});

describe('describeElement', () => {
  it('prints an element as its id, kind and label', () => {
    expect(describeElement(byId('w1'))).toBe('w1  plan-view "Workload"');
  });

  it('prints an unlabelled element without a label', () => {
    expect(describeElement(byId('m3'))).toBe('m3  plan-view');
  });
});
