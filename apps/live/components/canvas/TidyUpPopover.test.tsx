// @vitest-environment jsdom

// docs/specs/008-canvas/layout-cleanup.md "The popover" and "Hover to see it first": five Auto Layout tiles
// in the spec's order and the Auto-align row; a press ends the preview, runs the tidier and closes, in that
// order; a mouse hover previews and a touch does not; closing mid-hover reverts; an empty or locked tab
// shows every tidier inert under its note.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALIGN_NAME,
  TIDY_CAPTION,
  TIDY_EMPTY_NOTE,
  TIDY_LOCKED_NOTE,
  TidyUpPopover,
} from './TidyUpPopover';
import type { TidyUpActions } from './tidy-up-actions';

afterEach(cleanup);

// jsdom has no ResizeObserver; the popover measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function setup(opts: { blocked?: boolean; empty?: boolean } = {}) {
  const calls: string[] = [];
  const actions: TidyUpActions = {
    run: vi.fn((kind) => calls.push(`run:${kind}`)),
    preview: vi.fn((kind) => calls.push(`preview:${kind}`)),
    endPreview: vi.fn(() => calls.push('end')),
    blocked: opts.blocked ?? false,
  };
  const onClose = vi.fn(() => calls.push('close'));
  const view = render(
    <TidyUpPopover actions={actions} empty={opts.empty ?? false} onClose={onClose} />,
  );
  return { actions, onClose, calls, view };
}

const tiles = () =>
  [...document.querySelectorAll<HTMLButtonElement>('button[data-tidy-kind]')].map((b) => ({
    kind: b.dataset.tidyKind,
    name: b.querySelector('.font-medium')?.textContent,
    disabled: b.disabled,
  }));

describe('TidyUpPopover', () => {
  it('lists the five layout styles in order, then Auto-align', () => {
    setup();
    expect(screen.getByText('Tidy Up')).toBeTruthy();
    expect(screen.getByText(TIDY_CAPTION)).toBeTruthy();
    expect(tiles()).toEqual([
      { kind: 'smart', name: 'Smart', disabled: false },
      { kind: 'flow-down', name: 'Flowchart Down', disabled: false },
      { kind: 'flow-right', name: 'Flowchart Right', disabled: false },
      { kind: 'tree', name: 'Tree', disabled: false },
      { kind: 'mindmap', name: 'Mindmap', disabled: false },
      { kind: 'align', name: ALIGN_NAME, disabled: false },
    ]);
  });

  it('describes each tile by its line', () => {
    setup();
    const tree = screen.getByRole('button', { name: /Tree/ });
    const line = document.getElementById(tree.getAttribute('aria-describedby')!);
    expect(line?.textContent).toBe('Parents above their children');
  });

  it('ends the preview, runs the tidier, then closes, in that order', () => {
    const { calls } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Mindmap/ }));
    expect(calls).toEqual(['end', 'run:mindmap', 'close']);
    cleanup();
    const align = setup();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ALIGN_NAME) }));
    expect(align.calls).toEqual(['end', 'run:align', 'close']);
  });

  it('previews on a mouse hover and puts it back when the pointer leaves', () => {
    const { actions } = setup();
    const tile = screen.getByRole('button', { name: /Flowchart Right/ });
    fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    expect(actions.preview).toHaveBeenCalledWith('flow-right');
    fireEvent.pointerLeave(tile, { pointerType: 'mouse' });
    expect(actions.endPreview).toHaveBeenCalledTimes(1);
  });

  it('never previews for a touch, where the tap is the press', () => {
    const { actions } = setup();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Tree/ }), { pointerType: 'touch' });
    expect(actions.preview).not.toHaveBeenCalled();
  });

  it('puts the tab back when it closes with the pointer still on a tile', () => {
    const { actions, view } = setup();
    fireEvent.pointerEnter(screen.getByRole('button', { name: /Tree/ }), { pointerType: 'mouse' });
    view.unmount();
    expect(actions.endPreview).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ['an empty tab', { empty: true }, TIDY_EMPTY_NOTE],
    ['a locked tab', { blocked: true }, TIDY_LOCKED_NOTE],
  ])('shows every tidier inert on %s, under its note', (_, opts, note) => {
    const { actions } = setup(opts);
    expect(screen.getByText(note)).toBeTruthy();
    expect(screen.queryByText(TIDY_CAPTION)).toBeNull();
    expect(tiles().every((t) => t.disabled)).toBe(true);
    const tree = screen.getByRole('button', { name: /Tree/ });
    fireEvent.pointerEnter(tree, { pointerType: 'mouse' });
    fireEvent.click(tree);
    expect(actions.preview).not.toHaveBeenCalled();
    expect(actions.run).not.toHaveBeenCalled();
  });
});
