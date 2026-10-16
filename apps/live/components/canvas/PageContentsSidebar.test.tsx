// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { createViewportStore } from '@/lib/viewport-store';
import { CONTENTS_FOLLOW_SETTLE_MS, PageContentsSidebar } from './PageContentsSidebar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Contents": docked as a sidebar down the canvas's left.
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

const laid = layOutIllustratePages(
  Array.from({ length: 3 }, (_, i): IllustratePage => ({
    id: `p${i + 1}`,
    orientation: 'landscape',
    kind: 'slide',
    size: 'slide',
  })),
);

function show({ canEdit = true } = {}) {
  const focusPage = vi.fn();
  const addPage = vi.fn();
  const onMinimise = vi.fn();
  const store = createViewportStore(1);
  const view = {
    pages: laid,
    focusPage,
    ...(canEdit ? { edit: { addPage, movePageTo: vi.fn() } } : {}),
  } as unknown as IllustratePagesView;
  render(
    <ViewportStoreProvider store={store}>
      <PageContentsSidebar
        view={view}
        tab={{ id: 't', name: 'T', elements: [], pages: laid, layers: [] }}
        top={68}
        onMinimise={onMinimise}
      />
    </ViewportStoreProvider>,
  );
  return { focusPage, addPage, onMinimise, store };
}

// The view centred on a page (the centred transform, lib/viewport.ts), in jsdom's 0 x 0 canvas.
const centredOn = (i: number) => {
  const r = laid[i]!.rect;
  return { zoom: 1, offset: { x: -(r.x + r.width / 2), y: -(r.y + r.height / 2) } };
};

describe('PageContentsSidebar', () => {
  it('is a named region of every page, with its count, below the strip', () => {
    show();
    const aside = screen.getByRole('complementary', { name: 'Contents' });
    expect(aside.style.top).toBe('68px');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('3 pages')).toBeTruthy();
  });

  it('minimises to its button', () => {
    const h = show();
    fireEvent.click(screen.getByRole('button', { name: 'Minimise Contents' }));
    expect(h.onMinimise).toHaveBeenCalledOnce();
  });

  it('glides to the page pressed and marks it here, staying open', () => {
    const h = show();
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(h.focusPage).toHaveBeenCalledWith('p2');
    expect(screen.getAllByRole('option')[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('complementary', { name: 'Contents' })).toBeTruthy();
  });

  it('follows the page in view once the view rests', () => {
    vi.useFakeTimers();
    const h = show();
    act(() => h.store.setView(centredOn(2)));
    // Not on every frame: only once the view has rested.
    expect(screen.getAllByRole('option')[2]!.getAttribute('aria-selected')).toBe('false');
    act(() => {
      vi.advanceTimersByTime(CONTENTS_FOLLOW_SETTLE_MS);
    });
    expect(screen.getAllByRole('option')[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('offers Add Page to an Editor alone', () => {
    const h = show();
    fireEvent.click(screen.getByRole('button', { name: 'Add a Logo page' }));
    expect(h.addPage).toHaveBeenCalledWith('logo');
    cleanup();
    show({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Add a Logo page' })).toBeNull();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});
