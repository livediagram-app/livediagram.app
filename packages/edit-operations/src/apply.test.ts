import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@liveplanner/api-schema';
import {
  MAX_ELEMENTS_PER_TAB,
  applyElementOps,
  type Element,
  type Tab,
} from '@liveplanner/document';
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
  add({ id: 'verify', type: 'shape', shape: 'square', label: 'Verify email', ...box }),
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

  it('refuses any operation on a locked tab, before the first', () => {
    const { calls, log } = recording();
    const rejection = refused(run([set('nope', {})], { ...checkoutFlow(), locked: true }, log));
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

    it('I7 leaves locked elements exactly as they were', () => {
      const tab: Tab = {
        ...checkoutFlow(),
        elements: checkoutFlow().elements.map((el) =>
          el.id === 'n4' ? { ...el, locked: true } : el,
        ),
      };
      const locked = tab.elements.find((el) => el.id === 'n4');
      const { tab: next } = applied(run([{ op: 'rm', target: 'n3', keepArrows: true }], tab));
      expect(next.elements.find((el) => el.id === 'n4')).toBe(locked);
      expect(refused(run([set('n4', { label: 'x' })], tab)).code).toBe('element_locked');
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
    it('coerces an off-vocabulary shape kind with a warning', () => {
      const outcome = run([add({ id: 'r', type: 'shape', shape: 'rectangle', ...box })]);
      expect(applied(outcome).tab.elements.at(-1)).toMatchObject({ shape: 'square' });
      expect(lines(outcome)).toContain('! shape_coerced  r shape "rectangle" drawn as square');
    });

    it('coerces a code language and drops an unknown code theme, each with a warning', () => {
      const { calls, log } = recording();
      const outcome = run(
        [
          add({
            id: 'c',
            type: 'shape',
            shape: 'code-block',
            code: 'x',
            codeLanguage: 'cobol',
            codeTheme: 'neon',
            ...box,
          }),
        ],
        checkoutFlow(),
        log,
      );
      expect(applied(outcome).warnings.map((w) => w.message)).toEqual([
        'c codeLanguage "cobol" drawn as plain',
        'c codeTheme "neon" is not a theme; removed',
      ]);
      expect(calls.filter(([fingerprint]) => fingerprint === '[edit-ops] coerced')).toEqual([
        ['[edit-ops] coerced', { operation: 1, field: 'codeLanguage' }],
        ['[edit-ops] coerced', { operation: 1, field: 'codeTheme' }],
      ]);
    });

    it('re-anchors arrows around a moved box, printing no line for anchors alone', () => {
      const outcome = run([set('n4', { x: 300, y: 200 })]);
      const a3 = applied(outcome).tab.elements.find((el) => el.id === 'a3') as Element & {
        from: { anchor: string };
      };
      expect(a3.from.anchor).not.toBe('s');
      expect(
        applied(outcome).elementOps.map((op) => op.kind === 'update' && op.element.id),
      ).toContain('a3');
      expect(lines(outcome)).toEqual(['~ n4  @40,300→@340,200', 'f2  -n4']);
    });

    it('puts lanes behind everything else', () => {
      const lane = { id: 'lane', type: 'shape', shape: 'lane', ...box, width: 800, height: 200 };
      expect(applied(run([add(lane)])).tab.elements[0]!.id).toBe('lane');
    });

    it('refuses a touched element the format does not allow, naming field and rule', () => {
      expect(refused(run([set('n3', { width: -5 })]))).toEqual({
        code: 'invalid_result',
        details: ['n3 width: a finite number, 0 or more'],
        hint: 'see the format: liveplanner schema square',
      });
    });

    it('refuses a tab an untouched element already makes invalid', () => {
      const tab = checkoutFlow();
      tab.elements.push({ id: 'broken', type: 'shape', shape: 'square' } as Element);
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
        [...mixed, add({ id: 'r', type: 'shape', shape: 'blob', ...box, y: 300 })],
        checkoutFlow(),
        log,
      );
      expect(calls).toEqual([
        ['[edit-ops] coerced', { operation: 4, field: 'shape' }],
        [
          '[edit-ops] applied',
          { operations: 4, added: 2, changed: 1, removed: 3, moved: 0, warnings: 1 },
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

    it('logs a locked element with its scope', () => {
      const { calls, log } = recording();
      const tab: Tab = {
        ...checkoutFlow(),
        layers: [{ id: 'base', name: 'Base', locked: true }],
      };
      run([set('n3', { label: 'x' })], tab, log);
      expect(calls[0]).toEqual(['[edit-ops] locked', { operation: 1, op: 'set', scope: 'layer' }]);
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
    const mixed = parseEditOperations('set nope1 label=A\nadd square id=n1');
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
      'set nope label=A\nadd square id=fresh right-of:nope\nset fresh label=B',
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
      'set nope label=A\nadd square id=fresh right-of:nope\nset other label=B',
    );
    if ('errors' in parsed) throw new Error('parse');
    const out = applyEditOperations(checkoutFlow(), parsed.operations);
    if (!('errors' in out)) throw new Error('applied');
    const last = out.errors.find((e) => e.operation === 3)!;
    expect(last.details?.[0]).toBe('"other" matches nothing');
  });
});
