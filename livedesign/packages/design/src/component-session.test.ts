import { describe, expect, it } from 'vitest';
import {
  activeComponentSessions,
  deriveComponentFromSession,
  finishComponentEdit,
  sessionMembers,
  startComponentEdit,
  stampSessionMembers,
} from './component-session';
import { arrow, box, instanceOf, navMain } from './components.test.fixtures';
import type { ArrowElement, Element, ShapeElement } from './index';

const main = navMain();

describe('the edit session', () => {
  it('starts: the instance hidden, the main after it as marked plain elements without overrides', () => {
    const inst = instanceOf(main, {
      width: 400,
      height: 80,
      componentOverrides: { brand: { label: 'X' } },
    });
    const els: Element[] = [box('inst-bar', 0, 0), inst];
    const out = startComponentEdit(els, 'inst', main, 'me');
    expect(activeComponentSessions(out).map((e) => e.id)).toEqual(['inst']);
    const members = sessionMembers(out, 'inst');
    expect(members.map((m) => m.id)).toEqual(['inst-bar-2', 'inst-brand', 'inst-icon']);
    expect(members[1]).toMatchObject({
      label: 'Acme',
      componentMember: { instanceId: 'inst', elementId: 'brand' },
    });
    expect(members[0]).toMatchObject({ x: 100, y: 50, width: 400, height: 80 });
    expect(startComponentEdit(out, 'inst', main, 'me')).toBe(out);
    expect(startComponentEdit(els, 'nope', main, 'me')).toBe(els);
  });

  it('stamps elements added during the one session open', () => {
    const started = startComponentEdit([instanceOf(main)], 'inst', main, 'me');
    const added = [
      ...started,
      box('new', 0, 0),
      { id: 'img', type: 'image', x: 0, y: 0, width: 1, height: 1, imageId: null } as Element,
    ];
    const out = stampSessionMembers(started, added);
    expect(out.find((e) => e.id === 'new')!.componentMember).toEqual({
      instanceId: 'inst',
      elementId: 'new',
    });
    expect(out.find((e) => e.id === 'img')!.componentMember).toBeUndefined();
    expect(stampSessionMembers(started, started)).toBe(started);
    const none = [box('a', 0, 0)];
    expect(stampSessionMembers([], none)).toBe(none);
  });

  it('derives the main from its members, back in the frame at the instance scale', () => {
    const inst = instanceOf(main, { width: 400, height: 80 });
    let els = startComponentEdit([box('outside', 0, 0), inst], 'inst', main, 'me');
    // Move the brand, add a joined arrow and one pinned outside, and a new attached chip.
    els = els.map((e) => (e.id === 'inst-brand' ? { ...e, x: (e as ShapeElement).x + 20 } : e));
    els = [
      ...els,
      {
        ...arrow(
          'ar',
          { kind: 'pinned', elementId: 'inst-bar', anchor: 'e' },
          { kind: 'pinned', elementId: 'outside', anchor: 'w' },
        ),
        curveOffset: { dx: 4, dy: 4 },
        elbowOffset: { dx: 2, dy: 2 },
        curvePoints: [{ dx: 2, dy: 2 }],
        componentMember: { instanceId: 'inst', elementId: 'ar' },
      },
      {
        ...arrow(
          'ar2',
          { kind: 'on-arrow', arrowId: 'ar', t: 0.5 },
          { kind: 'free', x: 140, y: 90 },
        ),
        componentMember: { instanceId: 'inst', elementId: 'ar2' },
      },
      {
        ...arrow(
          'ar3',
          { kind: 'on-arrow', arrowId: 'elsewhere', t: 0.5 },
          { kind: 'free', x: 100, y: 50 },
        ),
        componentMember: { instanceId: 'inst', elementId: 'ar3' },
      },
      {
        ...box('chip', 100, 50, 4, 4),
        attachedTo: 'inst-bar',
        componentMember: { instanceId: 'inst', elementId: 'chip' },
      },
    ];
    const derived = deriveComponentFromSession(els, 'inst', main, 9)!;
    expect(derived).toMatchObject({ width: 200, height: 40, updatedAt: 9 });
    expect(derived.elements.map((e) => e.id)).toEqual([
      'bar',
      'brand',
      'icon',
      'ar',
      'ar2',
      'ar3',
      'chip',
    ]);
    expect(derived.elements[1]).toMatchObject({ x: 20, y: 10 });
    expect(derived.elements[1]).not.toHaveProperty('componentMember');
    const ar = derived.elements[3] as ArrowElement;
    expect(ar.from).toEqual({ kind: 'pinned', elementId: 'bar', anchor: 'e' });
    expect(ar.to.kind).toBe('free');
    expect(ar.curveOffset).toEqual({ dx: 2, dy: 2 });
    expect(ar.elbowOffset).toEqual({ dx: 1, dy: 1 });
    expect(ar.curvePoints).toEqual([{ dx: 1, dy: 1 }]);
    const ar2 = derived.elements[4] as ArrowElement;
    expect(ar2.from).toEqual({ kind: 'on-arrow', arrowId: 'ar', t: 0.5 });
    expect(ar2.to).toEqual({ kind: 'free', x: 20, y: 20 });
    expect((derived.elements[5] as ArrowElement).from.kind).toBe('free');
    expect((derived.elements[6] as { attachedTo?: string }).attachedTo).toBe('bar');
  });

  it('derives nothing without members or an instance', () => {
    expect(deriveComponentFromSession([instanceOf(main)], 'inst', main, 1)).toBeNull();
    expect(deriveComponentFromSession([], 'inst', main, 1)).toBeNull();
  });

  it('finishes: members gone, the instance shown; with no members the instance goes too', () => {
    const started = startComponentEdit([instanceOf(main), box('keep', 0, 0)], 'inst', main, 'me');
    const done = finishComponentEdit(started, 'inst');
    expect(done.map((e) => e.id)).toEqual(['inst', 'keep']);
    expect(done[0]).not.toHaveProperty('componentEditBy');
    const emptied = started.filter((e) => !e.componentMember);
    expect(finishComponentEdit(emptied, 'inst').map((e) => e.id)).toEqual(['keep']);
  });
});
