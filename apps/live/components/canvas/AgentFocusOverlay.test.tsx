// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@livediagram/document';
import {
  AgentFocusContext,
  AgentFocusOverlay,
  type AgentFocusByElement,
} from './AgentFocusOverlay';

// docs/specs/024-agents/blueprints/agent-presence.md "Presentation and UX", "Accessibility".

const box = (id: string, x: number): Element =>
  ({ id, type: 'shape', shape: 'square', x, y: 10, width: 100, height: 50 }) as Element;

function rings(focus: AgentFocusByElement) {
  const view = render(
    <AgentFocusContext.Provider value={focus}>
      <AgentFocusOverlay elements={[box('a', 0), box('b', 200)]} />
    </AgentFocusContext.Provider>,
  );
  return view.container;
}

describe('AgentFocusOverlay', () => {
  afterEach(cleanup);

  it('rings each focused element 4 px outside in the owner’s colour, nesting a second person’s ring', () => {
    const container = rings(
      new Map([
        [
          'a',
          [
            { name: 'Webber', color: 'rgb(255, 0, 0)' },
            { name: 'Ada', color: 'rgb(0, 0, 255)' },
          ],
        ],
        ['gone', [{ name: 'Webber', color: 'rgb(255, 0, 0)' }]],
      ]),
    );
    const found = [...container.querySelectorAll<HTMLElement>('[data-agent-focus-id]')];
    expect(
      found.map((el) => [el.style.left, el.style.top, el.style.width, el.style.borderColor]),
    ).toEqual([
      ['-4px', '6px', '108px', 'rgb(255, 0, 0)'],
      ['-8px', '2px', '116px', 'rgb(0, 0, 255)'],
    ]);
    expect(container.querySelector('[data-agent-focus]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws nothing when no agent names a focus', () => {
    expect(rings(new Map()).querySelector('[data-agent-focus]')).toBeNull();
  });
});
