// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Values": Insert a Value is a button inside the field, never a list under it. Its
// popover (a sheet on a phone) searches the values in groups, Up and Down walk them, Enter inserts at the caret, and
// focus goes back to the field.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { ValueTextField } from './ValueInsert';
import { filterValueGroups, valueInsertGroups } from './value-insert-options';

let wide = true;
beforeEach(() => {
  wide = true;
  vi.stubGlobal(
    'matchMedia',
    (q: string) =>
      ({
        matches: wide && q.includes('min-width'),
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

let text = '';
function Field({
  start = 'Done by ',
  branch = false,
  maxLength,
}: {
  start?: string;
  branch?: boolean;
  maxLength?: number;
}) {
  const [value, setValue] = useState(start);
  return (
    <ValueTextField
      label="Comment"
      value={value}
      onChange={(next) => {
        text = next;
        setValue(next);
      }}
      fields={[{ id: 'f1', name: 'Completed On' }]}
      branch={branch}
      maxLength={maxLength}
    />
  );
}
const area = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Comment' });
const button = () => screen.getByRole('button', { name: 'Insert a Value into Comment' });

describe('Insert a Value', () => {
  beforeEach(() => {
    text = 'Done by ';
  });
  it('sits inside the field, with no list of values under it', () => {
    render(<Field />);
    const box = area().parentElement!;
    expect(box.contains(button())).toBe(true);
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(button().className).toContain('cursor-pointer');
    expect(screen.queryByRole('group', { name: /Insert a Value/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Who Did It' })).toBeNull();
    // The words keep clear of the button.
    expect(area().className).toContain('pr-10');
  });

  it('inserts at the caret over a selection, and gives the field focus back', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    render(<Field start="Done by someone" />);
    fireEvent.focus(area());
    area().setSelectionRange(8, 15);
    fireEvent.click(button());
    expect(button().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: /^Who Did It/ }));
    expect(text).toBe('Done by {{person}}');
    expect(screen.queryByRole('listbox')).toBeNull();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(document.activeElement).toBe(area());
    expect(area().selectionStart).toBe('Done by {{person}}'.length);
    vi.useRealTimers();
  });

  it('inserts a value whole or not at all near the field’s limit', () => {
    // 'Done by ' and {{person}} make 18: one short of room, nothing goes in; with room, all of it.
    render(<Field maxLength={17} />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('option', { name: /^Who Did It/ }));
    expect(text).toBe('Done by ');
    cleanup();
    render(<Field maxLength={18} />);
    fireEvent.click(button());
    fireEvent.click(screen.getByRole('option', { name: /^Who Did It/ }));
    expect(text).toBe('Done by {{person}}');
  });

  it('walks the values with the arrow keys from the search, inserts with Enter and closes on Escape', () => {
    render(<Field />);
    fireEvent.focus(area());
    area().setSelectionRange(8, 8);
    fireEvent.click(button());
    const search = screen.getByRole('combobox', { name: 'Find a value' });
    const marked = () => document.getElementById(search.getAttribute('aria-activedescendant')!)!;
    expect(marked().textContent).toContain('Card Title');
    fireEvent.keyDown(search, { key: 'ArrowUp' });
    expect(marked().textContent).toContain('Completed On');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    expect(marked().textContent).toContain('Card Link');
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(text).toBe('Done by {{card.url}}');
    fireEvent.click(button());
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Find a value' }), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('draws the marked value’s token dark enough to read on its wash', () => {
    render(<Field />);
    fireEvent.click(button());
    const search = screen.getByRole('combobox', { name: 'Find a value' });
    const marked = document.getElementById(search.getAttribute('aria-activedescendant')!)!;
    const token = marked.querySelector('[data-value-token]')!;
    // Slate 500 on the violet wash was 4.34:1, under the 4.5:1 small text needs (axe color-contrast).
    expect(token.className).toContain('text-slate-600');
    expect(token.className).not.toContain('text-slate-500');
    const other = screen.getAllByRole('option').find((o) => o !== marked)!;
    expect(other.querySelector('[data-value-token]')!.className).toContain('text-slate-500');
  });

  it('narrows every group by the search, and says when nothing matches', () => {
    render(<Field />);
    fireEvent.click(button());
    const search = screen.getByRole('combobox', { name: 'Find a value' });
    fireEvent.change(search, { target: { value: 'complet' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Completed On{{card.field.Completed On}}',
    ]);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(text).toBe('Done by {{card.field.Completed On}}');
    fireEvent.click(button());
    const again = screen.getByRole('combobox', { name: 'Find a value' });
    fireEvent.change(again, { target: { value: 'zzz' } });
    expect(screen.getByRole('status').textContent).toBe('No values match.');
    fireEvent.keyDown(again, { key: 'Enter' });
    expect(text).toBe('Done by {{card.field.Completed On}}');
  });

  it('opens as a sheet on a phone, titled Insert a Value', () => {
    wide = false;
    render(<Field branch />);
    fireEvent.click(button());
    const sheet = screen.getByRole('dialog', { name: 'Insert a Value' });
    expect(within(sheet).getByRole('group', { name: 'The Triggering Card' })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('option', { name: /^Trigger Link/ }));
    expect(text).toBe('Done by {{trigger.url}}');
    expect(screen.queryByRole('dialog', { name: 'Insert a Value' })).toBeNull();
  });
});

describe('Insert a Value on a phone', () => {
  // A sheet closed by Escape hands focus back to the button as keyboard focus: its hover card stays away, so it
  // never sits over the step's fields, until focus leaves the button.
  it('keeps its hover card away once Escape closes the sheet', () => {
    wide = false;
    vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (
      this: HTMLElement,
      q: string,
    ) {
      return q === ':focus-visible' ? true : Element.prototype.matches.call(this, q);
    });
    render(<Field />);
    fireEvent.click(button());
    const sheet = screen.getByRole('dialog', { name: 'Insert a Value' });
    fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Insert a Value' })).toBeNull();
    fireEvent.focus(button());
    expect(
      screen.queryByText('Put a value of the card, like its title or due date, at the caret.', {
        selector: 'p',
      }),
    ).toBeNull();
    // Focus gone and back (a person tabbing to it again): the card shows as ever.
    fireEvent.blur(button());
    fireEvent.focus(button());
    expect(
      screen.getByText('Put a value of the card, like its title or due date, at the caret.', {
        selector: 'p',
      }),
    ).toBeTruthy();
    vi.restoreAllMocks();
  });
});

describe('valueInsertGroups', () => {
  it('groups the card, a branch’s triggering card, the fields and the webhook', () => {
    expect(valueInsertGroups(false, [], false).map((g) => g.label)).toEqual(['This Card']);
    expect(valueInsertGroups(true, [{ id: 'f', name: 'Size' }], true).map((g) => g.label)).toEqual([
      'This Card',
      'The Triggering Card',
      'Card Fields',
      'Webhook',
    ]);
    const groups = valueInsertGroups(false, [], true);
    expect(filterValueGroups(groups, '  ').length).toBe(2);
    expect(filterValueGroups(groups, 'WEBHOOK')[0]!.options[0]!.kind).toBe('webhook');
  });
});
