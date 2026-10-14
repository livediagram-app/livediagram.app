// An angled arrow joins its source's trunk (docs/specs/024-agents/edit-operations.md "Layout on edit"): a service
// added to the row under a gateway hangs off the gateway's bar like its siblings, not sideways behind them.
import { describe, expect, it } from 'vitest';
import {
  arrowPolyline,
  buildGraphTab,
  elementIndexFor,
  resolveGraphInput,
  type ArrowElement,
  type Tab,
} from '@livediagram/document';
import { applied } from '../fixtures/outcomes';
import { run } from '../fixtures/run';

const gateway = (): Tab =>
  buildGraphTab(
    't',
    'T',
    resolveGraphInput({
      graph: {
        style: 'flow',
        direction: 'down',
        nodes: [
          { id: 'gw', label: 'Gateway' },
          { id: 'a', label: 'Service A' },
          { id: 'b', label: 'Service B' },
          { id: 'c', label: 'Service C' },
        ],
        edges: [
          { from: 'gw', to: 'a' },
          { from: 'gw', to: 'b' },
          { from: 'gw', to: 'c' },
        ],
      },
    }).graph!,
    undefined,
  ) as Tab;

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
});
