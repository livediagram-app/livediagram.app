// @vitest-environment jsdom

// A tap on the page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A tap is a press"; blueprint
// page-tree.md "A tap never re-mounts what it lands on", Work Tracker 1417). On an iPad a tap on a row, its + or its
// ... did nothing: the finger's pointerover and the tap's focus marked the row active, which re-mounted its title and
// buttons (their tooltip and hover cards) under the finger, so the click went nowhere. A tap now marks nothing, and
// each lands the first time; a mouse still marks the row as before.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageTree, TOUCH_FOCUS_MS, type PageTreeActions } from './PageTree';
import { PageTreeSidebar, type PageTreeSidebarProps } from './PageTreeSidebar';
import { ROW_TOUCH_BUTTON } from './page-tree-row-styles';
import type { TreeTab } from './page-tree-view';

const TABS: TreeTab[] = [
  { id: 'a', name: 'Handbook' },
  { id: 'b', name: 'Release Process', parent: 'a' },
  { id: 'e', name: 'Notes' },
];

function actions(): PageTreeActions {
  return {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onStep: vi.fn(),
    onIndent: vi.fn(),
    onOutdent: vi.fn(),
    onCopyLink: vi.fn(),
  };
}

function mount(over: Partial<Parameters<typeof PageTree>[0]> = {}) {
  const act_ = actions();
  const onSetOpen = vi.fn();
  render(
    <PageTree
      tabs={TABS}
      activeId="e"
      closed={new Set()}
      onSetOpen={onSetOpen}
      canEdit
      actions={act_}
      {...over}
    />,
  );
  return { actions: act_, onSetOpen };
}

const row = (name: string) => screen.getByRole('treeitem', { name });
const title = (name: string) => row(name).querySelector<HTMLElement>('[data-page-title]')!;
const button = (label: string) => screen.getByRole('button', { name: label });

// A tap as a touch browser sends it: the pointer's over and down at the touch, then (after the finger lifts) the
// focus its synthetic mousedown gives, then the click, all on the element the finger landed on.
function tap(el: HTMLElement, pointerType: 'touch' | 'pen' = 'touch') {
  fireEvent.pointerOver(el, { pointerType });
  fireEvent.pointerDown(el, { pointerType, isPrimary: true });
  fireEvent.pointerUp(el, { pointerType });
  const focusable = el.closest<HTMLElement>('button, [tabindex]');
  focusable?.focus();
  fireEvent.click(el);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a tap on the page tree', () => {
  it('opens the page it lands on, and re-mounts nothing under the finger', () => {
    const { actions: act } = mount();
    const before = title('Handbook');
    const add = button('Add Subpage to Handbook');
    tap(before);
    expect(act.onSelect).toHaveBeenCalledWith('a');
    // The same nodes: nothing was swapped out between the press and the click.
    expect(title('Handbook')).toBe(before);
    expect(button('Add Subpage to Handbook')).toBe(add);
    // Neither hovered nor focused: the row's controls stay quiet.
    expect(row('Handbook').contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a pen taps as a finger does', () => {
    const { actions: act } = mount();
    const before = title('Notes');
    tap(before, 'pen');
    expect(act.onSelect).toHaveBeenCalledWith('e');
    expect(title('Notes')).toBe(before);
  });

  it('adds a subpage from its + the first time', () => {
    const { actions: act } = mount();
    tap(button('Add Subpage to Handbook'));
    expect(act.onAdd).toHaveBeenCalledWith('a');
    expect(act.onSelect).not.toHaveBeenCalled();
  });

  it('opens and closes a page from its chevron', () => {
    const { onSetOpen, actions: act } = mount();
    tap(button('Collapse Handbook'));
    expect(onSetOpen).toHaveBeenCalledWith('a', false);
    expect(act.onSelect).not.toHaveBeenCalled();
  });

  it('opens the menu from its ..., hung from the row, which never re-mounts', async () => {
    mount();
    const menuButton = button('Page Options for Notes');
    tap(menuButton);
    expect(await screen.findByRole('menu')).toBeTruthy();
  });

  it('a mouse still marks the row it points at and the row it focuses', () => {
    mount();
    const before = title('Handbook');
    fireEvent.pointerOver(before, { pointerType: 'mouse' });
    // Marked active, the title takes its tooltip's wrapper: a mouse is never under a tap's re-mount.
    expect(title('Handbook')).not.toBe(before);
  });

  it("a keyboard's focus long after a tap is marked again", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    mount();
    tap(title('Handbook'));
    const before = title('Notes');
    vi.setSystemTime(1_000_000 + TOUCH_FOCUS_MS + 1);
    act(() => row('Notes').focus());
    expect(title('Notes')).not.toBe(before);
  });
});

describe('the touch rows', () => {
  it('show + and ... always, 44 px squares, with no hover card', () => {
    mount({ touch: true });
    for (const label of ['Add Subpage to Handbook', 'Page Options for Handbook']) {
      const el = button(label);
      for (const cls of ROW_TOUCH_BUTTON.split(' ')) expect(el.className).toContain(cls);
      // A plain button: no hover card wraps it (a card's wrapper is an inline-flex span).
      expect(el.parentElement?.hasAttribute('data-row-controls')).toBe(true);
    }
  });

  it("a Viewer's touch row has its ... alone", () => {
    mount({ touch: true, canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add Subpage to Handbook' })).toBeNull();
    expect(button('Page Options for Handbook')).toBeTruthy();
  });

  it('the sidebar draws touch rows where the pointer cannot hover (a tablet)', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(hover: none)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      const props: PageTreeSidebarProps = {
        tabs: TABS,
        activeId: 'a',
        closed: new Set(),
        onSetOpen: vi.fn(),
        canEdit: true,
        actions: actions(),
        name: 'Handbook',
        collapsed: false,
        onSetCollapsed: vi.fn(),
        top: 0,
        joined: true,
      };
      render(<PageTreeSidebar {...props} />);
      const add = button('Add Subpage to Release Process');
      for (const cls of ROW_TOUCH_BUTTON.split(' ')) expect(add.className).toContain(cls);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
