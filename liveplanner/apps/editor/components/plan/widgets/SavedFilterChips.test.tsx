// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  presetSetup,
  type PlanBoardSetup,
  type QuickFilter,
  type SavedBoardFilter,
} from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { SavedFilterChips, quickKey } from './SavedFilterChips';

// docs/specs/026-plan/board-widgets.md "Saved filters".
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  track.mockReset();
});

const bugs: SavedBoardFilter = {
  id: 'f1',
  name: 'My Bugs',
  mine: true,
  filters: [{ by: 'type', key: 'bug' }],
};
const due: SavedBoardFilter = { id: 'f2', name: 'Due Soon', due: 'soon' };
const base = (saved?: SavedBoardFilter[]): PlanBoardSetup => ({
  ...presetSetup('blank'),
  columns: [{ id: 'done', status: 'done', name: 'Done' }],
  doneColumnId: 'done',
  ...(saved ? { savedFilters: saved } : {}),
});
// 2026-11-01, noon local.
const now = new Date(2026, 10, 1, 12);

function chips(opts: { quick?: QuickFilter; canEdit?: boolean; saved?: SavedBoardFilter[] } = {}) {
  const onQuick = vi.fn();
  const onSetup = vi.fn<(next: PlanBoardSetup, part: string) => void>();
  const setup = base('saved' in opts ? opts.saved : [bugs, due]);
  render(
    <SavedFilterChips
      setup={setup}
      palette={planPalette('light')}
      quick={opts.quick ?? {}}
      onQuick={onQuick}
      mine="me"
      now={now}
      canEdit={opts.canEdit ?? true}
      onSetup={onSetup}
    />,
  );
  const saved = () => onSetup.mock.calls.at(-1)?.[0]?.savedFilters;
  return { onQuick, onSetup, saved };
}

describe('SavedFilterChips', () => {
  it('compares quick filters by what they narrow', () => {
    expect(quickKey({ text: '', type: 'bug', filters: [] })).toBe(quickKey({ type: 'bug' }));
    expect(quickKey({ mine: 'a', type: 'bug' })).toBe(quickKey({ type: 'bug', mine: 'a' }));
  });

  it('applies a saved filter for this viewer, today; Only Mine their own and Due Soon from today', () => {
    const { onQuick } = chips();
    fireEvent.click(screen.getByRole('button', { name: 'My Bugs' }));
    expect(onQuick).toHaveBeenLastCalledWith({ mine: 'me', filters: [{ by: 'type', key: 'bug' }] });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'SavedFilter');
    fireEvent.click(screen.getByRole('button', { name: 'Due Soon' }));
    expect(onQuick).toHaveBeenLastCalledWith({
      due: { from: '2026-11-01', to: '2026-11-08', finished: ['done'] },
    });
  });

  it('shows the chip the board shows pressed, and pressing it again clears the filter', () => {
    const { onQuick } = chips({ quick: { filters: [{ by: 'type', key: 'bug' }], mine: 'me' } });
    const chip = screen.getByRole('button', { name: 'My Bugs' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Due Soon' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    // Already saved: no Save Filter.
    expect(screen.queryByRole('button', { name: 'Save Filter' })).toBeNull();
    fireEvent.click(chip);
    expect(onQuick).toHaveBeenLastCalledWith({});
  });

  it('saves the current filter under a name, refusing one already taken', () => {
    const { saved } = chips({ quick: { text: 'login', priority: 'high' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Filter' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(name, { target: { value: ' my bugs ' } });
    expect(screen.getByRole('alert').textContent).toBe('A saved filter already has this name.');
    expect(save.disabled).toBe(true);
    fireEvent.submit(name.closest('form')!);
    expect(saved()).toBeUndefined();
    fireEvent.change(name, { target: { value: 'Login Work' } });
    fireEvent.click(save);
    expect(saved()).toEqual([
      bugs,
      due,
      expect.objectContaining({ name: 'Login Work', text: 'login', priority: 'high' }),
    ]);
    expect(track).toHaveBeenCalledWith('Plan', 'Added', 'SavedFilter');
  });

  it('renames, updates and deletes from the chip’s menu', () => {
    const { saved } = chips({ quick: { type: 'task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Options: My Bugs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const name = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(name.value).toBe('My Bugs');
    fireEvent.change(name, { target: { value: 'Bugs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.[0]?.name).toBe('Bugs');
    expect(track).toHaveBeenCalledWith('Plan', 'Renamed', 'SavedFilter');

    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Options: My Bugs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update to Current Filters' }));
    expect(saved()?.[0]).toEqual({ id: 'f1', name: 'My Bugs', type: 'task' });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'SavedFilter');

    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Options: Due Soon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(saved()).toEqual([bugs]);
    expect(track).toHaveBeenCalledWith('Plan', 'Removed', 'SavedFilter');
  });

  it('drops the set-up key when the last saved filter goes, and offers no update with nothing narrowing', () => {
    const { onSetup } = chips({ saved: [bugs] });
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Options: My Bugs' }));
    expect(screen.queryByRole('button', { name: 'Update to Current Filters' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onSetup.mock.calls[0]![0].savedFilters).toBeUndefined();
    expect(onSetup.mock.calls[0]![1]).toBe('SavedFilters');
  });

  it('gives a Participant and a Viewer the chips to apply, never Save Filter or the menu', () => {
    const { onQuick } = chips({ canEdit: false, quick: { text: 'x' } });
    expect(screen.queryByRole('button', { name: 'Save Filter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Saved Filter Options/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'My Bugs' }));
    expect(onQuick).toHaveBeenCalled();
  });

  it('shows nothing with no saved filters unless an Editor has a filter to save', () => {
    chips({ saved: undefined, canEdit: false, quick: { text: 'x' } });
    expect(screen.queryByRole('group', { name: 'Saved filters' })).toBeNull();
    cleanup();
    chips({ saved: undefined });
    expect(screen.queryByRole('group', { name: 'Saved filters' })).toBeNull();
    cleanup();
    chips({ saved: undefined, quick: { text: 'x' } });
    expect(screen.getByRole('button', { name: 'Save Filter' })).toBeTruthy();
  });

  it('hides Save Filter at the cap of 8', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      name: `S${i}`,
      text: `t${i}`,
    }));
    chips({ saved: eight, quick: { text: 'new' } });
    expect(screen.queryByRole('button', { name: 'Save Filter' })).toBeNull();
  });
});
