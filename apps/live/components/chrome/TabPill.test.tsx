// @vitest-environment jsdom

// A tab outside a tab-scoped session's scope (docs/specs/013-workspace/tab-scoped-share-links.md) renders as
// a "Not shared" pill: no name, not selectable, no menu, no drag.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { FlowchartIcon, MarkerIcon } from '@livediagram/ui';
import { EditorModeProvider } from './editor-mode/editor-mode-context';
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

// docs/specs/007-editor/editor-modes.md "The tab pill shows what it opens in".
describe('TabPill opening-mode icon', () => {
  it.each([
    ['Diagram', undefined, FlowchartIcon],
    ['Draw', 'draw' as const, MarkerIcon],
  ])('leads with the %s mode icon', (_, opensIn, Icon) => {
    const expected = render(<Icon size={12} />).container.querySelector('svg')!.innerHTML;
    cleanup();
    render(<TabPill tab={{ ...tab('t2', 'Board'), opensIn }} ctx={ctx()} />);
    const button = screen.getByRole('button', { name: 'Board' });
    expect(button.querySelector('svg')!.innerHTML).toBe(expected);
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": nothing is remembered per person.
  it("shows the tab's own mode, never one an earlier editor remembered in this browser", () => {
    const expected = render(<FlowchartIcon size={12} />).container.querySelector('svg')!.innerHTML;
    cleanup();
    localStorage.setItem('livediagram:v2:editor-mode:pill-switched', 'draw');
    render(
      <EditorModeProvider
        value={{ mode: 'diagram', setMode: vi.fn(), canSwitch: true, canEdit: true }}
      >
        <TabPill
          tab={tab('pill-switched', 'Board')}
          ctx={ctx({ activeId: 'pill-switched', isOutOfScope: () => false })}
        />
      </EditorModeProvider>,
    );
    const button = screen.getByRole('button', { name: 'Board' });
    expect(button.querySelector('svg')!.innerHTML).toBe(expected);
    localStorage.clear();
  });
});
