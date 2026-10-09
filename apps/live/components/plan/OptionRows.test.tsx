// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuTreeContext } from '@livediagram/ui';
import { OptionRows } from './OptionRows';

// docs/specs/026-plan/plan-board.md "Option lists": one bordered box, a row per choice.
afterEach(cleanup);

const rows = [
  { id: 'none', label: 'None', icon: <span>N</span> },
  { id: 'assignee', label: 'Assignee', detail: 'Who has it' },
  { id: 'off', label: 'Off', disabled: true },
  { id: 'type', label: 'Type' },
];

describe('OptionRows', () => {
  it('is a radio group with the chosen row checked and the only one in the Tab order', () => {
    const onPick = vi.fn();
    render(
      <OptionRows
        kind="single"
        label="Group rows by"
        rows={rows}
        selected="assignee"
        onPick={onPick}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Group rows by' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(screen.getByText('Who has it')).toBeTruthy();
    fireEvent.click(radios[0]!);
    expect(onPick).toHaveBeenCalledWith('none');
  });

  it('moves between rows with the arrows, Home and End, skipping a disabled one', () => {
    render(<OptionRows kind="single" label="L" rows={rows} selected="none" onPick={vi.fn()} />);
    const [none, assignee, , type] = screen.getAllByRole('radio');
    none!.focus();
    fireEvent.keyDown(none!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(assignee);
    fireEvent.keyDown(assignee!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(type);
    fireEvent.keyDown(type!, { key: 'Home' });
    expect(document.activeElement).toBe(none);
    fireEvent.keyDown(none!, { key: 'End' });
    expect(document.activeElement).toBe(type);
    fireEvent.keyDown(type!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(assignee);
  });

  it('ticks many as checkboxes, and does things as buttons', () => {
    const onPick = vi.fn();
    render(
      <OptionRows
        kind="multiple"
        label="Types"
        rows={rows}
        selected={['none', 'type']}
        onPick={onPick}
      />,
    );
    expect(screen.getAllByRole('checkbox').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'true',
    ]);
    cleanup();
    render(
      <OptionRows
        kind="action"
        label="Add"
        rows={[{ id: 'a', label: 'To Do', ariaLabel: 'Add To Do' }]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    expect(onPick).toHaveBeenCalledWith('a');
  });

  it('becomes the items of a command menu, leaving the menu its keys', () => {
    render(
      <MenuTreeContext.Provider value={{ kind: 'command', id: 'm', closeTree: () => {} }}>
        <OptionRows kind="single" label="L" rows={rows} selected="none" onPick={vi.fn()} />
      </MenuTreeContext.Provider>,
    );
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.tabIndex === -1)).toBe(true);
  });
});
