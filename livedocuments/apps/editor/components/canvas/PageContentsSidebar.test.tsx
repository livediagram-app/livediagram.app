// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { requestPagePanel } from '@/lib/page-panel-request';
import { CONTENTS_FOLLOW_SETTLE_MS } from '@liveworkspace/workbench/components/canvas/PageContentsSidebar';
import { PageContentsSidebar } from './PageContentsSidebar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/page-panel-request', () => ({ requestPagePanel: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Contents": docked as a sidebar down the canvas's left.
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  // jsdom lays nothing out: the sidebar's canvas is its parent, a 0 x 0 box at the origin.
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
});

const laid = layOutPages(
  Array.from({ length: 3 }, (_, i): Page => ({
    id: `p${i + 1}`,
    orientation: 'landscape',
    kind: 'slide',
    size: 'slide',
  })),
);

function show({
  canEdit = true,
  hidden = false,
  joined = false,
}: { canEdit?: boolean; hidden?: boolean; joined?: boolean } = {}) {
  const focusPage = vi.fn();
  const addPage = vi.fn();
  const onMinimise = vi.fn();
  const edit = {
    addPage,
    movePageTo: vi.fn(),
    duplicatePage: vi.fn(),
    canDuplicate: () => true,
    setLocked: vi.fn(),
    removePage: vi.fn(),
    canMove: (id: string, by: -1 | 1) => (by === -1 ? id !== 'p1' : id !== 'p3'),
    movePage: vi.fn(),
  };
  const deck = {
    slideOf: (id: string) => (id === 'p1' ? { id: 's1', hidden } : undefined),
    add: vi.fn(),
    toggleHidden: vi.fn(),
  };
  const store = createViewportStore(1);
  const toggleArrangement = vi.fn();
  const view = {
    pages: laid,
    focusPage,
    // Slides stand in a row by default; an Editor may stack them (pages-mode.md "Stacked or side by side").
    arrangement: { stacked: false, ...(canEdit ? { toggle: toggleArrangement } : {}) },
    ...(canEdit ? { edit, deck } : {}),
  } as unknown as PagesModeView;
  render(
    <ViewportStoreProvider store={store}>
      <PageContentsSidebar
        view={view}
        tab={{ id: 't', name: 'T', elements: [], pages: laid, layers: [] }}
        top={68}
        onMinimise={onMinimise}
        joined={joined}
      />
    </ViewportStoreProvider>,
  );
  return { focusPage, addPage, onMinimise, edit, deck, store, toggleArrangement };
}

// The view centred on a page (the centred transform, @liveworkspace/workbench/lib/viewport.ts), in jsdom's 0 x 0 canvas.
const centredOn = (i: number) => {
  const r = laid[i]!.rect;
  return { zoom: 1, offset: { x: -(r.x + r.width / 2), y: -(r.y + r.height / 2) } };
};

// The page rows' own buttons, in order (a row opens through one button stretched across it).
const rowButtons = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => li.querySelector<HTMLElement>('button[data-page-row]')!);

describe('PageContentsSidebar', () => {
  it('is a named region of every page, with its count, below the strip', () => {
    show();
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.top).toBe('68px');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('3 pages')).toBeNull();
  });

  it('centres each picture in the strip, so a page narrower than a slide sits in the middle', () => {
    show();
    const slots = document.querySelectorAll('[data-contents-film-frame]');
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) expect(s.className).toContain('justify-center');
  });

  it('sits flush to the left with no header and no drag; its foot is Add Page with Minimise to its right', () => {
    show();
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.left).toBe('0px');
    expect(aside.querySelector('h2')).toBeNull();
    expect(aside.querySelector('[data-contents-handle]')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    const minimise = screen.getByRole('button', { name: 'Contents Options' });
    const foot = minimise.closest('div.border-t')!;
    const buttons = [...foot.querySelectorAll('button')];
    expect(buttons.at(-1)).toBe(minimise);
    expect(buttons[0]!.textContent).toMatch(/^Add (Page|Slide)/);
  });

  it('keeps Contents Options at a Viewer’s foot, with no Add Page', () => {
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: /^Add Page/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Contents Options' })).toBeTruthy();
  });

  // pages-mode.md "Stacked or side by side": an Editor's switch in Contents Options; a Viewer has Collapse alone.
  it('offers an Editor Stack Pages in Contents Options, and a Viewer only Collapse Contents', () => {
    const h = show();
    fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
    const row = screen.getByRole('menuitemcheckbox', { name: /Stack Pages/ });
    expect(row.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(row);
    expect(h.toggleArrangement).toHaveBeenCalledOnce();
    cleanup();
    show({ canEdit: false });
    fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Collapse Contents' })).toBeTruthy();
  });

  // docs/specs/007-editor/pages-mode.md "Joined to the menu box".
  it('joined, rises to the top and keeps the menu box’s row, the list where it was', () => {
    show({ joined: true });
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.top).toBe('0px');
    const band = aside.firstElementChild as HTMLElement;
    expect(band.hasAttribute('data-menu-join-band')).toBe(true);
    expect(band.style.height).toBe('68px');
    expect(band.nextElementSibling?.getAttribute('role')).toBe('list');
  });

  it('has no menu row unjoined', () => {
    show();
    expect(document.querySelector('[data-menu-join-band]')).toBeNull();
  });

  it("stacks each page's Delete and ⋯ down its left, an Editor's alone, whose presses never glide", () => {
    const h = show();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Page 2' }));
    expect(h.edit.removePage).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 2' }));
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
      'Page Settings',
      'Add to Slides',
      'Duplicate',
      'Move Up',
      'Move Down',
      'Lock',
      'Delete',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Down' }));
    expect(h.edit.movePage).toHaveBeenCalledWith('p2', 1);
    expect(h.focusPage).not.toHaveBeenCalledWith('p2');
    // One menu for the whole list, whichever row's ⋯ opened it.
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 1' }));
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.queryByRole('menuitem', { name: 'Move Up' })).toBeNull();
    // No line of what each page is: the picture says it.
    expect(screen.queryByText(/Not in the deck|In the deck/)).toBeNull();
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: /^More Actions for/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    // A right-click on a row opens nothing for someone who may not edit.
    fireEvent.contextMenu(screen.getAllByRole('listitem')[1]!);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it("holds each page's place in the slide deck in its menu, and marks a hidden one", () => {
    const h = show();
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 2' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Slides' }));
    expect(h.deck.add).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide in Slides' }));
    expect(h.deck.toggleHidden).toHaveBeenCalledWith('s1');
    expect(document.querySelector('[data-contents-veil]')).toBeNull();
    cleanup();
    const hid = show({ hidden: true });
    // Its picture is set aside under the Hidden veil, and its row is described as hidden.
    const veils = document.querySelectorAll('[data-contents-veil]');
    expect(veils).toHaveLength(1);
    expect(veils[0]!.textContent).toBe('Hidden');
    const row = screen.getByRole('button', { name: 'Page 1' });
    expect(document.getElementById(row.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Hidden in Slides',
    );
    fireEvent.click(screen.getByRole('button', { name: 'More Actions for Page 1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show in Slides' }));
    expect(hid.deck.toggleHidden).toHaveBeenCalledWith('s1');
  });

  it('opens a page’s settings from its menu, framing it first', async () => {
    const h = show();
    fireEvent.contextMenu(screen.getAllByRole('listitem')[2]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Page Settings' }));
    expect(h.focusPage).toHaveBeenCalledWith('p3');
    expect(screen.queryByRole('menu')).toBeNull();
    // Its settings open from its cog once it is framed.
    await waitFor(() => expect(requestPagePanel).toHaveBeenCalledWith('p3'));
  });

  it('collapses to its button from Contents Options, framing the page in view again', async () => {
    const h = show();
    h.focusPage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse Contents' }));
    expect(h.onMinimise).toHaveBeenCalledOnce();
    // The page in view is framed again across the whole canvas once the sidebar has gone.
    await waitFor(() => expect(h.focusPage).toHaveBeenCalledWith('p1'));
  });

  it('frames the page in view beside itself as it docks', async () => {
    const h = show();
    await waitFor(() => expect(h.focusPage).toHaveBeenCalledWith('p1'));
  });

  it('glides to the page pressed and marks it here, staying open', () => {
    const h = show();
    fireEvent.click(rowButtons()[1]!);
    expect(h.focusPage).toHaveBeenLastCalledWith('p2');
    expect(rowButtons()[1]!.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('complementary', { name: 'Contents' })).toBeTruthy();
  });

  it('follows the page in view once the view rests', () => {
    vi.useFakeTimers();
    const h = show();
    act(() => h.store.setView(centredOn(2)));
    // Not on every frame: only once the view has rested.
    expect(rowButtons()[2]!.getAttribute('aria-current')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(CONTENTS_FOLLOW_SETTLE_MS);
    });
    expect(rowButtons()[2]!.getAttribute('aria-current')).toBe('page');
  });

  it('offers Add Page to an Editor alone', () => {
    const h = show();
    // One kind a tab: no chooser of another kind.
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Add (Page|Slide)/ }));
    expect(h.addPage).toHaveBeenCalledWith('infographic');
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: /^Add (Page|Slide)/ })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
