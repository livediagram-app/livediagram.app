// @vitest-environment jsdom

// The chip row (docs/specs/013-workspace/explorer-filters.md "The chip row", "Accessibility").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lensChips, parseLens, type LensContext } from '@livediagram/explorer-lens';
import { LensChips } from './LensChips';

afterEach(cleanup);

const aggregate: LensContext = { view: 'aggregate', teams: [{ id: 'T1', name: 'Acme' }] };
const scoped: LensContext = { view: 'scoped', teams: [] };

function renderChips(input: string, context = aggregate) {
  const onChoose = vi.fn();
  const onClear = vi.fn();
  const parsed = parseLens(input, context);
  render(
    <LensChips
      chips={lensChips(parsed, context)}
      issues={parsed.issues}
      active={input.trim() !== ''}
      onChoose={onChoose}
      onClear={onClear}
    />,
  );
  return { onChoose, onClear };
}

describe('LensChips', () => {
  it('sits in a group named Filters, one chip per dimension, Space only on aggregate views', () => {
    renderChips('');
    const group = screen.getByRole('group', { name: 'Filters' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Space, any' })).toBeTruthy();
    cleanup();
    renderChips('', scoped);
    expect(screen.queryByRole('button', { name: 'Space, any' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Opens in, any' })).toBeTruthy();
  });

  it('names a set chip by its values and shows them as text', () => {
    renderChips('template:retrospective,kanban');
    const chip = screen.getByRole('button', { name: 'Template: Retrospective, Kanban' });
    expect(chip.getAttribute('aria-haspopup')).toBe('listbox');
    expect(chip.textContent).toContain('Retrospective, Kanban');
  });

  it('opens a multi-select listbox whose options toggle their value and stay open', () => {
    const { onChoose } = renderChips('template:kanban');
    const chip = screen.getByRole('button', { name: 'Template: Kanban' });
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox', { name: 'Template' });
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => [o.textContent, o.getAttribute('aria-selected')])).toEqual([
      ['Any', 'false'],
      ['Retrospective', 'false'],
      ['Kanban', 'true'],
    ]);
    fireEvent.click(options[1]!);
    expect(onChoose).toHaveBeenCalledWith('template', 'retrospective');
    expect(screen.getByRole('listbox', { name: 'Template' })).toBeTruthy();
  });

  it('walks the options with the arrows, toggles with Enter, closes with Escape', () => {
    const { onChoose } = renderChips('');
    const chip = screen.getByRole('button', { name: 'Edited, any' });
    fireEvent.click(chip);
    const listbox = screen.getByRole('listbox', { name: 'Edited' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[2]!.id,
    );
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onChoose).toHaveBeenCalledWith('edited', '7d');
    fireEvent.keyDown(listbox, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it('clears a dimension with Any', () => {
    const { onChoose } = renderChips('edited:7d');
    fireEvent.click(screen.getByRole('button', { name: 'Edited: Last 7 days' }));
    fireEvent.click(screen.getByRole('option', { name: 'Any' }));
    expect(onChoose).toHaveBeenCalledWith('edited', null);
  });

  it('makes Made by AI a toggle with aria-pressed', () => {
    const { onChoose } = renderChips('');
    const toggle = screen.getByRole('button', { name: 'Made by AI' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(onChoose).toHaveBeenCalledWith('made-by', 'ai');
    cleanup();
    const second = renderChips('made-by:ai');
    const pressed = screen.getByRole('button', { name: 'Made by AI' });
    expect(pressed.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pressed);
    expect(second.onChoose).toHaveBeenCalledWith('made-by', null);
  });

  it('keeps Clear in its place, out of reach while nothing is set', () => {
    renderChips('');
    const hidden = screen.getByText('Clear');
    expect(hidden.className).toContain('invisible');
    expect(hidden.getAttribute('tabindex')).toBe('-1');
    cleanup();
    const { onClear } = renderChips('plan');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('names every reported word under the row', () => {
    renderChips('colour:red');
    expect(screen.getByText('“colour:red” isn’t a filter, so it’s searched as text.')).toBeTruthy();
  });
});
