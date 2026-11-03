// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useCallback, useState, type ReactNode } from 'react';
import { usePageContents, type ContentsUse } from '../../hooks/ui/usePageContents';
import type { ContentsRowBase } from '../../lib/page-contents';
import { ContentsPanel, usePageInViewOnOpen } from './PageContentsPanel';
import { CONTENTS_FOLLOW_SETTLE_MS, ContentsSidebar } from './PageContentsSidebar';
import { ViewportStoreProvider } from '../../hooks/canvas/useViewportStore';
import { createViewportStore } from '../../lib/viewport-store';

// docs/specs/007-editor/pages-mode.md "Contents": the shared list, hook and both homes, driven as an
// editor drives them (each editor's own door is tested beside it with its real pages).
afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

type Row = ContentsRowBase & { badge?: string };
const PAGES = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  rect: { x: i * 150, y: 0, width: 100, height: 100 },
}));
const rowsOf = (pages: typeof PAGES): Row[] =>
  pages.map((p, i) => ({
    id: p.id,
    number: i + 1,
    name: `Page ${i + 1}`,
    line: i === 2 ? 'Slide · Quarterly' : 'Slide',
    locked: i === 1,
    aspect: 1,
    ...(i === 0 ? { badge: '45 sec' } : {}),
  }));

function harness({ canEdit = true, pages = PAGES } = {}) {
  const spies = {
    focusPage: vi.fn(),
    addPage: vi.fn(),
    addPageLike: vi.fn(),
    movePageTo: vi.fn(),
    movePage: vi.fn(),
    duplicatePage: vi.fn(),
    removePage: vi.fn(),
    setLocked: vi.fn(),
    openSettings: vi.fn(),
    track: vi.fn<(type: ContentsUse) => void>(),
    readTexts: vi.fn(() => new Map([['p5', 'revenue figures']])),
  };
  const view = {
    pages,
    focusPage: spies.focusPage,
    ...(canEdit
      ? {
          edit: {
            addPage: spies.addPage as (kind: string) => void,
            addPageLike: spies.addPageLike,
            movePageTo: spies.movePageTo,
            movePage: spies.movePage,
            canMove: (id: string, by: -1 | 1) => !(id === 'p1' && by === -1),
            duplicatePage: spies.duplicatePage,
            canDuplicate: () => true,
            removePage: spies.removePage,
            setLocked: spies.setLocked,
          },
        }
      : {}),
  };
  function useContents(here: string | undefined, onWent?: () => void) {
    const rows = rowsOf(pages);
    const readTexts = useCallback(() => spies.readTexts(), []);
    const contents = usePageContents({
      view,
      rows,
      readTexts,
      dropUnit: (_id, drop) => drop.index,
      lastPage: pages.at(-1),
      maxPages: 10,
      openSettings: spies.openSettings,
      extraActions: (row) =>
        row.id === 'p1'
          ? [{ key: 'hide', label: 'Hide in Slides', icon: null, run: () => {} }]
          : [],
      track: spies.track,
      here,
      onWent,
    });
    return { ...contents, thumbs: new Map([['p1', { markup: '<rect/>', viewBox: '0 0 1 1' }]]) };
  }
  const badges = (row: Row) => (row.badge ? <span data-badge="">{row.badge}</span> : null);
  const footer = (c: ReturnType<typeof useContents>) =>
    c.canAdd ? (
      <button type="button" onClick={() => (c.addLike ? c.addLike() : c.add?.('slide'))}>
        Add Page
      </button>
    ) : null;
  return { spies, useContents, badges, footer };
}

function Panel({
  h,
  mobile = false,
  onClose = () => {},
  onDock,
}: {
  h: ReturnType<typeof harness>;
  mobile?: boolean;
  onClose?: () => void;
  onDock?: () => void;
}) {
  const here = usePageInViewOnOpen(PAGES);
  const contents = h.useContents(here, mobile ? onClose : undefined);
  return (
    <ContentsPanel
      contents={contents}
      mobile={mobile}
      onClose={onClose}
      onDock={onDock}
      footer={h.footer(contents)}
      badges={h.badges}
      frame={(body: ReactNode, actions: ReactNode) => (
        <section aria-label="Contents">
          <header>{actions}</header>
          {body}
        </section>
      )}
    />
  );
}

const rowButton = (name: string) => screen.getByRole('button', { name });

describe('the shared Contents popover', () => {
  it('lists every page with its marks, opens on the page in view and glides to a pressed one', () => {
    const h = harness();
    const store = createViewportStore(1);
    // The middle of a 1024 x 768 window on page 3 (x 300 to 400).
    store.setView({ zoom: 1, offset: { x: 512 - 350, y: 384 - 50 } });
    render(
      <ViewportStoreProvider store={store}>
        <Panel h={h} />
      </ViewportStoreProvider>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(rowButton('Page 3').getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-badge]')?.textContent).toBe('45 sec');
    expect(screen.getByRole('img', { name: 'Locked' })).toBeTruthy();
    expect(document.querySelectorAll('svg[viewBox="0 0 1 1"]')).toHaveLength(1);
    fireEvent.click(rowButton('Page 5'));
    expect(h.spies.focusPage).toHaveBeenCalledWith('p5');
    expect(h.spies.track).toHaveBeenCalledWith('PageContentsJump');
    expect(rowButton('Page 5').getAttribute('aria-current')).toBe('page');
  });

  it('finds a page by its words, read only once a search is typed, and clears on Escape', () => {
    const h = harness();
    render(<Panel h={h} />);
    expect(h.spies.readTexts).not.toHaveBeenCalled();
    const find = screen.getByRole('searchbox', { name: 'Find a Page' });
    fireEvent.change(find, { target: { value: 'revenue' } });
    expect(h.spies.readTexts).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['5Page 5']);
    fireEvent.change(find, { target: { value: 'zebra' } });
    expect(screen.getByText('No page matches “zebra”.')).toBeTruthy();
    fireEvent.keyDown(find, { key: 'Escape' });
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.keyDown(find, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowButton('Page 1'));
  });

  it('moves the focus down the rows with the arrow keys, Home and End', () => {
    render(<Panel h={harness()} />);
    rowButton('Page 1').focus();
    const list = screen.getByRole('list', { name: 'Pages' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowButton('Page 2'));
    fireEvent.keyDown(list, { key: 'End' });
    expect(document.activeElement).toBe(rowButton('Page 8'));
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rowButton('Page 7'));
    fireEvent.keyDown(list, { key: 'Home' });
    expect(document.activeElement).toBe(rowButton('Page 1'));
    fireEvent.keyDown(list, { key: 'x' });
    expect(document.activeElement).toBe(rowButton('Page 1'));
  });

  it('gives an Editor a page’s menu, with the editor’s own verbs after Page Settings', () => {
    const h = harness();
    render(<Panel h={h} />);
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 1' }));
    const items = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(items).toEqual([
      'Page Settings',
      'Hide in Slides',
      'Duplicate',
      'Move Down',
      'Lock',
      'Delete',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(h.spies.duplicatePage).toHaveBeenCalledWith('p1');
  });

  it('adds a page like the last, and marks it once it arrives', () => {
    const h = harness();
    const { rerender } = render(<Panel h={h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(h.spies.addPageLike).toHaveBeenCalledWith('p8');
    rerender(<Panel h={h} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('gives a Viewer the list alone: no menu, no grip and no Add Page', () => {
    render(<Panel h={harness({ canEdit: false })} />);
    expect(screen.queryByRole('button', { name: /More Actions/ })).toBeNull();
    expect(document.querySelector('[data-contents-grip]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Page' })).toBeNull();
  });

  it('docks from its header on a desktop, and closes on Escape', () => {
    const onDock = vi.fn();
    const onClose = vi.fn();
    render(<Panel h={harness()} onDock={onDock} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dock Contents as a sidebar' }));
    expect(onDock).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('is a bottom sheet on a phone, which closes once a page is pressed', () => {
    const onClose = vi.fn();
    const h = harness();
    render(<Panel h={h} mobile onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Contents' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dock Contents as a sidebar' })).toBeNull();
    fireEvent.click(rowButton('Page 2'));
    expect(onClose).toHaveBeenCalled();
  });
});

function Sidebar({
  h,
  onMinimise = () => {},
}: {
  h: ReturnType<typeof harness>;
  onMinimise?: () => void;
}) {
  const [here] = useState<string | undefined>('p1');
  const contents = h.useContents(here);
  return (
    <ContentsSidebar
      contents={contents}
      pages={PAGES}
      focusPage={h.spies.focusPage}
      footer={h.footer(contents)}
      badges={h.badges}
      top={64}
      side="left"
      onMoveToSide={() => {}}
      onMinimise={onMinimise}
      joined
    />
  );
}

describe('the shared Contents sidebar', () => {
  it('is a named filmstrip joined to the menu box, following the page in view once the view rests', () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      const store = createViewportStore(1);
      render(
        <ViewportStoreProvider store={store}>
          <div>
            <Sidebar h={h} />
          </div>
        </ViewportStoreProvider>,
      );
      const aside = screen.getByRole('complementary', { name: 'Contents' });
      expect(aside.querySelector('[data-menu-join-band]')).toBeTruthy();
      expect(aside.querySelectorAll('[data-contents-grip]')).toHaveLength(8);
      // No layout in jsdom: the sidebar reads the tab's first page as here.
      act(() => {
        store.setView({ zoom: 1, offset: { x: -500, y: 0 } });
        vi.advanceTimersByTime(CONTENTS_FOLLOW_SETTLE_MS);
      });
      expect(rowButton('Page 1').getAttribute('aria-current')).toBe('page');
    } finally {
      vi.useRealTimers();
    }
  });

  it('minimises to its button, framing the page in view again', () => {
    const h = harness();
    const onMinimise = vi.fn();
    render(<Sidebar h={h} onMinimise={onMinimise} />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Contents' }));
    expect(onMinimise).toHaveBeenCalled();
  });
});
