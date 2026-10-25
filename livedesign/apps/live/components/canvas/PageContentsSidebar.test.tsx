// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livedesign/design';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { CONTENTS_FOLLOW_SETTLE_MS, PageContentsSidebar } from './PageContentsSidebar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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
    kind: 'logo',
    size: 'logo',
  })),
);

function show({
  canEdit = true,
  side = 'left',
}: { canEdit?: boolean; side?: 'left' | 'right' } = {}) {
  const focusPage = vi.fn();
  const addPage = vi.fn();
  const addPageLike = vi.fn();
  const onMinimise = vi.fn();
  const onMoveToSide = vi.fn();
  const edit = {
    addPage,
    addPageLike,
    movePageTo: vi.fn(),
    duplicatePage: vi.fn(),
    canDuplicate: () => true,
    setLocked: vi.fn(),
    removePage: vi.fn(),
  };
  const deck = { slideOf: (id: string) => (id === 'p1' ? { id: 's1' } : undefined), add: vi.fn() };
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
      />
    </ViewportStoreProvider>,
  );
  return { focusPage, addPage, addPageLike, onMinimise, onMoveToSide, edit, deck, store };
}

// The view centred on a page (the centred transform, lib/viewport.ts), in jsdom's 0 x 0 canvas.
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

  it("gives each page a toolbar, an Editor's alone, whose presses never glide", () => {
    const h = show();
    // Add to Slides stays on the page's own title bar: the sidebar's toolbar leaves it out.
    expect(screen.queryByRole('button', { name: 'Add to Slides Page 2' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Page 2' }));
    expect(h.edit.duplicatePage).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Lock Page 2' }));
    expect(h.edit.setLocked).toHaveBeenCalledWith('p2', true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Page 2' }));
    expect(h.edit.removePage).toHaveBeenCalledWith('p2');
    expect(h.focusPage).not.toHaveBeenCalledWith('p2');
    // No line of what each page is: the toolbar and the picture say it.
    expect(screen.queryByText(/Not in the deck|In the deck/)).toBeNull();
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('toolbar')).toBeNull();
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
    // One kind a tab: no chooser of another kind, and a logo tab has no device chooser either.
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a Screen of Another Device' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    expect(h.addPageLike).toHaveBeenCalledWith('p3');
    expect(h.addPage).not.toHaveBeenCalled();
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add Page' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
