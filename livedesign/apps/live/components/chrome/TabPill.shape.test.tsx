// @vitest-environment jsdom

// The tab's look (docs/specs/007-editor/live-app.md "How a tab looks"): the open tab is a card that joins the screen's
// bottom edge, its name in the tab theme's accent, with nothing along its top; the others are quiet. No type icon.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
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
      isDragging: () => false,
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

describe('TabPill look', () => {
  it('shows the open tab as a card with its name in the accent, and no bar along its top', () => {
    const { container } = render(<TabPill tab={tab('t1', 'Roadmap')} ctx={ctx()} />);
    const el = root(container);
    expect(el.hasAttribute('data-active')).toBe(true);
    expect(el.className).toMatch(/\bbefore:opacity-100\b/);
    expect(el.className).toMatch(/\brounded-t-\[10px\]/);
    expect(el.style.color).not.toBe('');
    expect(el.querySelector('span[aria-hidden].absolute')).toBeNull();
    expect(screen.getByRole('button', { name: 'Roadmap' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('keeps the other tabs quiet, in neutral ink', () => {
    const { container } = render(<TabPill tab={tab('t2', 'Notes')} ctx={ctx()} />);
    const el = root(container);
    expect(el.hasAttribute('data-active')).toBe(false);
    expect(el.className).toMatch(/\bbefore:opacity-0\b/);
    expect(el.style.color).toBe('');
  });

  it('dims the tab being dragged', () => {
    const drag = {
      caretFor: () => 'after' as const,
      handlersFor: () => ({}),
      isDragging: () => true,
    } as unknown as TabPillCtx['reorderDrag'];
    const { container } = render(
      <TabPill tab={tab('t2', 'Notes')} ctx={ctx({ reorderDrag: drag })} />,
    );
    expect(root(container).className).toMatch(/\bopacity-50\b/);
  });

  it('shows no type icon before the name, open or not', () => {
    for (const id of ['t1', 't2']) {
      const { unmount } = render(<TabPill tab={tab(id, 'Notes')} ctx={ctx()} />);
      expect(screen.getByRole('button', { name: 'Notes' }).querySelector('svg')).toBeNull();
      unmount();
    }
  });
});
