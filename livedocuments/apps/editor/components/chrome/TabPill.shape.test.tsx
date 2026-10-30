// @vitest-environment jsdom

// The tab's shape (docs/specs/007-editor/editor-app.md "How a tab looks"): the active tab rises from the screen's
// bottom edge, open at its foot, with an accent bar along its top; the others sit flat on the bar. No type icon.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
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
  it('raises the active tab from the bottom edge, rounded on top, with an accent bar along its top', () => {
    const { container } = render(<TabPill tab={tab('t1', 'Roadmap')} ctx={ctx()} />);
    const el = root(container);
    expect(el.hasAttribute('data-active')).toBe(true);
    expect(el.className).toMatch(/\bbg-white\b/);
    expect(el.className).toMatch(/\brounded-t-lg\b/);
    // Its name takes the tab theme's accent, and the bar along its top the same colour.
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

  it('shows no type icon before the name, active or not', () => {
    for (const id of ['t1', 't2']) {
      const { container, unmount } = render(<TabPill tab={tab(id, 'Notes')} ctx={ctx()} />);
      expect(
        container.querySelector('button[aria-current], [data-tab] > button')?.querySelector('svg'),
      ).toBeNull();
      unmount();
    }
  });
});
