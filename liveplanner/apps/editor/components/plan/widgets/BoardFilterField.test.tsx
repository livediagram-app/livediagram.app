// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type Item,
  type QuickFilter,
} from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { BoardFilterField } from './BoardFilterField';

// docs/specs/026-plan/board-widgets.md "The Filter widget": words and field chips as one field.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(cleanup);

const by = { id: 'p', name: 'P', color: '#000000' };
const card = (id: string, type: string): Item => ({
  id,
  type,
  key: 1,
  rank: id,
  fields: { title: id, status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const items = new Map(
  [card('a', 'task'), card('b', 'idea'), card('c', 'idea')].map((i) => [i.id, i]),
);
const setup = { ...presetSetup('blank'), columns: [{ id: 'todo', status: 'todo', name: 'To do' }] };

function field(quick: QuickFilter = {}) {
  const onQuick = vi.fn();
  render(
    <BoardFilterField
      projection={projectBoard(setup, items, quick)}
      planItems={items}
      types={ITEM_TYPES}
      palette={planPalette('light')}
      quick={quick}
      onQuick={onQuick}
    />,
  );
  return onQuick;
}

describe('BoardFilterField', () => {
  it('types the words, keeping the other narrowings, and drops them when emptied', () => {
    let onQuick = field({ mine: 'me' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter this board' }), {
      target: { value: 'log' },
    });
    expect(onQuick).toHaveBeenLastCalledWith({ mine: 'me', text: 'log' });
    cleanup();
    onQuick = field({ text: 'l' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter this board' }), {
      target: { value: '' },
    });
    expect(onQuick).toHaveBeenLastCalledWith({});
  });

  it('adds a field chip from Add Filter, a value with its count', () => {
    const onQuick = field();
    fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    fireEvent.click(screen.getByRole('button', { name: /Card Type/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Idea/ }));
    expect(onQuick).toHaveBeenLastCalledWith({ filters: [{ by: 'type', key: 't:idea' }] });
  });

  it('shows a chip, takes it off with its cross or Backspace, and Clear Filter takes words and chips', () => {
    const quick: QuickFilter = { text: '', type: 'idea', filters: [{ by: 'type', key: 't:idea' }] };
    let onQuick = field(quick);
    expect(screen.getByRole('group', { name: 'Filters' }).textContent).toContain('Card Type:Idea');
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter this board' }).placeholder,
    ).toBe('Filter these…');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Card Type: Idea' }));
    expect(onQuick).toHaveBeenLastCalledWith({ text: '', type: 'idea' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Filter this board' }), {
      key: 'Backspace',
    });
    expect(onQuick).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filter' }));
    expect(onQuick).toHaveBeenLastCalledWith({ type: 'idea' });
    cleanup();
    onQuick = field({
      filters: Array.from({ length: 8 }, () => ({ by: 'type' as const, key: 't:idea' })),
    });
    expect(screen.queryByRole('button', { name: 'Add Filter' })).toBeNull();
    expect(onQuick).not.toHaveBeenCalled();
  });
});
