// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomFieldDef, ItemFieldValue } from '@liveplanner/items';
import { CHOICE_FILTER_FROM, ChoiceField } from './ChoiceField';
import { CustomFieldEditor } from './CustomFieldEditor';
import { CustomFieldPreview } from './CustomFieldKindParts';
import { LABEL_COLOURS } from './label-colour';
import { choiceColour, choicePicks, matchOptions, toggledChoice } from './choice-options';

// docs/specs/026-plan/item-types.md "Choice and Multiple Choice in the card panel".
afterEach(cleanup);

const DIET: CustomFieldDef = {
  id: 'f-diet',
  label: 'Dietary Needs',
  kind: 'multichoice',
  options: ['Vegetarian', 'Vegan 🌱', 'Gluten free'],
};
const MEAL: CustomFieldDef = {
  id: 'f-meal',
  label: 'Meal',
  kind: 'choice',
  options: ['Fish', 'Meat', 'Veg'],
};

function field(def: CustomFieldDef, value: ItemFieldValue | undefined, disabled = false) {
  const onSave = vi.fn();
  const view = render(
    <ChoiceField id="f" field={def} value={value} disabled={disabled} onSave={onSave} />,
  );
  return { onSave, ...view };
}

const list = () => screen.getByRole('listbox');
const options = () => within(list()).getAllByRole('option');

describe('choice-options', () => {
  it('colours an option by its place, the label swatches in turn, and none for a stale value', () => {
    const many = Array.from({ length: 10 }, (_, i) => `O${i}`);
    expect(choiceColour(many, 'O0')).toBe(LABEL_COLOURS[0]);
    expect(choiceColour(many, 'O1')).toBe(LABEL_COLOURS[1]);
    expect(choiceColour(many, 'O8')).toBe(LABEL_COLOURS[0]);
    expect(choiceColour(many, 'Gone')).toBeUndefined();
  });

  it('reads picks in option order, once each, stale values after, and a single string as one', () => {
    expect(choicePicks(['a', 'b', 'c'], ['c', 'x', 'a', 'a', '', 3])).toEqual(['a', 'c', 'x']);
    expect(choicePicks(['a'], 'a')).toEqual(['a']);
    expect(choicePicks(['a'], '')).toEqual([]);
    expect(choicePicks(['a'], undefined)).toEqual([]);
  });

  it('toggles an option into its place or off, keeping stale values', () => {
    expect(toggledChoice(['a', 'b', 'c'], ['c', 'x'], 'a')).toEqual(['a', 'c', 'x']);
    expect(toggledChoice(['a', 'b', 'c'], ['a', 'c', 'x'], 'c')).toEqual(['a', 'x']);
  });

  it('matches options by contained text, case aside', () => {
    expect(matchOptions(['Vegan', 'Vegetarian', 'Halal'], ' VEG ')).toEqual([
      'Vegan',
      'Vegetarian',
    ]);
    expect(matchOptions(['a', 'b'], '')).toEqual(['a', 'b']);
  });

  it('matches 20 options against a 10,000-character query well within budget', () => {
    const opts = Array.from({ length: 20 }, (_, i) => `Option ${i} `.repeat(9));
    const query = ' a'.repeat(5000);
    const start = process.cpuUsage();
    for (let i = 0; i < 200; i++) matchOptions(opts, query);
    const used = process.cpuUsage(start);
    expect((used.user + used.system) / 1000).toBeLessThan(500);
  });
});

describe('Multiple Choice', () => {
  it('reads None when empty, and opens its list from the field’s empty room', () => {
    field(DIET, undefined);
    const group = screen.getByRole('group', { name: 'Dietary Needs' });
    expect(group.textContent).toContain('None');
    fireEvent.click(group);
    expect(options().map((o) => o.getAttribute('aria-label'))).toEqual(DIET.options);
    expect(screen.getByRole('status').textContent).toBe('0 of 3 chosen');
  });

  it('draws each pick as a chip in its option’s colour, wrapping, with a remove button', () => {
    const { onSave } = field(DIET, ['Gluten free', 'Vegetarian']);
    const chips = document.querySelectorAll<HTMLElement>('[data-field-chip]');
    expect([...chips].map((c) => c.textContent)).toEqual(['Vegetarian', 'Gluten free']);
    expect(chips[0]!.style.getPropertyValue('--chip')).toBe(LABEL_COLOURS[0]);
    expect(chips[1]!.style.getPropertyValue('--chip')).toBe(LABEL_COLOURS[2]);
    expect(chips[0]!.className).toContain('min-h-6');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Vegetarian from Dietary Needs' }));
    expect(onSave).toHaveBeenLastCalledWith(['Gluten free']);
  });

  it('toggles options from the list by click, keeps it open, and saves in option order', () => {
    const { onSave, rerender } = field(DIET, ['Gluten free']);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Dietary Needs' }));
    expect(list().getAttribute('aria-multiselectable')).toBe('true');
    expect(options()[2]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(options()[1]!);
    expect(onSave).toHaveBeenLastCalledWith(['Vegan 🌱', 'Gluten free']);
    rerender(
      <ChoiceField
        id="f"
        field={DIET}
        value={['Vegan 🌱', 'Gluten free']}
        disabled={false}
        onSave={onSave}
      />,
    );
    expect(list()).toBeTruthy();
    // Taking the last one off clears the field.
    fireEvent.click(options()[1]!);
    expect(onSave).toHaveBeenLastCalledWith(['Gluten free']);
  });

  it('works by keyboard: arrows, Home, End, Space and Enter toggle, Tab closes', () => {
    const { onSave } = field(DIET, undefined);
    const add = screen.getByRole('button', { name: 'Add to Dietary Needs' });
    fireEvent.click(add);
    const box = list();
    expect(document.activeElement).toBe(box);
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: ' ' });
    expect(onSave).toHaveBeenLastCalledWith(['Vegan 🌱']);
    fireEvent.keyDown(box, { key: 'End' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSave).toHaveBeenLastCalledWith(['Gluten free']);
    fireEvent.keyDown(box, { key: 'Home' });
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(box.getAttribute('aria-activedescendant')).toMatch(/-0$/);
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears every pick from the footer', () => {
    const { onSave } = field(DIET, ['Vegetarian', 'Vegan 🌱']);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Dietary Needs' }));
    expect(screen.getByRole('status').textContent).toBe('2 of 3 chosen');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('shows a value that is no longer an option, grey and named so, and keeps it on a pick', () => {
    const { onSave } = field(DIET, ['Pescatarian', 'Vegetarian']);
    const chips = document.querySelectorAll<HTMLElement>('[data-field-chip]');
    expect(chips[1]!.textContent).toBe('Pescatarian, No longer an option');
    expect(chips[1]!.style.getPropertyValue('--chip')).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Dietary Needs' }));
    fireEvent.click(options()[2]!);
    expect(onSave).toHaveBeenLastCalledWith(['Vegetarian', 'Gluten free', 'Pescatarian']);
  });

  it('is chips alone for a Viewer: no remove buttons, no add, no list', () => {
    field(DIET, ['Vegetarian'], true);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Vegetarian')).toBeTruthy();
  });

  it('says None for a Viewer when it holds nothing', () => {
    field(DIET, undefined, true);
    expect(screen.getByRole('group', { name: 'Dietary Needs' }).textContent).toBe('None');
  });
});

describe('Choice', () => {
  it('shows its one option as a chip, or None, and picks from a list starting with None', () => {
    const { onSave } = field(MEAL, 'Veg');
    const trigger = screen.getByRole('button', { name: 'Meal: Veg' });
    expect(
      trigger.querySelector<HTMLElement>('[data-option-chip]')!.style.getPropertyValue('--chip'),
    ).toBe(LABEL_COLOURS[2]);
    fireEvent.click(trigger);
    expect(options().map((o) => o.getAttribute('aria-label'))).toEqual([
      'None',
      'Fish',
      'Meat',
      'Veg',
    ]);
    expect(options()[3]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(options()[1]!);
    expect(onSave).toHaveBeenLastCalledWith('Fish');
    // A pick closes the list and hands focus back to the field.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('clears with None, and picking the held option saves nothing', () => {
    const { onSave } = field(MEAL, 'Fish');
    fireEvent.click(screen.getByRole('button', { name: 'Meal: Fish' }));
    fireEvent.click(options()[1]!);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Meal: Fish' }));
    fireEvent.click(options()[0]!);
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('opens from the arrow keys on the field and closes on Escape, focus back on the field', () => {
    field(MEAL, undefined);
    const trigger = screen.getByRole('button', { name: 'Meal: None' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(list().getAttribute('aria-activedescendant')).toMatch(/-0$/);
    act(() => {
      list().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a press outside, leaving focus where it landed', () => {
    field(MEAL, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Meal: None' }));
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows a value that is no longer an option grey, named so, and follows the pointer', () => {
    field(MEAL, 'Lamb');
    const trigger = screen.getByRole('button', { name: 'Meal: Lamb' });
    const chip = trigger.querySelector<HTMLElement>('[data-option-chip]')!;
    expect(chip.style.getPropertyValue('--chip')).toBe('');
    expect(chip.textContent).toBe('Lamb, No longer an option');
    fireEvent.click(trigger);
    // Nothing held is an option: the list opens on None.
    expect(list().getAttribute('aria-activedescendant')).toMatch(/-0$/);
    fireEvent.pointerMove(options()[2]!);
    expect(list().getAttribute('aria-activedescendant')).toMatch(/-2$/);
    // A press on a row keeps focus in the list.
    expect(fireEvent.pointerDown(options()[2]!)).toBe(false);
  });

  it('is disabled for a Viewer, with no chevron', () => {
    field(MEAL, 'Meat', true);
    const trigger = screen.getByRole('button', { name: 'Meal: Meat' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.querySelector('svg')).toBeNull();
  });
});

describe('many options', () => {
  const MANY: CustomFieldDef = {
    ...DIET,
    options: Array.from({ length: CHOICE_FILTER_FROM + 2 }, (_, i) => `Option ${i + 1}`),
  };

  it('opens with a find field that narrows the rows and toggles with Enter', () => {
    const { onSave } = field(MANY, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Dietary Needs' }));
    const find = screen.getByRole('textbox', { name: 'Find an option for Dietary Needs' });
    expect(document.activeElement).toBe(find);
    fireEvent.change(find, { target: { value: 'option 1' } });
    expect(options().map((o) => o.getAttribute('aria-label'))).toEqual(['Option 1', 'Option 10']);
    // Space types in the find field; Enter toggles.
    fireEvent.keyDown(find, { key: ' ' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(find, { key: 'ArrowDown' });
    fireEvent.keyDown(find, { key: 'Enter' });
    expect(onSave).toHaveBeenLastCalledWith(['Option 10']);
  });

  it('says when nothing matches, and Clear Search brings every option back', () => {
    field({ ...MANY, kind: 'choice' }, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Dietary Needs: None' }));
    const find = screen.getByRole('textbox', { name: 'Find an option for Dietary Needs' });
    fireEvent.change(find, { target: { value: 'zzz' } });
    expect(screen.getByText('No options match “zzz”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(options()).toHaveLength(MANY.options!.length + 1);
  });
});

describe('a field with no options', () => {
  it('says so in its list', () => {
    field({ ...DIET, options: [] }, undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Dietary Needs' }));
    expect(screen.getByText('No Options Yet')).toBeTruthy();
  });
});

describe('the item panel and the type editor', () => {
  it('routes both kinds through the chip control', () => {
    render(
      <CustomFieldEditor id="m" field={MEAL} value="Fish" disabled={false} onSave={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Meal: Fish' })).toBeTruthy();
  });

  it('previews the options as coloured chips', () => {
    render(
      <CustomFieldPreview label="Meal" kind="multichoice" options={['Fish', 'Meat', 'Veg']} />,
    );
    const chips = document.querySelectorAll<HTMLElement>('[data-option-chip]');
    expect([...chips].map((c) => c.textContent)).toEqual(['Fish', 'Meat']);
    cleanup();
    render(<CustomFieldPreview label="Meal" kind="choice" options={[]} />);
    expect(document.querySelectorAll('[data-option-chip]')).toHaveLength(1);
  });
});
