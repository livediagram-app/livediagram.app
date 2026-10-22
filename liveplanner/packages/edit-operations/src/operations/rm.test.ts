import { describe, expect, it } from 'vitest';
import { applied, lines, refused } from '../fixtures/outcomes';
import { lockedDashboard, run } from '../fixtures/run';

describe('rm', () => {
  it('removes the element, listing it', () => {
    const outcome = run('rm w1');
    expect(applied(outcome).tab.elements.map((el) => el.id)).not.toContain('w1');
    expect(applied(outcome).targets).toEqual(['w1']);
    expect(lines(outcome)).toEqual(['- w1  plan-view "Workload"']);
  });

  it('removes several with all, and refuses several without it', () => {
    expect(lines(run('rm type:plan-view label~o all'))).toEqual([
      '- m2  plan-view "Progress"',
      '- w1  plan-view "Workload"',
    ]);
    expect(refused(run('rm type:plan-view'))).toMatchObject({
      code: 'target_ambiguous',
      hint: 'use a ref, narrow with type:plan-view, or add all',
    });
  });

  it('refuses a locked element, removing nothing', () => {
    expect(refused(run('rm type:plan-view all', lockedDashboard('c1')))).toMatchObject({
      code: 'element_locked',
      details: ['locked:', '  c1  plan-view "Due dates" (element)'],
    });
  });

  it('takes no fields', () => {
    expect(refused(run('rm w1 label=x'))).toMatchObject({ code: 'parse_error' });
  });
});
