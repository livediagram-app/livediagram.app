// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@liveknowledge/document';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import type { LibraryApi } from '@liveworkspace/workbench/lib/library/library-api';
import { ElementMenuQuickBar, quickBarItems } from './ElementMenuQuickBar';

// docs/specs/008-canvas/element-menu-quick-bar.md: one row, Assign Action and Add Comment, Delete at the right.
afterEach(cleanup);

const handlers = () => ({
  onAssignAction: vi.fn(),
  onOpenComments: vi.fn(),
});
const square = (over: Partial<BoxedElement> = {}) =>
  ({ ...createShape('square', 0, 0), id: 'sq', ...over }) as BoxedElement;

describe('quickBarItems', () => {
  it('offers Action and Comment only, each reading View once the element has one', () => {
    expect(quickBarItems(square(), handlers()).map((i) => i.label)).toEqual([
      'Assign Action',
      'Add Comment',
    ]);
    const has = square({
      commentThread: {
        resolved: false,
        comments: [
          {
            id: '1',
            text: 'c',
            authorId: 'me',
            authorName: 'Me',
            authorColor: '#000',
            createdAt: 0,
          },
        ],
      },
    });
    expect(quickBarItems(has, handlers()).map((i) => [i.label, i.on])).toEqual([
      ['Assign Action', false],
      ['View Comments', true],
    ]);
  });

  it('offers no link or note, even on an element that stores one (they are retired)', () => {
    const stored = square({ link: { kind: 'url', url: 'https://example.com' }, note: 'Remember' });
    expect(quickBarItems(stored, handlers()).map((i) => i.key)).toEqual(['action', 'comment']);
  });
});

describe('ElementMenuQuickBar', () => {
  // Assign Action and Add Comment moved to the Resources category (quickBarItems above); the bar keeps Save to
  // Library and Delete.
  const open = (target: Element = square(), withDelete = true) => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <ElementMenuQuickBar
        target={target}
        onDelete={withDelete ? onDelete : undefined}
        onClose={onClose}
      />,
    );
    return { onDelete, onClose };
  };
  const labels = () =>
    Array.from(
      screen.getByRole('toolbar', { name: 'Quick actions' }).querySelectorAll('button'),
      (b) => b.getAttribute('aria-label'),
    );

  it('is one row with Delete at the right', () => {
    open();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    expect(labels()).toEqual(['Delete']);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('ml-auto');
  });

  it('runs Delete and closes the menu', () => {
    const { onDelete, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Delete on a locked element', () => {
    const { onDelete } = open(square({ locked: true }));
    const del = screen.getByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('draws nothing with nothing to offer', () => {
    const { container } = render(<ElementMenuQuickBar target={square()} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  // Save to Library (liveworkspace/docs/specs/006-media/libraries.md): liveknowledge has no toolbar for one element,
  // so it saves from here, beside Delete, where the editor has the Library; not on a locked element.
  it('offers Save to Library where the editor has the Library, and opens its dialog', async () => {
    const api = {
      list: vi.fn(async () => ({
        items: [],
        teams: [],
        hidden: 0,
        legacy: { unavailable: [], copied: [], writable: true },
      })),
    } as unknown as LibraryApi;
    const onClose = vi.fn();
    const bar = (target: Element) => (
      <LibraryProvider api={api}>
        <ElementMenuQuickBar target={target} onDelete={vi.fn()} onClose={onClose} />
      </LibraryProvider>
    );
    const { rerender } = render(bar(square({ locked: true })));
    expect(labels()).not.toContain('Save to Library');
    rerender(bar(square()));
    expect(labels()).toEqual(['Save to Library', 'Delete']);
    fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
