// An angled arrow joins its source's trunk (docs/specs/024-agents/edit-operations.md "Layout on edit"): a service
// added to the row under a gateway hangs off the gateway's bar like its siblings, not sideways behind them.
import { describe, expect, it } from 'vitest';
import {
  arrowPolyline,
  elementIndexFor,
  type ArrowElement,
  type BoxedElement,
  type Tab,
} from '@livedocuments/document';
import { applied } from '../fixtures/outcomes';
import { laidOutTab } from '../fixtures/laid-out-tabs';
import { run } from '../fixtures/run';

const gateway = (direction: 'down' | 'right' = 'down'): Tab => laidOutTab(`gateway-${direction}`);

const arrowTo = (tab: Tab, to: string) =>
  tab.elements.find(
    (el) => el.type === 'arrow' && el.to.kind === 'pinned' && el.to.elementId === to,
  ) as ArrowElement;

describe('connect joins a trunk', () => {
  it("leaves from the trunk's point and bends in its channel", () => {
    const { tab } = applied(
      run('add square id=d label="Service D" right-of:c\nconnect gw -> d', gateway()),
    );
    const made = arrowTo(tab, 'd');
    const sibling = arrowTo(tab, 'c');
    expect(made).toMatchObject({
      arrowStyle: 'angled',
      exactStart: true,
      from: { elementId: 'gw', anchor: sibling.from.kind === 'pinned' ? sibling.from.anchor : '' },
      to: { elementId: 'd', anchor: 'n' },
    });
    const index = elementIndexFor(tab.elements);
    const bendY = (a: ArrowElement) => arrowPolyline(a, index)[1]!.y;
    expect(Math.abs(bendY(made) - bendY(sibling))).toBeLessThan(0.5);
  });

  it('joins a trunk across the page too, out of the side the flow leaves by', () => {
    const { tab } = applied(
      run('add square id=d label="Service D" below:c\nconnect gw -> d', gateway('right')),
    );
    const made = arrowTo(tab, 'd');
    const sibling = arrowTo(tab, 'c');
    expect(made).toMatchObject({ exactStart: true, to: { elementId: 'd', anchor: 'w' } });
    const index = elementIndexFor(tab.elements);
    const bendX = (a: ArrowElement) => arrowPolyline(a, index)[1]!.x;
    expect(Math.abs(bendX(made) - bendX(sibling))).toBeLessThan(0.5);
  });

  it("draws its own line when the target sits before the trunk's channel", () => {
    const start = gateway();
    const gw = start.elements.find((e) => e.id === 'gw') as BoxedElement;
    // Just below the gateway, above where the trunk bends: no channel between them to join.
    const { tab } = applied(
      run(
        `add square id=z label=Z x=${gw.x + 400} y=${gw.y + gw.height + 4}\nconnect gw -> z`,
        start,
      ),
    );
    expect(arrowTo(tab, 'z').exactStart).toBeUndefined();
  });
});
