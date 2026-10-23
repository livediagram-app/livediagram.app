// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livedesign/design';
import { publishClearStyles } from '@/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { ElementMenuQuickBar, quickBarItems } from './ElementMenuQuickBar';

// docs/specs/008-canvas/element-menu-quick-bar.md
afterEach(() => {
  cleanup();
  publishClearStyles(null);
});

const handlers = () => ({
  onAssignAction: vi.fn(),
  onOpenComments: vi.fn(),
  onLinkElement: vi.fn(),
  onOpenNote: vi.fn(),
});
const square = (over: Partial<BoxedElement> = {}) =>
  ({ ...createShape('square', 0, 0), id: 'sq', ...over }) as BoxedElement;

describe('quickBarItems', () => {
  it('offers Action, Comment, Link and Note, each reading View / Edit once the element has one', () => {
    expect(quickBarItems(square(), handlers()).map((i) => i.label)).toEqual([
      'Assign Action',
      'Add Comment',
      'Add Link',
      'Add Note',
    ]);
    const has = square({
      link: { kind: 'url', url: 'https://example.com' },
      note: 'Remember',
    });
    const items = quickBarItems(has, handlers());
    expect(items.map((i) => [i.label, i.on])).toEqual([
      ['Assign Action', false],
      ['Add Comment', false],
      ['Edit Link', true],
      ['Edit Note', true],
    ]);
  });

  it('leaves Add Link to a link card’s own Link category', () => {
    const card = { ...square(), type: 'link-card' } as unknown as BoxedElement;
    expect(quickBarItems(card, handlers()).map((i) => i.key)).toEqual([
      'action',
      'comment',
      'note',
    ]);
  });
});

describe('ElementMenuQuickBar', () => {
  const open = (attachments = true, target = square()) => {
    const h = handlers();
    const onClose = vi.fn();
    render(
      <ElementMenuQuickBar
        target={target}
        props={h as unknown as EditorContextMenuProps}
        attachments={attachments}
        onClose={onClose}
      />,
    );
    return { h, onClose };
  };

  it('runs a button’s action and closes the menu', () => {
    const { h, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(h.onOpenNote).toHaveBeenCalledWith('sq');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('puts Clear Styles at the right while the element takes a quick style, and runs the panel’s own', () => {
    const clear = vi.fn();
    const { onClose } = open();
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear }));
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)!.getAttribute('aria-label')).toBe('Clear Styles');
    fireEvent.click(buttons.at(-1)!);
    expect(clear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers no Clear Styles for an element the quick style is not on', () => {
    open();
    act(() => publishClearStyles({ targetIds: new Set(['other']), clear: vi.fn() }));
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
  });

  it('draws nothing with neither attachments nor Clear Styles to offer', () => {
    open(false);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
