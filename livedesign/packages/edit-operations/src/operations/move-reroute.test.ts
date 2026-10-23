// A moved box's arrows are drawn afresh when the move re-anchors them (EO31): kept, an old bend ran the line through
// the box it had moved to.
import { describe, expect, it } from 'vitest';
import {
  arrowPolyline,
  elementIndexFor,
  type ArrowElement,
  type BoxedElement,
  type Tab,
} from '@livedesign/design';
import { applied } from '../fixtures/outcomes';
import { laidOutTab } from '../fixtures/laid-out-tabs';
import { run } from '../fixtures/run';

const fan = (): Tab => laidOutTab('fan');

const into = (tab: Tab, id: string) =>
  tab.elements.find(
    (e) => e.type === 'arrow' && e.to.kind === 'pinned' && e.to.elementId === id,
  ) as ArrowElement;

describe('move re-routes a re-anchored arrow', () => {
  it('drops the old bends and draws the line clear of the moved box', () => {
    const start = fan();
    expect(into(start, 'c').curvePoints).toBeDefined();
    const { tab } = applied(run('move c right-of:gw', start));
    const arrow = into(tab, 'c');
    expect(arrow.curvePoints).not.toEqual(into(start, 'c').curvePoints);
    const c = tab.elements.find((e) => e.id === 'c') as BoxedElement;
    const inside = (p: { x: number; y: number }) =>
      p.x > c.x + 1 && p.x < c.x + c.width - 1 && p.y > c.y + 1 && p.y < c.y + c.height - 1;
    expect(arrowPolyline(arrow, elementIndexFor(tab.elements)).some(inside)).toBe(false);
  });
});
