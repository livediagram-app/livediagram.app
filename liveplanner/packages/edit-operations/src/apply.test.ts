import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@liveplanner/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  applyElementOps,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { applyEditOperations } from './apply';
import { formatRejections } from './rejections';
import { EDIT_MAX_ERRORS } from './vocabulary';
import { parseEditOperations } from './parse';
import { fixedIds, newView, sprintDashboard } from './fixtures/sprint-dashboard';
import { applied, refused } from './fixtures/outcomes';
import type { EditLog, EditOperation } from './types';

const run = (operations: EditOperation[], tab: Tab = sprintDashboard(), log?: EditLog) =>
  applyEditOperations(tab, operations, { makeId: fixedIds(), ...(log ? { log } : {}) });
const set = (target: string, fields: Record<string, unknown>): EditOperation =>
  ({ op: 'set', target, fields }) as EditOperation;
const add = (element: Record<string, unknown>): EditOperation => ({ op: 'add', element });
const { id: _id, ...unnamedView } = newView('x', 'gantt');
const mixed: EditOperation[] = [
  set('w1', { label: 'Load' }),
  add(newView('g1', 'gantt')),
  { op: 'rm', target: 'm3' },
];

const recording = () => {
  const calls: [string, Record<string, unknown>][] = [];
  const log: EditLog = (fingerprint, fields) => calls.push([fingerprint, { ...fields }]);
  return { calls, log };
};

afterEach(() => vi.restoreAllMocks());

describe('applyEditOperations', () => {
  it('applies nothing for no operations', () => {
    const { tab, elementOps, results } = applied(run([]));
    expect(tab.elements).toEqual(sprintDashboard().elements);
    expect(elementOps).toEqual([]);
    expect(results).toEqual([]);
  });

  it('refuses more than CHANGESET_MAX_OPERATIONS operations as too_large', () => {
    const operations = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () =>
      set('m1', { label: 'Cards' }),
    );
    expect(refused(run(operations)).code).toBe('too_large');
  });

  it('refuses any operation on a locked tab, before the first', () => {
    const { calls, log } = recording();
    const rejection = refused(run([set('nope', {})], { ...sprintDashboard(), locked: true }, log));
    expect(rejection).toEqual({
      code: 'element_locked',
      details: ['the tab is locked'],
      hint: 'unlock it in the editor, or leave it out of the changeset',
    });
    expect(calls).toEqual([
      ['[edit-ops] locked', { operation: 0, op: 'none', scope: 'tab' }],
      ['[edit-ops] rejected', { code: 'element_locked', operation: 0, op: 'none' }],
    ]);
  });

  describe('invariants', () => {
    it('I1 applies all or nothing, and never mutates its input', () => {
      const tab = sprintDashboard();
      const snapshot = structuredClone(tab);
      const outcome = run([...mixed, set('ghost', { label: 'x' })], tab);
      expect(Object.keys(outcome)).toEqual(['errors']);
      expect(tab).toEqual(snapshot);
      applied(run(mixed, tab));
      expect(tab).toEqual(snapshot);
    });

    it('I4 round trips through the element ops and their inverse', () => {
      const tab = sprintDashboard();
      const { tab: next, elementOps, inverse } = applied(run(mixed, tab));
      expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
      expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
    });

    it('I5 is deterministic: no clock, no randomness, ids from makeId', () => {
      const random = vi.spyOn(Math, 'random');
      const now = vi.spyOn(Date, 'now');
      const operations = [...mixed, add(unnamedView)];
      const first = run(operations);
      expect(run(operations)).toEqual(first);
      expect(applied(first).createdIds).toEqual(['g1', 'id-1']);
      expect(random).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    });

    it('mints ids with crypto.randomUUID when no makeId is given', () => {
      const outcome = applyEditOperations(sprintDashboard(), [add(unnamedView)]);
      expect(applied(outcome).createdIds[0]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('lists the existing elements it resolved, first resolution first, once each', () => {
    const { targets } = applied(
      run([
        set('w1', { label: 'Load' }),
        { op: 'rm', target: 'm3' },
        set('w1', { label: 'Busy' }),
        add(newView('g1', 'gantt')),
        set('g1', { label: 'New' }),
      ]),
    );
    expect(targets).toEqual(['w1', 'm3']);
  });

  it('lists the elements it created that are still there, in creation order', () => {
    const { createdIds } = applied(
      run([add(newView('x', 'gantt')), add(newView('y', 'search')), { op: 'rm', target: 'x' }]),
    );
    expect(createdIds).toEqual(['y']);
  });

  it('names the refused operation in its line form, as the header prints it', () => {
    const rejection = refused(run([set('w1', { label: 'Load' }), { op: 'rm', target: 'gone' }]));
    expect(rejection).toMatchObject({ code: 'target_not_found', operation: 2, op: 'rm gone' });
    expect(formatRejections([rejection])[0]).toBe('error target_not_found · op 2 · rm gone');
  });

  describe('finalise', () => {
    it('refuses a touched element the format does not allow, naming field and rule', () => {
      expect(refused(run([set('w1', { width: -5 })]))).toEqual({
        code: 'invalid_result',
        details: ['w1 width: a finite number, 0 or more'],
        hint: 'see the format: liveplanner schema plan-view',
      });
    });

    it('refuses a tab an untouched element already makes invalid', () => {
      const tab = sprintDashboard();
      tab.elements.push({ id: 'broken', type: 'shape', shape: 'plan-view' } as Element);
      expect(refused(run([set('w1', { label: 'Load' })], tab)).details).toEqual([
        'broken x: a finite number',
      ]);
    });

    it('refuses a tab over the element cap (E13)', () => {
      const tab: Tab = {
        id: 'big',
        name: 'Big',
        elements: Array.from(
          { length: MAX_ELEMENTS_PER_TAB },
          (_, i) => newView(`v${i}`, 'workload') as unknown as Element,
        ),
      };
      expect(refused(run([add(newView('one-more', 'gantt'))], tab)).details).toEqual([
        `the tab elements: at most ${MAX_ELEMENTS_PER_TAB} elements`,
      ]);
    });

    it('refuses a tab without an id', () => {
      expect(refused(run([], { ...sprintDashboard(), id: '' })).details).toEqual([
        'the tab id: an id and a name',
      ]);
    });
  });

  describe('logs', () => {
    it('logs an applied changeset with counts only', () => {
      const { calls, log } = recording();
      run(mixed, sprintDashboard(), log);
      expect(calls).toEqual([
        ['[edit-ops] applied', { operations: 3, added: 1, changed: 1, removed: 1, warnings: 0 }],
      ]);
    });

    it('logs a refusal with its code, operation number and name', () => {
      const { calls, log } = recording();
      run([set('w1', { label: 'Load' }), { op: 'rm', target: 'ghost' }], sprintDashboard(), log);
      expect(calls).toEqual([
        ['[edit-ops] unmatched', { count: 1, stopped: 'none' }],
        ['[edit-ops] rejected', { code: 'target_not_found', operation: 2, op: 'rm' }],
      ]);
    });

    it('logs a locked element with its scope', () => {
      const { calls, log } = recording();
      const tab: Tab = {
        ...sprintDashboard(),
        layers: [{ id: 'base', name: 'Base', locked: true }],
      };
      run([set('w1', { label: 'x' })], tab, log);
      expect(calls[0]).toEqual(['[edit-ops] locked', { operation: 1, op: 'set', scope: 'layer' }]);
    });
  });
});

describe('targets that match nothing', () => {
  it('names every one in one answer and writes nothing, and stops at any other refusal', () => {
    const parsed = parseEditOperations('set nope1 label=A\nset m1 label=Fine\nset nope2 label=B');
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(sprintDashboard(), parsed.operations);
    expect('errors' in out && out.errors.map((e) => [e.code, e.operation])).toEqual([
      ['target_not_found', 1],
      ['target_not_found', 3],
    ]);
    const stopped = run([set('nope1', { label: 'A' }), add(newView('m1', 'gantt'))]);
    // The refusal that stopped the read is answered too, so the retry does not meet it fresh.
    expect('errors' in stopped && stopped.errors.map((e) => [e.code, e.operation])).toEqual([
      ['target_not_found', 1],
      ['id_taken', 2],
    ]);
  });

  // Each miss scans the tab for the nearest candidates: at most EDIT_MAX_ERRORS are gathered, as the parser's are.
  it('gathers at most EDIT_MAX_ERRORS misses', () => {
    const text = Array.from({ length: 40 }, (_, i) => `set nope${i} label=X`).join('\n');
    const parsed = parseEditOperations(text);
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(sprintDashboard(), parsed.operations);
    expect('errors' in out && out.errors).toHaveLength(EDIT_MAX_ERRORS);
  });
});
