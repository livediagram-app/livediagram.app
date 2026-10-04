import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import type { EditOperation } from '../types';

const run = (operations: EditOperation[], tab: Tab = checkoutFlow()) =>
  applyEditOperations(tab, operations, { makeId: fixedIds() });
const rm = (target: string, keepArrows?: true): EditOperation => ({
  op: 'rm',
  target,
  ...(keepArrows ? { keepArrows } : {}),
});
const withElements = (...extra: Element[]): Tab => {
  const tab = checkoutFlow();
  return { ...tab, elements: [...tab.elements, ...extra] };
};
const lockedCopy = (tab: Tab, id: string): Tab => ({
  ...tab,
  elements: tab.elements.map((el) => (el.id === id ? { ...el, locked: true } : el)),
});

describe('rm', () => {
  it('removes the element and the arrows pinned to it, listing them', () => {
    const outcome = run([rm('n4')]);
    expect(applied(outcome).tab.elements.map((el) => el.id)).not.toEqual(
      expect.arrayContaining(['n4', 'a3', 'a4']),
    );
    expect(applied(outcome).targets).toEqual(['n4']);
    expect(lines(outcome)).toEqual([
      '- n4  square "Address"',
      '- a3  arrow n3→n4 (pinned to n4)',
      '- a4  arrow n4→n5 (pinned to n4)',
    ]);
  });

  it('removes arrows attached to a removed arrow, transitively', () => {
    const onA3: Element = {
      id: 'note-arrow',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 't1', anchor: 'w' },
      to: { kind: 'on-arrow', arrowId: 'a3', t: 0.5 },
    };
    expect(lines(run([rm('n4')], withElements(onA3)))).toContain(
      '- note-arrow  arrow t1→a3 (pinned to a3)',
    );
  });

  it('removes an arrow attached to two removed elements once', () => {
    const both: Element = {
      id: 'both',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'n4', anchor: 'e' },
      to: { kind: 'on-arrow', arrowId: 'a3', t: 0.5 },
    };
    expect(
      lines(run([rm('n4')], withElements(both))).filter((l) => l.startsWith('- both')),
    ).toEqual(['- both  arrow n4→a3 (pinned to n4)']);
  });

  it('frees the attached ends where they are drawn with keepArrows', () => {
    const outcome = run([rm('n4', true)]);
    const { tab, warnings } = applied(outcome);
    expect(tab.elements.find((el) => el.id === 'a3')).toMatchObject({
      to: { kind: 'free', x: 70, y: 300 },
    });
    expect(warnings.map((w) => [w.code, w.ref])).toEqual([
      ['arrows_freed', 'a3'],
      ['arrows_freed', 'a4'],
    ]);
    expect(lines(outcome)).toEqual([
      '~ a3  to n4→@110,300',
      '~ a4  from n4→@110,360',
      '- n4  square "Address"',
      '! arrows_freed  a3 to freed where it was drawn: n4 was removed',
      '! arrows_freed  a4 from freed where it was drawn: n4 was removed',
    ]);
  });

  it('keeps an arrow whose two ends were removed with keepArrows (E14)', () => {
    const { tab } = applied(run([rm('n3', true), rm('n4', true)]));
    expect(tab.elements.find((el) => el.id === 'a3')).toMatchObject({
      from: { kind: 'free' },
      to: { kind: 'free' },
    });
  });

  it('frees both ends of an arrow from and to the same element in one warning', () => {
    const loop: Element = {
      id: 'loop',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 't1', anchor: 'e' },
      to: { kind: 'pinned', elementId: 't1', anchor: 's' },
    };
    const { warnings } = applied(run([rm('t1', true)], withElements(loop)));
    expect(warnings[0]!.message).toBe('loop from and to freed where it was drawn: t1 was removed');
  });

  it('removes a mind node parent link to a removed node (EO30)', () => {
    const mind = (id: string, mindParentId?: string): Element => ({
      id,
      type: 'shape',
      shape: 'mind-node',
      x: 400,
      y: 0,
      width: 120,
      height: 40,
      textSize: 'md',
      ...(mindParentId ? { mindParentId } : {}),
    });
    const outcome = run([rm('root')], withElements(mind('root'), mind('child', 'root')));
    expect(applied(outcome).tab.elements.find((el) => el.id === 'child')).not.toHaveProperty(
      'mindParentId',
    );
    expect(lines(outcome)).toEqual(['~ child  mindParentId root→', '- root  mind-node']);
  });

  it('removes a mind node child without touching its parent', () => {
    const child: Element = {
      id: 'child',
      type: 'shape',
      shape: 'mind-node',
      mindParentId: 'n1',
      x: 400,
      y: 0,
      width: 120,
      height: 40,
    };
    const sibling = { ...child, id: 'sibling' };
    expect(lines(run([rm('child')], withElements(child, sibling)))).toEqual(['- child  mind-node']);
  });

  it('frees nothing when the removed element has no arrows', () => {
    const outcome = run([rm('t1', true)]);
    expect(applied(outcome).warnings).toEqual([]);
    expect(lines(outcome)).toEqual(['- t1  text "Retry up to 3 times"']);
  });

  it('refuses a locked mind node that would lose its parent', () => {
    const mind = (id: string, mindParentId?: string): Element => ({
      id,
      type: 'shape',
      shape: 'mind-node',
      x: 400,
      y: 0,
      width: 120,
      height: 40,
      textSize: 'md',
      ...(mindParentId ? { mindParentId, locked: true } : {}),
    });
    expect(
      refused(run([rm('root')], withElements(mind('root'), mind('child', 'root')))),
    ).toMatchObject({
      code: 'element_locked',
      details: ['locked:', '  child  mind-node (element)'],
    });
  });

  it('refuses a locked target, a locked pinned arrow, and a locked arrow to free', () => {
    expect(refused(run([rm('n4')], lockedCopy(checkoutFlow(), 'n4'))).details[1]).toBe(
      '  n4  square "Address" (element)',
    );
    expect(refused(run([rm('n4')], lockedCopy(checkoutFlow(), 'a4'))).details[1]).toBe(
      '  a4  arrow n4→n5 (element)',
    );
    expect(refused(run([rm('n4', true)], lockedCopy(checkoutFlow(), 'a3'))).details[1]).toBe(
      '  a3  arrow n3→n4 (element)',
    );
  });

  it('cannot find an element an earlier operation removed (E3)', () => {
    expect(refused(run([rm('n4'), rm('n4')]))).toMatchObject({
      code: 'target_not_found',
      operation: 2,
    });
  });
});

describe('rm with selectors', () => {
  it('removes every match with all, once each, even an arrow an earlier match took with it', () => {
    const outcome = run([{ op: 'rm', target: 'label~s', all: true }]);
    expect(lines(outcome)).toEqual([
      '- n1  stadium "Start"',
      '- a1  arrow n1→n2 (pinned to n1)',
      '- n4  square "Address"',
      '- a3  arrow n3→n4 (pinned to n4)',
      '- a4  arrow n4→n5 (pinned to n4)',
      '- n5  square "Card details"',
      '- a5  arrow n5→n6 (pinned to n5)',
      '- n6  diamond "3-D Secure?"',
      '- a6  arrow n6→n7 "yes" (pinned to n6)',
      '- t1  text "Retry up to 3 times"',
    ]);
  });

  it('needs all for several matches', () => {
    expect(refused(run([rm('type:stadium')])).code).toBe('target_ambiguous');
  });
});
