// @vitest-environment jsdom

// docs/specs/008-canvas/layout-cleanup.md "The popover" and "Hover to see it first": the Auto-align row, and no
// Auto Layout tile (gone from livehuddle, Work Tracker #423 part 4); a press ends the preview, runs it and closes,
// in that order; a mouse hover previews and a touch does not; closing mid-hover reverts; an empty or locked tab
// shows it inert under its note.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALIGN_NAME, TIDY_EMPTY_NOTE, TIDY_LOCKED_NOTE, TidyUpPopover } from './TidyUpPopover';
import type { TidyUpActions } from './tidy-up-actions';
import type { CleanupVerdict } from '@/lib/tidy-verdict';
import { loadTidyEngine } from '@/lib/tidy-engine';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// The popover loads the tidier, then judges it in a task.
const judgeAll = () => act(() => vi.runAllTimersAsync());

// jsdom has no ResizeObserver; the popover measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function setup(opts: { blocked?: boolean; empty?: boolean; verdict?: CleanupVerdict } = {}) {
  const calls: string[] = [];
  const actions: TidyUpActions = {
    run: vi.fn((judged: boolean) => calls.push(`run:${judged}`)),
    preview: vi.fn(() => calls.push('preview')),
    endPreview: vi.fn(() => calls.push('end')),
    assess: vi.fn(() => opts.verdict ?? { kind: 'ok' as const }),
    blocked: opts.blocked ?? false,
  };
  const onClose = vi.fn(() => calls.push('close'));
  const view = render(
    <TidyUpPopover actions={actions} empty={opts.empty ?? false} onClose={onClose} />,
  );
  return { actions, onClose, calls, view };
}

const align = () => screen.getByRole('button', { name: new RegExp(ALIGN_NAME) });

describe('TidyUpPopover', () => {
  it('offers Auto-align alone, with no Auto Layout tile', () => {
    setup();
    expect(screen.getByText('Tidy Up')).toBeTruthy();
    const kinds = [...document.querySelectorAll<HTMLButtonElement>('button[data-tidy-kind]')].map(
      (b) => b.dataset.tidyKind,
    );
    expect(kinds).toEqual(['align']);
    for (const gone of [/Smart/, /Flowchart/, /Tree/]) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
    const line = document.getElementById(align().getAttribute('aria-describedby')!);
    expect(line?.textContent).toBe('Snap to the grid. Nothing moves far.');
  });

  it('ends the preview, runs Auto-align, then closes, in that order', () => {
    const { calls } = setup();
    fireEvent.click(align());
    expect(calls).toEqual(['end', 'run:false', 'close']);
  });

  it('previews on a mouse hover and puts it back when the pointer leaves', () => {
    const { actions } = setup();
    fireEvent.pointerEnter(align(), { pointerType: 'mouse' });
    expect(actions.preview).toHaveBeenCalledTimes(1);
    fireEvent.pointerLeave(align(), { pointerType: 'mouse' });
    expect(actions.endPreview).toHaveBeenCalledTimes(1);
  });

  it('never previews for a touch, where the tap is the press', () => {
    const { actions } = setup();
    fireEvent.pointerEnter(align(), { pointerType: 'touch' });
    expect(actions.preview).not.toHaveBeenCalled();
  });

  it('puts the tab back when it closes with the pointer still on the row', () => {
    const { actions, view } = setup();
    fireEvent.pointerEnter(align(), { pointerType: 'mouse' });
    view.unmount();
    expect(actions.endPreview).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // An empty Space is asked for meeting content, not shapes and arrows.
  it('asks an empty Space for notes or frames', () => {
    expect(TIDY_EMPTY_NOTE).not.toMatch(/arrow|shape/i);
    expect(TIDY_EMPTY_NOTE).toMatch(/notes|frames/);
  });

  it.each([
    ['an empty tab', { empty: true }, TIDY_EMPTY_NOTE],
    ['a locked tab', { blocked: true }, TIDY_LOCKED_NOTE],
  ])('shows Auto-align inert on %s, under its note', (_, opts, note) => {
    const { actions } = setup(opts);
    expect(screen.getByText(note)).toBeTruthy();
    expect((align() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.pointerEnter(align(), { pointerType: 'mouse' });
    fireEvent.click(align());
    expect(actions.preview).not.toHaveBeenCalled();
    expect(actions.run).not.toHaveBeenCalled();
  });

  // docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work".
  it('greys Auto-align out when it would not help, with its reason in place of its line', async () => {
    vi.useFakeTimers();
    const { calls } = setup({ verdict: { kind: 'unchanged' } });
    await judgeAll();
    expect((align() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Already tidy')).toBeTruthy();
    // Greyed out, it neither previews nor runs.
    fireEvent.pointerEnter(align(), { pointerType: 'mouse' });
    fireEvent.click(align());
    expect(calls).toEqual([]);
  });

  it('judges Auto-align once, after it opens', async () => {
    vi.useFakeTimers();
    const { actions, view } = setup();
    // Nothing on the first paint: opening never waits on the judgement.
    expect(actions.assess).not.toHaveBeenCalled();
    await act(async () => {
      await loadTidyEngine();
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(actions.assess).toHaveBeenCalledTimes(1);
    view.rerender(<TidyUpPopover actions={actions} empty={false} onClose={() => {}} />);
    await judgeAll();
    expect(actions.assess).toHaveBeenCalledTimes(1);
  });

  it('passes on whether a pressed Auto-align was judged already', async () => {
    vi.useFakeTimers();
    const { actions } = setup();
    // Pressed before its turn: the command judges it.
    fireEvent.click(align());
    expect(actions.run).toHaveBeenLastCalledWith(false);
    cleanup();
    const second = setup();
    await judgeAll();
    fireEvent.click(align());
    expect(second.actions.run).toHaveBeenLastCalledWith(true);
  });

  it('judges nothing on a locked tab', () => {
    const { actions } = setup({ blocked: true });
    expect(actions.assess).not.toHaveBeenCalled();
  });
});
