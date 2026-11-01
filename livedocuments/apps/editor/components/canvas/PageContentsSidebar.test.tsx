// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedocuments/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { requestPagePanel } from '@/lib/page-panel-request';
import { CONTENTS_FOLLOW_SETTLE_MS, PageContentsSidebar } from './PageContentsSidebar';

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
  side = 'left',
  hidden = false,
  joined = false,
}: { canEdit?: boolean; side?: 'left' | 'right'; hidden?: boolean; joined?: boolean } = {}) {
  const focusPage = vi.fn();
  const addPage = vi.fn();
  const onMinimise = vi.fn();
  const onMoveToSide = vi.fn();
  const onDraggingChange = vi.fn();
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
  const view = {
    pages: laid,
    focusPage,
    ...(canEdit ? { edit, deck } : {}),
  } as unknown as PagesModeView;
  render(
    <ViewportStoreProvider store={store}>
      <PageContentsSidebar
        view={view}
        tab={{ id: 't', name: 'T', elements: [], pages: laid, layers: [] }}
        top={68}
        side={side}
        onMoveToSide={onMoveToSide}
        onMinimise={onMinimise}
        joined={joined}
        onDraggingChange={onDraggingChange}
      />
    </ViewportStoreProvider>,
  );
  return { focusPage, addPage, onMinimise, onMoveToSide, onDraggingChange, edit, deck, store };
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

  it('pins flush to its side, and drags by its title to the other', () => {
    const h = show();
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.left).toBe('0px');
    // jsdom's canvas is 0 wide at the origin, so any x past it is its right half.
    const handle = aside.querySelector<HTMLElement>('[data-contents-handle]')!;
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { button: 0, clientX: -10, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });
    expect(document.querySelector('[data-contents-drop]')).not.toBeNull();
    fireEvent.pointerUp(handle, { clientX: 500, pointerId: 1 });
    expect(h.onMoveToSide).toHaveBeenCalledWith('right');
    cleanup();
    show({ side: 'right' });
    expect(screen.getByRole('complementary', { name: 'Contents' }).style.right).toBe('0px');
  });

  // docs/specs/007-editor/pages-mode.md "Joined to the menu box".
  it('joined, rises to the top and keeps the menu box’s row, its header where it was', () => {
    show({ joined: true });
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.top).toBe('0px');
    const band = aside.firstElementChild as HTMLElement;
    expect(band.hasAttribute('data-menu-join-band')).toBe(true);
    expect(band.style.height).toBe('68px');
    expect(band.nextElementSibling?.hasAttribute('data-contents-handle')).toBe(true);
  });

  it('has no menu row unjoined', () => {
    show();
    expect(document.querySelector('[data-menu-join-band]')).toBeNull();
  });

  it('tells the chrome a drag across starts and ends, a cancelled one too', () => {
    const h = show({ joined: true });
    const handle = document.querySelector<HTMLElement>('[data-contents-handle]')!;
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { button: 0, clientX: -10, pointerId: 1 });
    expect(h.onDraggingChange).toHaveBeenLastCalledWith(true);
    fireEvent.pointerUp(handle, { clientX: -10, pointerId: 1 });
    expect(h.onDraggingChange).toHaveBeenLastCalledWith(false);
    fireEvent.pointerDown(handle, { button: 0, clientX: -10, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(h.onDraggingChange).toHaveBeenLastCalledWith(false);
    // A press on its buttons is no drag.
    h.onDraggingChange.mockClear();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Minimise Contents' }), {
      button: 0,
      pointerId: 1,
    });
    expect(h.onDraggingChange).not.toHaveBeenCalled();
  });

  it('lets go of the menu box if it goes mid-drag', () => {
    const h = show({ joined: true });
    const handle = document.querySelector<HTMLElement>('[data-contents-handle]')!;
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { button: 0, clientX: -10, pointerId: 1 });
    cleanup();
    expect(h.onDraggingChange).toHaveBeenLastCalledWith(false);
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
    expect(screen.queryByRole('img', { name: 'Hidden in Slides' })).toBeNull();
    cleanup();
    const hid = show({ hidden: true });
    expect(screen.getAllByRole('img', { name: 'Hidden in Slides' })).toHaveLength(1);
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

  it('minimises to its button, framing the page in view again', async () => {
    const h = show();
    h.focusPage.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Contents' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(h.addPage).toHaveBeenCalledWith('infographic');
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add Page' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
