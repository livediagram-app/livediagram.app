import { describe, expect, it } from 'vitest';
import { applied, refused } from '../fixtures/outcomes';
import { lockedDashboard, run } from '../fixtures/run';

describe('test', () => {
  it('passes when the element holds the values, and changes nothing', () => {
    const outcome = applied(run('test w1 label=Workload planView={"view":"workload"} textSize=md'));
    expect(outcome.results).toEqual([]);
    expect(outcome.elementOps).toEqual([]);
  });

  it('fails the changeset naming every difference', () => {
    expect(refused(run('test w1 label=Load planView={"view":"calendar"}'))).toEqual({
      code: 'test_failed',
      operation: 1,
      details: [
        'w1 label: expected "Load", actual "Workload"',
        'w1 planView: expected {"view":"calendar"}, actual {"view":"workload"}',
      ],
      hint: 're-read w1: it changed since you read it',
    });
  });

  it('holds key= when the field is absent, and not when present', () => {
    expect(applied(run('test m3 label='))).toBeTruthy();
    expect(refused(run('test w1 label=')).details).toEqual([
      'w1 label: expected (none), actual "Workload"',
    ]);
  });

  it('compares strings exactly', () => {
    expect(refused(run('test w1 label=workload')).code).toBe('test_failed');
  });

  it('tests a locked element, and refuses a field the element lacks', () => {
    expect(applied(run('test w1 label=Workload', lockedDashboard('w1')))).toBeTruthy();
    expect(refused(run('test w1 fillColor=#fff')).code).toBe('unknown_field');
    expect(refused(run('test nowhere label=x')).code).toBe('target_not_found');
  });

  it('logs a failure with its count', () => {
    const logged: [string, unknown][] = [];
    run('test w1 label=x', undefined, { log: (m, f) => logged.push([m, f]) });
    expect(logged).toContainEqual(['[edit-ops] test-failed', { operation: 1, fields: 1 }]);
  });
});
