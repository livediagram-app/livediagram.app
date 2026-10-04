import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { applied, refused } from '../fixtures/outcomes';
import { applyEditOperations } from '../apply';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { flowWith, lockedFlow, run } from '../fixtures/run';

describe('test', () => {
  it('passes when the element holds the values, and changes nothing', () => {
    const outcome = applied(run('test n3 label=Login shape=square text=sm'));
    expect(outcome.results).toEqual([]);
    expect(outcome.elementOps).toEqual([]);
  });

  it('fails the changeset naming every difference', () => {
    expect(refused(run('test n3 label=Logout fill=green'))).toEqual({
      code: 'test_failed',
      operation: 1,
      details: [
        'n3 label: expected "Logout", actual "Login"',
        'n3 fill: expected green, actual (none)',
      ],
      hint: 're-read n3: it changed since you read it',
    });
  });

  it('holds key= when the field is absent, and not when present', () => {
    expect(applied(run('test n3 note='))).toBeTruthy();
    expect(applied(run('test n3 label=Login note= fill='))).toBeTruthy();
    expect(refused(run('test n3 label=')).details).toEqual([
      'n3 label: expected (none), actual "Login"',
    ]);
  });

  it('compares strings exactly and labels without the cap', () => {
    expect(refused(run('test n3 label=login')).code).toBe('test_failed');
    const long = 'A'.repeat(200);
    const tab = flowWith((el) => (el.id === 'n3' ? ({ ...el, label: long } as Element) : el));
    expect(applied(run(`test n3 label="${long}"`, tab))).toBeTruthy();
  });

  it('compares colours by slot, or the hex in any case', () => {
    expect(applied(run('set n3 fill=green\ntest n3 fill=green'))).toBeTruthy();
    expect(applied(run('set n3 fill=#AABBCC\ntest n3 fill=#aabbcc'))).toBeTruthy();
    expect(refused(run('set n3 fill=#AABBCC\ntest n3 fill=#aabbcd')).details).toEqual([
      'n3 fill: expected #aabbcd, actual #AABBCC',
    ]);
  });

  it('prints structured values as JSON', () => {
    const free = { kind: 'free', x: 1, y: 2 };
    const outcome = applyEditOperations(checkoutFlow(), [
      { op: 'test', target: 'a1', fields: { from: free } },
    ]);
    expect(refused(outcome).details).toEqual([
      'a1 from: expected {"kind":"free","x":1,"y":2}, actual {"kind":"pinned","elementId":"n1","anchor":"s"}',
    ]);
  });

  it('tests a locked element, and refuses a field the element lacks', () => {
    expect(applied(run('test n3 label=Login', lockedFlow('n3')))).toBeTruthy();
    expect(refused(run('test n3 bogus=1')).code).toBe('unknown_field');
    expect(refused(run('test nowhere label=x')).code).toBe('target_not_found');
  });

  it('logs a failure with its count', () => {
    const logged: [string, unknown][] = [];
    run('test n3 label=x', undefined, { log: (m, f) => logged.push([m, f]) });
    expect(logged).toContainEqual(['[edit-ops] test-failed', { operation: 1, fields: 1 }]);
  });

  it('reads an alias under its stored name, and compares arrays', () => {
    expect(refused(run('test n3 text=md')).details).toEqual(['n3 text: expected md, actual sm']);
    const outcome = applyEditOperations(checkoutFlow(), [
      { op: 'test', target: 'a1', fields: { curvePoints: [{ x: 1, y: 2 }] } },
    ]);
    expect(refused(outcome).code).toBe('test_failed');
  });
});
