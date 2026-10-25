import { describe, expect, it } from 'vitest';
import { sprintDashboard } from './fixtures/sprint-dashboard';
import { describeElement, kindOf, labelOf } from './element-text';

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

describe('describeElement', () => {
  it('prints an element as its id, kind and label', () => {
    expect(describeElement(byId('w1'))).toBe('w1  plan-view "Workload"');
  });

  it('prints an unlabelled element without a label', () => {
    expect(describeElement(byId('m3'))).toBe('m3  plan-view');
  });
});
