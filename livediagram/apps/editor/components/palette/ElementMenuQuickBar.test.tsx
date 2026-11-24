// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement } from '@livediagram/document';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
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

  it('offers Live Status… only when the session may bind (docs/specs/009-elements/live-status.md)', () => {
    expect(quickBarItems(square(), handlers()).map((i) => i.key)).not.toContain('live-status');
    const onEditLiveStatus = vi.fn();
    const unbound = quickBarItems(square(), { ...handlers(), onEditLiveStatus }).at(-1)!;
    expect([unbound.key, unbound.label, unbound.on]).toEqual([
      'live-status',
      'Live Status…',
      false,
    ]);
    unbound.run();
    expect(onEditLiveStatus).toHaveBeenCalledWith('sq');
    const bound = quickBarItems(square({ statusUrl: 'https://status.example.com/' }), {
      ...handlers(),
      onEditLiveStatus,
    }).at(-1)!;
    expect(bound.on).toBe(true);
    expect(bound.state).toBe('status.example.com');
  });

  // "Resources": the dialog's rows say what the element has, and Link and a written Note have options of their own.
  it('says what the element has now, and gives Link its places and a written Note its own options', () => {
    const h = { ...handlers(), onRemoveLink: vi.fn(), onRemoveNote: vi.fn() };
    const has = square({
      link: { kind: 'url', url: 'https://example.com/' },
      note: 'Remember\nthis',
    });
    const items = quickBarItems(has, h);
    const link = items.find((i) => i.key === 'link')!;
    expect(link.state).toBe('example.com');
    // A web address, a tab, this app's own file first among every product's, and Remove last.
    expect(link.choices?.slice(0, 3).map((c) => [c.key, !!c.current])).toEqual([
      ['url', true],
      ['tab', false],
      ['document', false],
    ]);
    expect(link.choices?.some((c) => c.key.startsWith('app:'))).toBe(true);
    expect(link.choices?.at(-1)?.key).toBe('remove');
    link.choices?.find((c) => c.key === 'tab')?.run();
    expect(h.onLinkElement).toHaveBeenCalledWith('sq', 'tab');
    link.choices?.find((c) => c.key === 'remove')?.run();
    expect(h.onRemoveLink).toHaveBeenCalledTimes(1);
    const note = items.find((i) => i.key === 'note')!;
    expect(note.state).toBe('Remember');
    expect(note.choices?.map((c) => c.key)).toEqual(['edit', 'remove']);
    // Nothing to choose between until it is written: the row opens it.
    const bare = quickBarItems(square(), h);
    expect(bare.find((i) => i.key === 'note')?.choices).toBeUndefined();
    expect(
      bare
        .find((i) => i.key === 'link')
        ?.choices?.slice(0, 3)
        .map((c) => c.key),
    ).toEqual(['url', 'tab', 'document']);
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
  // Assign Action, Add Comment, Add Link and Add Note moved to the Resources category (quickBarItems above); the bar
  // keeps the element's own verbs and Clear Styles.
  const open = (target = square()) => {
    const onClose = vi.fn();
    render(<ElementMenuQuickBar target={target} onClose={onClose} />);
    return { onClose };
  };

  it('puts Clear Styles at the right while the element takes a quick style, and runs the panel’s own', async () => {
    const clear = vi.fn();
    const { onClose } = open();
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear }));
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)!.getAttribute('aria-label')).toBe('Clear Styles');
    fireEvent.click(buttons.at(-1)!);
    expect(clear).toHaveBeenCalledOnce();
    // The bar closes the menu a microtask after the press, once the button has run.
    await act(async () => {});
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('draws nothing for an element the quick style is not on', () => {
    open();
    act(() => publishClearStyles({ targetIds: new Set(['other']), clear: vi.fn() }));
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
