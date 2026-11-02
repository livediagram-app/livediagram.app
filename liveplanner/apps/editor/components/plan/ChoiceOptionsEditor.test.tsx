// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_CHOICE_OPTIONS_MAX } from '@liveplanner/items';
import { ChoiceOptionsEditor, optionsFrom, pasteLines } from './ChoiceOptionsEditor';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field's Shape, a Choice field's option rows.
afterEach(cleanup);

const rows = () => screen.getAllByRole<HTMLInputElement>('textbox').map((i) => i.value);

function editor(initial?: string[]) {
  const onChange = vi.fn<(options: string[]) => void>();
  render(<ChoiceOptionsEditor initial={initial} onChange={onChange} />);
  return onChange;
}

describe('optionsFrom and pasteLines', () => {
  it('reads options trimmed, without blanks or repeats, at most the cap', () => {
    expect(optionsFrom([' Low ', '', 'low', 'High'])).toEqual(['Low', 'High']);
    const many = Array.from({ length: 30 }, (_, i) => `o${i}`);
    expect(optionsFrom(many)).toHaveLength(CUSTOM_CHOICE_OPTIONS_MAX);
  });

  it('puts pasted lines into an empty row, or after a filled one', () => {
    expect(pasteLines([''], 0, 'Low\nMedium\n\nHigh')).toEqual(['Low', 'Medium', 'High']);
    expect(pasteLines(['A', 'B'], 0, 'x\r\ny')).toEqual(['A', 'x', 'y', 'B']);
  });
});

describe('the option rows', () => {
  it('starts with one empty row, and hands up what is typed', () => {
    const onChange = editor();
    expect(rows()).toEqual(['']);
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1' }), {
      target: { value: 'Low' },
    });
    expect(onChange).toHaveBeenLastCalledWith(['Low']);
  });

  it('adds a row with Enter or Add an option, and focuses it', async () => {
    editor(['Low']);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Option 1' }), { key: 'Enter' });
    await act(async () => {});
    expect(rows()).toEqual(['Low', '']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Option 2' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add an option/ }));
    await act(async () => {});
    expect(rows()).toEqual(['Low', '', '']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Option 3' }));
  });

  it('takes an empty row off with Backspace, and a row with its cross', async () => {
    const onChange = editor(['Low', 'Mid', 'High']);
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 2' }), { target: { value: '' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Option 2' }), { key: 'Backspace' });
    await act(async () => {});
    expect(rows()).toEqual(['Low', 'High']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Option 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove option 1' }));
    expect(rows()).toEqual(['High']);
    expect(onChange).toHaveBeenLastCalledWith(['High']);
    // The last row is cleared, never taken away.
    fireEvent.click(screen.getByRole('button', { name: 'Remove option 1' }));
    expect(rows()).toEqual(['']);
  });

  it('turns a pasted list into one option a line', () => {
    const onChange = editor();
    fireEvent.paste(screen.getByRole('textbox', { name: 'Option 1' }), {
      clipboardData: { getData: () => 'Low\nMedium\nHigh\n' },
    });
    expect(rows()).toEqual(['Low', 'Medium', 'High']);
    expect(onChange).toHaveBeenLastCalledWith(['Low', 'Medium', 'High']);
  });

  it('stops adding rows at the cap', () => {
    editor(Array.from({ length: CUSTOM_CHOICE_OPTIONS_MAX }, (_, i) => `o${i}`));
    expect(screen.getByRole('button', { name: /^Add an option/ })).toHaveProperty('disabled', true);
  });
});
