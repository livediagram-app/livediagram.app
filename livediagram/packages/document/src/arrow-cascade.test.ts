import { describe, expect, it } from 'vitest';
import { removeElements, withAttachedArrows, type ArrowElement, type Element } from './index';

// docs/specs/008-canvas/arrow-to-arrow.md: deleting a target arrow cascade-deletes the arrows attached to it, and so
// does the arrow a deleted box takes with it.

const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const link = (id: string, from: string, to: string, locked = false): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'pinned', elementId: to, anchor: 'w' },
  ...(locked ? { locked: true } : {}),
});
const hung = (id: string, onto: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'on-arrow', arrowId: onto, t: 0.5 },
});

describe('withAttachedArrows', () => {
  it("takes a box's connector and the arrow hung off that connector", () => {
    const els = [box('a'), box('b'), link('x', 'a', 'b'), hung('y', 'x'), hung('z', 'y')];
    expect([...withAttachedArrows(els, new Set(['a']))].sort()).toEqual(['a', 'x', 'y', 'z']);
  });

  it('stops at a protected arrow, and leaves what hangs off it', () => {
    const els = [box('a'), box('b'), link('x', 'a', 'b', true), hung('y', 'x')];
    const out = withAttachedArrows(els, new Set(['a']), (el) => el.locked === true);
    expect([...out]).toEqual(['a']);
  });

  it('walks a long chain in linear time', () => {
    // 5,000 arrows each hung off the one after it, listed so a pass-until-stable loop would need one pass each.
    const n = 5_000;
    const els: Element[] = [box('a')];
    for (let i = 0; i < n; i += 1)
      els.push(i === n - 1 ? link(`c${i}`, 'a', 'a') : hung(`c${i}`, `c${i + 1}`));
    const started = performance.now();
    const out = withAttachedArrows(els, new Set(['a']));
    expect(out.size).toBe(n + 1);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Delete / Backspace": a kept arrow's end on a removed element is freed
// where it was drawn, the other end and every other element untouched.
describe('removeElements', () => {
  const box = (id: string, x: number): Element => ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y: 0,
    width: 100,
    height: 60,
  });
  const arrow = (id: string, extra: Partial<ArrowElement> = {}): ArrowElement => ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    ...extra,
  });

  it('frees a kept arrow end on a removed element, and keeps what `keep` holds', () => {
    const els = [box('a', 0), box('b', 300), arrow('x', { locked: true }), arrow('y')];
    const out = removeElements(els, new Set(['a', 'x', 'y']), (el) => el.locked === true);
    expect(out.map((e) => e.id)).toEqual(['b', 'x']);
    expect((out[1] as ArrowElement).from).toEqual({ kind: 'free', x: 100, y: 30 });
    expect((out[1] as ArrowElement).to).toEqual({ kind: 'pinned', elementId: 'b', anchor: 'w' });
  });

  it('hands back the same elements when nothing goes', () => {
    const els = [box('a', 0), arrow('x')];
    const out = removeElements(els, new Set(['nope']));
    expect(out[1]).toBe(els[1]);
  });
});
