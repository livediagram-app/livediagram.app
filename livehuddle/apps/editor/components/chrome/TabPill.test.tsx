// @vitest-environment jsdom

// A tab outside a tab-scoped session's scope (docs/specs/013-workspace/tab-scoped-share-links.md) renders as
// a "Not shared" pill: no name, not selectable, no menu, no drag.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livehuddle/document';
import { TabPill, type TabPillCtx } from './TabPill';

function ctx(over: Partial<TabPillCtx> = {}): TabPillCtx {
  return {
    activeId: 't2',
    editingId: null,
    setEditingId: vi.fn(),
    menuFor: null,
    setMenuFor: vi.fn(),
    readOnly: true,
    isDark: true,
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
    isOutOfScope: (id) => id !== 't2',
    tabMenuProps: () => ({}) as ReturnType<TabPillCtx['tabMenuProps']>,
    ...over,
  };
}

const tab = (id: string, name: string): Tab => ({ id, name, elements: [] });

afterEach(cleanup);

describe('TabPill out of scope', () => {
  it('reads "Not shared" and never shows a name', () => {
    render(<TabPill tab={tab('t1', '')} ctx={ctx()} />);
    const pill = screen.getByRole('button', { name: 'Not shared' });
    expect(pill.getAttribute('aria-disabled')).toBe('true');
  });

  it('does nothing when clicked', () => {
    const c = ctx();
    render(<TabPill tab={tab('t1', '')} ctx={c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not shared' }));
    expect(c.onSelect).not.toHaveBeenCalled();
  });

  it('cannot be dragged or open a menu', () => {
    const c = ctx({ readOnly: false });
    const { container } = render(<TabPill tab={tab('t1', '')} ctx={c} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('draggable')).toBe('false');
    fireEvent.contextMenu(root);
    expect(c.setMenuFor).not.toHaveBeenCalled();
  });

  it('leaves the scoped tab an ordinary pill', () => {
    render(<TabPill tab={tab('t2', 'Roadmap')} ctx={ctx()} />);
    expect(screen.getByRole('button', { name: /Roadmap/ })).toBeTruthy();
  });
});

// docs/specs/007-editor/editor-modes.md "The tab pill shows no mode icon": the name alone, whatever the mode.
describe('TabPill mode icon', () => {
  it.each([undefined, 'draw' as const])(
    'shows no icon before the name (opens in %s)',
    (opensIn) => {
      render(<TabPill tab={{ ...tab('t2', 'Board'), opensIn }} ctx={ctx()} />);
      expect(screen.getByRole('button', { name: 'Board' }).querySelector('svg')).toBeNull();
    },
  );
});

// docs/specs/004-interface-design/touch-targets.md: the tab's name reaches a 44px-tall tap area on a
// touch screen, vertically only, since the tabs sit side by side.
describe('TabPill tap area', () => {
  it('carries the vertical touch pad on a positioned button', () => {
    render(<TabPill tab={tab('t2', 'Board')} ctx={ctx()} />);
    const button = screen.getByRole('button', { name: 'Board' });
    expect(button.className).toMatch(/\btouch-target-y\b/);
    expect(button.className).toMatch(/\brelative\b/);
  });
});
