import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livehuddle/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  applyElementOps,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { applyEditOperations } from './apply';
import { EDIT_MAX_ERRORS } from './vocabulary';
import { parseEditOperations } from './parse';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, lines, refused } from './fixtures/outcomes';
import type { EditLog, EditOperation } from './types';

const run = (operations: EditOperation[], tab: Tab = checkoutFlow(), log?: EditLog) =>
  applyEditOperations(tab, operations, { makeId: fixedIds(), ...(log ? { log } : {}) });
const set = (target: string, fields: Record<string, unknown>): EditOperation =>
  ({ op: 'set', target, fields }) as EditOperation;
const add = (element: Record<string, unknown>): EditOperation => ({ op: 'add', element });
const box = { x: 400, y: 0, width: 140, height: 60 };
const mixed: EditOperation[] = [
  set('n3', { label: 'Sign in' }),
  add({ id: 'verify', type: 'shape', shape: 'signpost', label: 'Verify email', ...box }),
  { op: 'rm', target: 'n7' },
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
    expect(tab.elements).toEqual(checkoutFlow().elements);
    expect(elementOps).toEqual([]);
    expect(results).toEqual([]);
  });

  it('refuses more than CHANGESET_MAX_OPERATIONS operations as too_large', () => {
    const operations = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () =>
      set('n1', { label: 'Start' }),
    );
    expect(refused(run(operations)).code).toBe('too_large');
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking": a lock saved before locking left
  // refuses nothing.
  it('applies to a tab and an element saved locked as to any other', () => {
    const flow = checkoutFlow();
    const tab = {
      ...flow,
      locked: true,
      elements: flow.elements.map((el) => (el.id === 'n4' ? { ...el, locked: true } : el)),
    } as Tab;
    const { tab: next } = applied(
      run([set('n4', { label: 'x' }), { op: 'rm', target: 'n3' }], tab),
    );
    expect(next.elements.find((el) => el.id === 'n4')).toMatchObject({ label: 'x' });
    expect(next.elements.some((el) => el.id === 'n3')).toBe(false);
  });

  describe('invariants', () => {
    it('I1 applies all or nothing, and never mutates its input', () => {
      const tab = checkoutFlow();
      const snapshot = structuredClone(tab);
      const outcome = run([...mixed, set('ghost', { label: 'x' })], tab);
      expect(Object.keys(outcome)).toEqual(['errors']);
      expect(tab).toEqual(snapshot);
      applied(run(mixed, tab));
      expect(tab).toEqual(snapshot);
    });

    it('I2 passes untouched elements through as the same objects', () => {
      const tab = checkoutFlow();
      const { tab: next } = applied(run([set('n3', { label: 'Sign in' })], tab));
      tab.elements.forEach((el, i) => {
        if (el.id !== 'n3') expect(next.elements[i]).toBe(el);
      });
    });

    it('I4 round trips through the element ops and their inverse', () => {
      const tab = checkoutFlow();
      const { tab: next, elementOps, inverse } = applied(run(mixed, tab));
      expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
      expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
    });

    it('I5 is deterministic: no clock, no randomness, ids from makeId', () => {
      const random = vi.spyOn(Math, 'random');
      const now = vi.spyOn(Date, 'now');
      const operations = [...mixed, add({ type: 'sticky', ...box, y: 200 })];
      const first = run(operations);
      expect(run(operations)).toEqual(first);
      expect(applied(first).createdIds).toEqual(['verify', 'id-1']);
      expect(random).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    });

    it('mints ids with crypto.randomUUID when no makeId is given', () => {
      const outcome = applyEditOperations(checkoutFlow(), [add({ type: 'sticky', ...box })]);
      expect(applied(outcome).createdIds[0]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('lists the existing elements it resolved, first resolution first, once each', () => {
    const { targets } = applied(
      run([
        set('n3', { label: 'Sign in' }),
        { op: 'rm', target: 'n5' },
        set('n3', { label: 'Log in' }),
        add({ id: 'x', type: 'sticky', ...box }),
        set('x', { label: 'New' }),
      ]),
    );
    expect(targets).toEqual(['n3', 'n5']);
  });

  it('lists the elements it created that are still there, in creation order', () => {
    const { createdIds } = applied(
      run([
        add({ id: 'x', type: 'sticky', ...box }),
        add({ id: 'y', type: 'sticky', ...box }),
        { op: 'rm', target: 'x' },
      ]),
    );
    expect(createdIds).toEqual(['y']);
  });

  describe('finalise', () => {
    // No kind is coerced into a kept one (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
    // part 5, D30): a raw element of a kind livehuddle does not have, a removed diagram shape or a retired kind, is
    // refused and nothing is applied.
    it('refuses a raw shape of a kind livehuddle does not have', () => {
      const { calls, log } = recording();
      for (const shape of ['rectangle', 'square', 'code-block']) {
        const outcome = run(
          [add({ id: 'r', type: 'shape', shape, code: 'x', ...box })],
          checkoutFlow(),
          log,
        );
        expect(refused(outcome)).toEqual({
          code: 'invalid_value',
          operation: 1,
          details: [
            `shape=${JSON.stringify(shape)}: shapes are no longer supported in livehuddle: add a sticky`,
          ],
        });
      }
      expect(calls.filter(([fingerprint]) => fingerprint === '[edit-ops] rejected')[0]).toEqual([
        '[edit-ops] rejected',
        { code: 'invalid_value', operation: 1, field: 'shape' },
      ]);
    });

    // A stored arrow is a retired element (not-in-livehuddle.md "The element engine", part 4): nothing re-anchors it.
    it('leaves a stored arrow as stored when a box it is pinned to moves', () => {
      const outcome = run([set('n4', { x: 300, y: 200 })]);
      const a3 = (tab: Tab) => tab.elements.find((el) => el.id === 'a3');
      expect(a3(applied(outcome).tab)).toEqual(a3(checkoutFlow()));
      expect(
        applied(outcome).elementOps.map((op) => op.kind === 'update' && op.element.id),
      ).not.toContain('a3');
      // f2 is a stored boundary, a retired kind that holds nothing: no membership line follows the move.
      expect(lines(outcome)).toEqual(['~ n4  @40,300→@340,200']);
    });

    // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: a lane is no longer a kind, and
    // since part 5 an added one is refused rather than drawn as a square.
    it('refuses an added lane', () => {
      const lane = { id: 'lane', type: 'shape', shape: 'lane', ...box, width: 800, height: 200 };
      expect(refused(run([add(lane)])).code).toBe('invalid_value');
    });

    it('refuses a touched element the format does not allow, naming field and rule', () => {
      expect(refused(run([set('n3', { width: -5 })]))).toEqual({
        code: 'invalid_result',
        details: ['n3 width: a finite number, 0 or more'],
        hint: 'see the format: livehuddle schema signpost',
      });
    });

    // A stored badge is a retired kind (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
    // part 3): no cap holds on it, and an edit elsewhere leaves it as it was.
    it('leaves an untouched badge that already holds a longer label alone', () => {
      const tab = checkoutFlow();
      tab.elements.push({
        id: 'old',
        type: 'shape',
        shape: 'badge',
        label: 'a label from before the cap was held',
        x: 600,
        y: 0,
        width: 200,
        height: 24,
      } as unknown as Element);
      applied(run([set('n3', { label: 'Sign in' })], tab));
    });

    it('refuses a tab an untouched element already makes invalid', () => {
      const tab = checkoutFlow();
      tab.elements.push({ id: 'broken', type: 'shape', shape: 'signpost' } as Element);
      expect(refused(run([set('n3', { label: 'Sign in' })], tab)).details).toEqual([
        'broken x: a finite number',
      ]);
    });

    it('refuses a tab over the element cap (E13)', () => {
      const tab: Tab = {
        id: 'big',
        name: 'Big',
        elements: Array.from({ length: MAX_ELEMENTS_PER_TAB }, (_, i) => ({
          id: `s${i}`,
          type: 'sticky' as const,
          ...box,
        })),
      };
      expect(refused(run([add({ id: 'one-more', type: 'sticky', ...box })], tab)).details).toEqual([
        `the tab elements: at most ${MAX_ELEMENTS_PER_TAB} elements`,
      ]);
    });

    it('refuses a tab without an id', () => {
      expect(refused(run([], { ...checkoutFlow(), id: '' })).details).toEqual([
        'the tab id: an id and a name',
      ]);
    });
  });

  describe('logs', () => {
    it('logs an applied changeset with counts only', () => {
      const { calls, log } = recording();
      run(
        [...mixed, add({ id: 'r', type: 'shape', shape: 'plant', ...box, y: 300 })],
        checkoutFlow(),
        log,
      );
      expect(calls).toEqual([
        [
          '[edit-ops] applied',
          { operations: 4, added: 2, changed: 1, removed: 1, moved: 0, warnings: 0 },
        ],
      ]);
    });

    it('logs a refusal with its code, operation number and name', () => {
      const { calls, log } = recording();
      run([set('n3', { label: 'Sign in' }), { op: 'rm', target: 'ghost' }], checkoutFlow(), log);
      expect(calls).toEqual([
        ['[edit-ops] unmatched', { count: 1, stopped: 'none' }],
        ['[edit-ops] rejected', { code: 'target_not_found', operation: 2, op: 'rm' }],
      ]);
    });
  });
});

describe('targets that match nothing', () => {
  it('names every one in one answer and writes nothing, and stops at any other refusal', () => {
    const parsed = parseEditOperations('set nope1 label=A\nset n1 label=Fine\nset nope2 label=B');
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(checkoutFlow(), parsed.operations);
    expect('errors' in out && out.errors.map((e) => [e.code, e.operation])).toEqual([
      ['target_not_found', 1],
      ['target_not_found', 3],
    ]);
    const mixed = parseEditOperations('set nope1 label=A\nadd signpost id=n1');
    if ('errors' in mixed) throw new Error('parse');
    const stopped = applyEditOperations(checkoutFlow(), mixed.operations);
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
    const out = applyEditOperations(checkoutFlow(), parsed.operations);
    expect('errors' in out && out.errors).toHaveLength(EDIT_MAX_ERRORS);
  });

  // A miss on what a skipped operation would have made sends the agent to that operation, not this right line.
  it('names the skipped operation a later miss follows from', () => {
    const parsed = parseEditOperations(
      'set nope label=A\nadd signpost id=fresh right-of:nope\nset fresh label=B',
    );
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(checkoutFlow(), parsed.operations);
    if (!('errors' in out)) throw new Error('applied');
    const last = out.errors.find((e) => e.operation === 3)!;
    expect(last.details).toEqual([
      '"fresh" was to be made by operation 2, which was skipped above',
    ]);
    expect(last.hint).toContain('fix operation 2');
  });

  // A later miss on some other id is its own mistake, and keeps its own answer.
  it('leaves a later miss on an unrelated id as it is', () => {
    const parsed = parseEditOperations(
      'set nope label=A\nadd signpost id=fresh right-of:nope\nset other label=B',
    );
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(checkoutFlow(), parsed.operations);
    if (!('errors' in out)) throw new Error('applied');
    const last = out.errors.find((e) => e.operation === 3)!;
    expect(last.details?.[0]).toBe('"other" matches nothing');
  });
});
