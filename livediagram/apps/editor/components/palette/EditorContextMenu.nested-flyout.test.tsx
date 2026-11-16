// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { stubResizeObserver } from '@liveworkspace/vitest-config/stub-resize-observer';
import { createShape, type Element } from '@livediagram/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/008-canvas/canvas-and-palette.md "A flyout can hold a flyout": the Mind Map flyout sits inside the
// Tools flyout, and opening it used to close Tools (the scaffold kept one open flyout), so both vanished and
// Tools > Mind Map did nothing.
beforeAll(stubResizeObserver);
afterEach(cleanup);

function open(target: Element, extra: Record<string, unknown> = {}) {
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    flowchart: undefined,
    ...extra,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

const row = (title: string) =>
  document.querySelector<HTMLElement>(`[data-menu-section="${title}"]`);

// Mind Map is Tools' lone section on a mind node, so it is promoted into the menu itself (canvas-and-palette.md, the
// lone-section promotion): no Tools row to pass through.
describe('Mind Map in a mind node’s menu', () => {
  it('opens Outline, Branching and Spacing straight from the menu', () => {
    const node = { ...createShape('mind-node', 0, 0), id: 'root', label: 'Offsite' } as Element;
    open(node, { mindFlow: 'tree', mindSpacing: 'comfortable' });
    expect(row('Tools')).toBeNull();
    fireEvent.click(row('Mind Map')!);
    expect(row('Mind Map')!.getAttribute('aria-expanded')).toBe('true');
    for (const title of ['Outline', 'Branching', 'Spacing'])
      expect(screen.getByRole('button', { name: title })).toBeTruthy();
  });
});
