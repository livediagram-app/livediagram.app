// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@livedocuments/document';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
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
  const open = (
    target: Element = square(),
    { attachments = true, withDelete = true }: { attachments?: boolean; withDelete?: boolean } = {},
  ) => {
    const h = handlers();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <ElementMenuQuickBar
        target={target}
        props={h as unknown as EditorContextMenuProps}
        attachments={attachments}
        onDelete={withDelete ? onDelete : undefined}
        onClose={onClose}
      />,
    );
    return { h, onDelete, onClose };
  };
  const labels = () =>
    Array.from(
      screen.getByRole('toolbar', { name: 'Quick actions' }).querySelectorAll('button'),
      (b) => b.getAttribute('aria-label'),
    );

  it('is one row: Assign Action, Add Comment, and Delete at the right', () => {
    open();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    expect(labels()).toEqual(['Assign Action', 'Add Comment', 'Delete']);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('ml-auto');
  });

  it('runs each button and closes the menu', () => {
    const { h, onDelete, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Assign Action' }));
    expect(h.onAssignAction).toHaveBeenCalledWith('sq');
    fireEvent.click(screen.getByRole('button', { name: 'Add Comment' }));
    expect(h.onOpenComments).toHaveBeenCalledWith('sq');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('disables Delete on a locked element', () => {
    const { onDelete } = open(square({ locked: true }));
    const del = screen.getByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(del);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('gives an arrow, which takes no attachments, Delete alone', () => {
    const arrow = { id: 'a', type: 'arrow' } as unknown as Element;
    open(arrow, { attachments: false });
    expect(labels()).toEqual(['Delete']);
  });

  it('draws nothing with nothing to offer', () => {
    const { container } = render(
      <ElementMenuQuickBar
        target={square()}
        props={handlers() as unknown as EditorContextMenuProps}
        attachments={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
