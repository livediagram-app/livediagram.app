import { describe, expect, it } from 'vitest';
import { applied, refused } from './fixtures/outcomes';
import { run } from './fixtures/run';
import { sprintDashboard } from './fixtures/sprint-dashboard';

describe('finalise', () => {
  it('passes untouched elements through as the same objects (I2)', () => {
    const tab = sprintDashboard();
    const { tab: next } = applied(run('set w1 label=Load', tab));
    expect(next.elements[0]).toBe(tab.elements[0]);
    expect(next.elements.find((el) => el.id === 'w1')).not.toBe(tab.elements[4]);
  });

  it('keeps an element set back to what it was as the element it was (E1)', () => {
    const tab = sprintDashboard();
    const { tab: next, results } = applied(run('set w1 label=Load\nset w1 label=Workload', tab));
    expect(next.elements[4]).toBe(tab.elements[4]);
    expect(results).toEqual([]);
  });

  it('refuses a result that is not a valid element', () => {
    expect(refused(run('set w1 width=-5')).code).toBe('invalid_result');
  });
});
