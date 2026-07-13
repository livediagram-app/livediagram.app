import { describe, expect, it } from 'vitest';
import { rebindArrowAnchorsAfterMove } from './arrow-rebind';
import { createShape } from './factories';
import type { Anchor, ArrowElement, Element } from './index';

// The auto-rebind confidence gate (spec/09): a settled arrow only re-plans
// when its current faces genuinely broke (the line no longer exits through
// them, or the best face beats them decisively). Regression suite for the
// "subtly moved the hub and half the fan reshuffled" report: geometry
// mirrors the user's six-child tree screenshots.

function box(id: string, x: number, y: number, width = 198, height = 88) {
  return { ...createShape('square', x, y), id, width, height };
}

function pinnedArrow(
  id: string,
  fromId: string,
  fromAnchor: Anchor,
  toId: string,
  toAnchor: Anchor,
): ArrowElement {
  return {
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}

const CHILD_XS = [78, 322, 566, 830, 1066, 1300];

function fanFixture(hub: ReturnType<typeof box>): Element[] {
  const children = CHILD_XS.map((x, i) => box(`c${i}`, x, 288));
  const arrows = children.map((c, i) => pinnedArrow(`a${i}`, c.id, 'n', 'hub', 's'));
  return [hub, ...children, ...arrows];
}

function anchorsOf(els: Element[]): string[] {
  return els
    .filter((e): e is ArrowElement => e.type === 'arrow')
    .map(
      (a) =>
        `${a.id}: ${(a.from as { anchor: Anchor }).anchor} -> ${(a.to as { anchor: Anchor }).anchor}`,
    );
}

describe('rebind stability (confidence gate)', () => {
  it('keeps every anchor when the hub moves subtly (screenshot delta)', () => {
    const settled = fanFixture(box('hub', 688, 104));
    const moved = fanFixture(box('hub', 628, 118));
    const after = rebindArrowAnchorsAfterMove(moved, new Set(['hub']));
    expect(anchorsOf(after)).toEqual(anchorsOf(settled));
  });

  it('keeps every anchor on a tiny 5px move', () => {
    const moved = fanFixture(box('hub', 693, 106));
    const after = rebindArrowAnchorsAfterMove(moved, new Set(['hub']));
    expect(anchorsOf(after)).toEqual(anchorsOf(fanFixture(box('hub', 693, 106))));
  });

  it('keeps a subtly-moved CHILD attached the same way', () => {
    const els = fanFixture(box('hub', 688, 104)).map((e) =>
      e.id === 'c0' ? { ...e, x: (e as { x: number }).x + 12, y: (e as { y: number }).y + 6 } : e,
    );
    const after = rebindArrowAnchorsAfterMove(els as Element[], new Set(['c0']));
    expect(anchorsOf(after)).toEqual(anchorsOf(els as Element[]));
  });

  it('still re-plans an arrow whose faces genuinely broke', () => {
    // Drag c0 ABOVE the hub: its n -> s pair now points away on both ends
    // (the child's top face aims at nothing, the hub's bottom faces away),
    // so the gate lets the arrow re-plan onto sensible faces.
    const els = fanFixture(box('hub', 688, 104)).map((e) =>
      e.id === 'c0' ? { ...e, x: 688, y: -320 } : e,
    );
    const after = rebindArrowAnchorsAfterMove(els as Element[], new Set(['c0']));
    const a0 = after.find((e) => e.id === 'a0') as ArrowElement;
    expect((a0.from as { anchor: Anchor }).anchor).toBe('s');
    expect((a0.to as { anchor: Anchor }).anchor).toBe('n');
    // The untouched siblings stay put.
    expect(anchorsOf(after).slice(1)).toEqual(anchorsOf(els as Element[]).slice(1));
  });
});
