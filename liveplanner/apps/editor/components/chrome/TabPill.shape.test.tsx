// @vitest-environment jsdom

// The tab's shape (docs/specs/007-editor/editor-app.md "How a tab looks"): the active tab hangs from the canvas edge
// in its colour with an accent bar along its foot; the others sit flat on the bar.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { TabPill, type TabPillCtx } from './TabPill';

function ctx(over: Partial<TabPillCtx> = {}): TabPillCtx {
  return {
    activeId: 't1',
    editingId: null,
    setEditingId: vi.fn(),
    menuFor: null,
    setMenuFor: vi.fn(),
    readOnly: true,
    isDark: false,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    reorderDrag: {
      caretFor: () => null,
      handlersFor: () => ({}),
    } as unknown as TabPillCtx['reorderDrag'],
    participantsByTab: new Map(),
    selfId: 'me',
    selfRole: 'view',
    tabMenuProps: () => ({}) as ReturnType<TabPillCtx['tabMenuProps']>,
    ...over,
  };
}

const tab = (id: string, name: string): Tab => ({ id, name, elements: [] });

afterEach(cleanup);

const root = (container: HTMLElement) => container.querySelector('[data-tab]') as HTMLElement;

describe('TabPill shape', () => {
  it('raises the active tab in the canvas colour, joined to its edge, with an accent bar at its foot', () => {
    const { container } = render(<TabPill tab={tab('t1', 'Roadmap')} ctx={ctx()} />);
    const el = root(container);
    expect(el.hasAttribute('data-active')).toBe(true);
    expect(el.className).toMatch(/\bbg-white\b/);
    expect(el.className).toMatch(/\brounded-b-lg\b/);
    // Its name takes the tab theme's accent, and the bar along its foot the same colour.
    expect(el.style.color).not.toBe('');
    const bar = el.querySelector('span[aria-hidden].absolute') as HTMLElement;
    expect(bar.style.backgroundColor).not.toBe('');
  });

  it('keeps the other tabs flat on the bar, in neutral ink, with no accent', () => {
    const { container } = render(<TabPill tab={tab('t2', 'Notes')} ctx={ctx()} />);
    const el = root(container);
    expect(el.hasAttribute('data-active')).toBe(false);
    expect(el.className).toMatch(/\bborder-transparent\b/);
    expect(el.className).not.toMatch(/\bbg-white\b/);
    expect(el.style.color).toBe('');
  });
  // A phone keeps the room for names: the type icon shows on a computer only.
  it('wraps the tab type icon so a phone leaves it out', () => {
    const { container } = render(<TabPill tab={tab('t2', 'Notes')} ctx={ctx()} />);
    const svg = container.querySelector('button svg') as SVGElement;
    expect(svg.parentElement?.className).toBe('contents phone:hidden');
  });
});
