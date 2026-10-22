// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { layOutPages, type Page } from '@livepages/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { PageContentsPanel } from './PageContentsPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Contents".
afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const pages = (n: number) =>
  layOutPages(
    Array.from({ length: n }, (_, i): Page => ({
      id: `p${i + 1}`,
      orientation: 'portrait',
      kind: i % 2 ? 'slide' : 'infographic',
      ...(i % 2 ? { size: 'slide' } : {}),
    })),
  );

function show(n: number, canEdit = true, onDock?: () => void) {
  const focusPage = vi.fn();
  const addPage = vi.fn();
  const movePageTo = vi.fn();
  const duplicatePage = vi.fn();
  const laid = pages(n);
  const view = {
    pages: laid,
    focusPage,
    ...(canEdit
      ? {
          edit: {
            addPage,
            movePageTo,
            duplicatePage,
            canDuplicate: () => true,
            setLocked: vi.fn(),
            removePage: vi.fn(),
          },
        }
      : {}),
  } as unknown as PagesModeView;
  const onClose = vi.fn();
  render(
    <PageContentsPanel
      view={view}
      tab={{ id: 't', name: 'T', elements: [], pages: laid, layers: [] }}
      onClose={onClose}
      {...(onDock ? { onDock } : {})}
    />,
  );
  return { focusPage, addPage, movePageTo, duplicatePage, onClose };
}

// The page rows' own buttons, in order (a row opens through one button stretched across it).
const rowButtons = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => li.querySelector<HTMLElement>('button[data-page-row]')!);

describe('PageContentsPanel', () => {
  it('lists every page and glides to the one pressed, staying open on a desktop', () => {
    const h = show(3);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // No page count: the list says it.
    expect(screen.queryByText('3 pages')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Page 2/ }));
    expect(h.focusPage).toHaveBeenCalledWith('p2');
    expect(screen.getByRole('button', { name: /^Page 2/ }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(h.onClose).not.toHaveBeenCalled();
  });

  it('adds a page of the kind pressed, for an Editor alone', () => {
    const h = show(2);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Page of Any Kind' }));
    fireEvent.click(
      screen.getByRole('dialog', { name: 'Add a Page' }).querySelector('[data-add-kind="slide"]')!,
    );
    expect(h.addPage).toHaveBeenCalledWith('slide');
    expect(screen.queryByRole('dialog', { name: 'Add a Page' })).toBeNull();
    cleanup();
    show(2, false);
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
  });

  it('offers Find a Page past six pages, narrowing the list', () => {
    show(4);
    expect(screen.queryByRole('searchbox', { name: 'Find a Page' })).toBeNull();
    cleanup();
    show(8);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a Page' }), {
      target: { value: 'slide' },
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('docks back as the sidebar from its header, where a sidebar is offered', () => {
    // docs/specs/007-editor/pages-mode.md "Contents": the popover's Dock as Sidebar.
    const onDock = vi.fn();
    show(3, true, onDock);
    fireEvent.click(screen.getByRole('button', { name: 'Dock Contents as a sidebar' }));
    expect(onDock).toHaveBeenCalledOnce();
    cleanup();
    show(3);
    expect(screen.queryByRole('button', { name: 'Dock Contents as a sidebar' })).toBeNull();
  });

  it("offers each page's actions in its ⋯ menu, an Editor's alone", () => {
    const h = show(3);
    fireEvent.click(screen.getByRole('button', { name: 'Menu for Page 2' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(h.duplicatePage).toHaveBeenCalledWith('p2');
    expect(h.focusPage).not.toHaveBeenCalled();
    cleanup();
    show(3, false);
    expect(screen.queryByRole('button', { name: 'Menu for Page 2' })).toBeNull();
  });

  it('moves between rows with the arrow keys', () => {
    show(3);
    const first = rowButtons()[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowButtons()[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(rowButtons()[2]);
  });
});

// Dragging a row reorders the pages: the caret shows where it lands, the move commits on release,
// and the release is not a press of the row.
describe('PageContentsPanel reordering', () => {
  const rowRect = (i: number) =>
    ({ top: i * 60, bottom: i * 60 + 60, height: 60, left: 0, right: 300, width: 300 }) as DOMRect;

  function drag(h: ReturnType<typeof show>, fromIndex: number, toY: number) {
    const rows = screen.getAllByRole('listitem');
    rows.forEach((r, i) => (r.getBoundingClientRect = () => rowRect(i)));
    document.elementFromPoint = (_x: number, y: number) => rows[Math.floor(y / 60)] ?? null;
    const row = rows[fromIndex]!;
    row.setPointerCapture = () => {};
    row.hasPointerCapture = () => true;
    row.releasePointerCapture = () => {};
    const startY = fromIndex * 60 + 30;
    fireEvent.pointerDown(row, { button: 0, pointerType: 'mouse', clientX: 10, clientY: startY });
    fireEvent.pointerMove(row, { pointerType: 'mouse', clientX: 10, clientY: toY });
    fireEvent.pointerUp(row, { pointerType: 'mouse', clientX: 10, clientY: toY });
    fireEvent.click(row);
    return h;
  }

  it('moves a page dragged below another, and does not jump to it', () => {
    const h = drag(show(4), 0, 2 * 60 + 50);
    // Below page 3: the page lands third.
    expect(h.movePageTo).toHaveBeenCalledWith('p1', 2);
    expect(h.focusPage).not.toHaveBeenCalled();
  });

  it('moves a page dragged above another', () => {
    const h = drag(show(4), 3, 0 + 10);
    expect(h.movePageTo).toHaveBeenCalledWith('p4', 0);
  });

  it('leaves the order alone for a drop where the page already is', () => {
    const h = drag(show(4), 1, 60 + 20);
    expect(h.movePageTo).not.toHaveBeenCalled();
  });

  it('offers no grip to someone who may not edit', () => {
    show(3, false);
    expect(document.querySelector('[data-contents-grip]')).toBeNull();
  });
});
