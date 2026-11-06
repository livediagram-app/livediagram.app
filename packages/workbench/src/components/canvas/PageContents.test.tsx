// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
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
    // Page 1 (here in the sidebar) and Page 4 are set aside, as livedocuments' hidden slides are.
    ...(i === 0 || i === 3 ? { setAside: 'Hidden in Slides' } : {}),
  }));

// A row's veil, its picture and its button's description.
const veilOf = (name: string) =>
  rowButton(name).closest('[role="listitem"]')!.querySelector('[data-contents-veil]');
const describedAs = (name: string) => {
  const id = rowButton(name).getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
};

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
    const contents = usePageContents({
      view,
      rows,
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
  const footer = (c: ReturnType<typeof useContents>, end?: ReactNode) => (
    <div data-foot="">
      {c.canAdd ? (
        <button type="button" onClick={() => (c.addLike ? c.addLike() : c.add?.('slide'))}>
          Add Page
        </button>
      ) : null}
      {end}
    </div>
  );
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

  it('sets a set-aside page aside: a veil with the eye alone on a narrow picture, read as its description', () => {
    render(<Panel h={harness()} />);
    expect(document.querySelectorAll('[data-contents-veil]')).toHaveLength(2);
    // A 52 px square picture is too narrow for the word.
    expect(veilOf('Page 4')?.textContent).toBe('');
    expect(veilOf('Page 4')?.querySelector('svg')).toBeTruthy();
    expect(veilOf('Page 3')).toBeNull();
    expect(describedAs('Page 4')).toBe('Hidden in Slides');
    expect(describedAs('Page 3')).toBeUndefined();
    // The name stays the row's own; the reason is no extra mark on the name line.
    expect(rowButton('Page 4').getAttribute('aria-label')).toBe('Page 4');
    expect(screen.queryByRole('img', { name: 'Hidden in Slides' })).toBeNull();
  });

  it('has no Find box: every page is listed and an Editor can always reorder', () => {
    render(<Panel h={harness()} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(document.querySelectorAll('[data-contents-grip]')).toHaveLength(8);
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

  // pages-mode.md "Adding a page": like the last, right after the page here (the one the list opened on, p1).
  it('adds a page like the last right after the page here, and marks it once it arrives', () => {
    const h = harness();
    const { rerender } = render(<Panel h={h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(h.spies.addPageLike).toHaveBeenCalledWith('p8', 'p1');
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
  joined = true,
}: {
  h: ReturnType<typeof harness>;
  onMinimise?: () => void;
  joined?: boolean;
}) {
  const [here] = useState<string | undefined>('p1');
  const contents = h.useContents(here);
  return (
    <ContentsSidebar
      contents={contents}
      pages={PAGES}
      focusPage={h.spies.focusPage}
      footer={(end) => h.footer(contents, end)}
      badges={h.badges}
      top={64}
      onMinimise={onMinimise}
      joined={joined}
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

  it('has no header, no Find box and no drag; its foot holds Add Page with Contents Options to its right', () => {
    render(<Sidebar h={harness()} joined={false} />);
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.querySelector('h2')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(aside.querySelector('[data-contents-handle]')).toBeNull();
    expect(aside.style.left).toBe('0px');
    expect(aside.querySelector('[data-menu-join-band]')).toBeNull();
    const foot = aside.querySelector('[data-foot]')!;
    expect(
      [...foot.querySelectorAll('button')].map(
        (b) => b.getAttribute('aria-label') ?? b.textContent,
      ),
    ).toEqual(['Add Page', 'Contents Options']);
  });

  it('veils a set-aside page with the word, a dashed edge, and the brand ring kept on the page here', () => {
    render(<Sidebar h={harness()} />);
    expect(veilOf('Page 4')?.textContent).toBe('Hidden');
    const picture = (name: string) =>
      rowButton(name).closest('[role="listitem"]')!.querySelector('[data-contents-picture]')!;
    expect(picture('Page 4').className).toContain('outline-dashed');
    expect(picture('Page 3').className).not.toContain('outline-dashed');
    // Page 1 is here and set aside: its ring stays the brand's, under the same veil.
    expect(rowButton('Page 1').getAttribute('aria-current')).toBe('page');
    expect(picture('Page 1').className).toContain('ring-brand-500');
    expect(veilOf('Page 1')?.textContent).toBe('Hidden');
    expect(describedAs('Page 1')).toBe('Hidden in Slides');
  });

  it('keeps Contents Options at a Viewer’s foot, with no Add Page', () => {
    render(<Sidebar h={harness({ canEdit: false })} />);
    expect(screen.queryByRole('button', { name: 'Add Page' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Contents Options' })).toBeTruthy();
  });

  it('collapses to its button from Contents Options, framing the page in view again', () => {
    const h = harness();
    const onMinimise = vi.fn();
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    try {
      render(<Sidebar h={h} onMinimise={onMinimise} />);
      fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse Contents' }));
      expect(onMinimise).toHaveBeenCalled();
      for (let i = 0; i < 4 && frames.length; i++) frames.shift()!(0);
      expect(h.spies.focusPage).toHaveBeenCalledWith('p1');
    } finally {
      raf.mockRestore();
    }
  });
});
