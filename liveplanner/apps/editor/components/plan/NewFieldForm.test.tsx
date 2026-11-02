// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { ITEM_TYPE_CUSTOM_MAX, type ItemFieldId } from '@liveplanner/items';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { NewFieldForm } from './NewFieldForm';
import { GALLERY_WIDTH } from './gallery/GalleryFrame';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field, Pick (the gallery: search, the rail of categories, the
// kinds as tiles, the keyboard) then Shape (Ready to use, name, the kind's settings, Required, the preview, Add {Name}), Escape and back.
vi.mock('./PlanContext', () => ({ usePlan: () => null }));
afterEach(cleanup);

// As the type editor opens it: in an AnchoredPopover, its Escape asked first.
function Harness(props: {
  missing: readonly ItemFieldId[];
  canAddCustom: boolean;
  onAddBuiltIn: (id: ItemFieldId) => void;
  onAddCustom: (f: unknown) => void;
  onClose: () => void;
  anchor: HTMLElement;
}) {
  const escape = useRef<(() => boolean) | null>(null);
  return (
    <AnchoredPopover
      anchor={props.anchor}
      name="Add Field"
      width={GALLERY_WIDTH}
      onEscape={() => escape.current?.() ?? false}
      onClose={props.onClose}
    >
      <NewFieldForm
        escapeRef={escape}
        missing={props.missing}
        canAddCustom={props.canAddCustom}
        onAddBuiltIn={props.onAddBuiltIn}
        onAddCustom={props.onAddCustom}
        onCancel={props.onClose}
      />
    </AnchoredPopover>
  );
}

function open({
  missing = ['assignee', 'due', 'labels'] as ItemFieldId[],
  canAddCustom = true,
} = {}) {
  const anchor = document.createElement('button');
  document.body.append(anchor);
  const spies = { onAddBuiltIn: vi.fn(), onAddCustom: vi.fn(), onClose: vi.fn() };
  render(<Harness missing={missing} canAddCustom={canAddCustom} anchor={anchor} {...spies} />);
  return spies;
}

const search = () => screen.getByRole('searchbox', { name: 'Search fields' });
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });
const rail = () => within(screen.getByRole('navigation', { name: 'Field categories' }));
const entry = (name: string) => rail().getByRole('button', { name: new RegExp(`^${name}`) });
const current = () =>
  screen
    .getByRole('navigation', { name: 'Field categories' })
    .querySelector('[aria-current="true"]')
    ?.getAttribute('data-rail-entry');
const kind = (name: string) => screen.getByRole('button', { name, exact: true } as never);
const tile = (k: string) => document.querySelector<HTMLButtonElement>(`[data-kind="${k}"]`)!;
const kindNames = () =>
  [...document.querySelectorAll('[data-kind]')].map((b) => b.getAttribute('aria-label'));
const readyToUse = () =>
  within(screen.getByRole('region', { name: 'Ready to use' }))
    .getAllByRole('button')
    .map((b) => b.querySelector('.font-medium')?.textContent);
const tagged = () =>
  [...document.querySelectorAll('[data-kind-tile]')]
    .filter((t) => t.textContent?.includes('Ready to use'))
    .map((t) => t.querySelector('[data-kind]')!.getAttribute('aria-label'));
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
const preview = () => within(screen.getByRole('figure', { name: 'Preview' }));
const name = () => screen.getByRole('textbox', { name: 'Name' });
const addButton = () => screen.getByRole('button', { name: /^Add (?!an option)/ });
const pick = (k: string) => fireEvent.click(kind(k));
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });

const ALL_KINDS = [
  'Text',
  'Long Text',
  'Number',
  'Currency',
  'Percent',
  'Rating',
  'Date',
  'Date and Time',
  'Date Range',
  'Duration',
  'Choice',
  'Multiple Choice',
  'Checkbox',
  'Labels',
  'Colour',
  'Person',
  'Checklist',
  'Comments',
  'Votes',
  'Link',
  'Email',
  'Phone',
  'Image',
  'Link to Card',
  'Calculated',
];

describe('Pick', () => {
  it('opens on the search and All Fields: every kind a tile under its category, with its line and a sample', () => {
    open();
    expect(document.activeElement).toBe(search());
    expect(screen.getByRole('heading', { name: 'Add Field' })).toBeTruthy();
    expect(current()).toBe('all');
    expect(entry('All Fields').textContent).toContain('25');
    expect(kindNames()).toEqual(ALL_KINDS);
    for (const c of ['Text', 'Numbers and Money', 'Dates and Time', 'Cards and Formulas'])
      expect(screen.getByRole('heading', { name: c })).toBeTruthy();
    expect(screen.getByText('Counts, amounts, shares and scores.')).toBeTruthy();
    const line = document.getElementById(kind('Link').getAttribute('aria-describedby')!);
    expect(line?.textContent).toBe('A web address');
    // Each tile draws a sample of its kind's value.
    const currency = document.querySelector('[data-kind-tile="currency"]')!;
    expect(currency.textContent).toContain('£12,500');
  });

  it('shows one category from the rail, and every one again from All Fields', () => {
    open();
    fireEvent.click(entry('Choices and Tags'));
    expect(current()).toBe('choices');
    expect(kindNames()).toEqual(['Choice', 'Multiple Choice', 'Checkbox', 'Labels', 'Colour']);
    expect(entry('Choices and Tags').getAttribute('aria-current')).toBe('true');
    fireEvent.click(entry('People and Teamwork'));
    expect(kindNames()).toEqual(['Person', 'Checklist', 'Comments', 'Votes']);
    fireEvent.click(entry('All Fields'));
    expect(kindNames()).toEqual(ALL_KINDS);
  });

  it('tags the kinds whose built-in field the type lacks Ready to use, and says so', () => {
    open({ missing: ['assignee', 'due', 'labels', 'comments'] });
    expect(tagged()).toEqual(['Date', 'Labels', 'Person', 'Comments']);
    const described = kind('Date').getAttribute('aria-describedby')!.split(' ');
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'A day on the calendar',
      'Ready to use',
    ]);
    expect(kind('Text').getAttribute('aria-describedby')!.split(' ')).toHaveLength(1);
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields": they open Shape as every kind does.
  it('opens Shape for Comments and Votes, offering the built-in while the type lacks it', () => {
    const { onAddBuiltIn, onAddCustom } = open({ missing: ['votes'] });
    pick('Votes');
    expect(readyToUse()).toEqual(['Votes']);
    expect(screen.getByText('Session votes, Top Voted and sorting')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Votes/ }));
    expect(onAddBuiltIn).toHaveBeenCalledWith('votes');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Comments');
    expect(screen.queryByRole('region', { name: 'Ready to use' })).toBeNull();
    fireEvent.change(name(), { target: { value: 'Design Review' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Design Review', kind: 'comments' }),
    );
  });

  it('makes a Votes field from its name alone, never required, its preview a ▲ count', () => {
    const { onAddCustom } = open({ missing: [] });
    pick('Votes');
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
    expect(preview().getByText('▲ 3')).toBeTruthy();
    fireEvent.change(name(), { target: { value: 'Priority Vote' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith({ label: 'Priority Vote', kind: 'votes' });
  });

  it('filters the kinds as you type, by a built-in’s name too, counting the matches on the rail', () => {
    open();
    type('date');
    expect(kindNames()).toEqual(['Date', 'Date and Time', 'Date Range']);
    expect(screen.getByRole('heading', { name: 'Dates and Time' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Text' })).toBeNull();
    expect(entry('Dates and Time').textContent).toContain('3');
    expect(entry('All Fields').textContent).toContain('3');
    // A category with no match is dimmed, its count gone.
    expect(entry('Text').className).toContain('opacity-55');
    expect(entry('Text').textContent).toBe('Text');
    const words: [string, string[]][] = [
      ['due', ['Date']],
      ['assignee', ['Person']],
      ['photo', ['Image']],
      ['money', ['Currency']],
      ['yes/no', ['Checkbox']],
      ['parent', ['Link to Card']],
      ['percent', ['Percent']],
      ['url', ['Link']],
      ['stars', ['Rating']],
      ['dropdown', ['Choice']],
    ];
    for (const [word, kinds] of words) {
      type(word);
      expect(kindNames()).toEqual(kinds);
    }
    expect(screen.getByText('1 field matches')).toBeTruthy();
    type('');
    expect(kindNames()).toEqual(ALL_KINDS);
  });

  it('searches every category from one, narrows the matches from the rail, and keeps the category after', () => {
    open();
    fireEvent.click(entry('Text'));
    type('tags');
    expect(current()).toBe('all');
    expect(kindNames()).toEqual(['Multiple Choice', 'Labels']);
    fireEvent.click(entry('Choices and Tags'));
    expect(kindNames()).toEqual(['Multiple Choice', 'Labels']);
    // Typing more keeps the category picked.
    type('tags label');
    expect(current()).toBe('choices');
    fireEvent.click(entry('Text'));
    expect(screen.getByRole('status').textContent).toContain('No Text fields match');
    type('');
    expect(current()).toBe('text');
    expect(kindNames()).toEqual(['Text', 'Long Text']);
  });

  it('says so when nothing matches, the rail stepping aside', () => {
    open();
    type('zebra');
    expect(screen.getByRole('status').textContent).toContain('No fields match');
    expect(screen.getByRole('status').textContent).toContain('zebra');
    expect(screen.getByText('Try a word like money, date or parent.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Field categories' })).toBeNull();
    expect(kindNames()).toEqual([]);
    expect(screen.getByText('0 fields match')).toBeTruthy();
  });

  it('moves between the tiles with the arrow keys, and Enter in the search picks the first match', () => {
    open();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile('text'));
    key('ArrowRight');
    expect(document.activeElement).toBe(tile('longtext'));
    key('ArrowLeft');
    expect(document.activeElement).toBe(tile('text'));
    // Laid out with no size (jsdom), down and up move two tiles: a row.
    key('ArrowDown');
    expect(document.activeElement).toBe(tile('number'));
    key('End');
    expect(document.activeElement).toBe(tile('calculated'));
    key('Home');
    expect(document.activeElement).toBe(tile('text'));
    // Up from the top row goes back to the search.
    key('ArrowUp');
    expect(document.activeElement).toBe(search());
    // Enter with nothing typed picks nothing.
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(screen.queryByRole('form')).toBeNull();
    type('due');
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(screen.getByRole('form', { name: 'New Date field' })).toBeTruthy();
  });

  it('says the type holds the most custom fields it can, keeping only kinds with a built-in to add', () => {
    const { onAddBuiltIn } = open({ canAddCustom: false });
    expect(
      screen.getByText(
        `This type holds the most custom fields it can (${ITEM_TYPE_CUSTOM_MAX}). Remove one to add another.`,
      ),
    ).toBeTruthy();
    expect(tile('text').getAttribute('aria-disabled')).toBe('true');
    expect(tile('text').getAttribute('aria-label')).toBe(
      'Text: Remove a custom field to add another',
    );
    expect(tile('text').hasAttribute('data-pick')).toBe(false);
    fireEvent.click(tile('text'));
    expect(screen.queryByRole('form')).toBeNull();
    // Enter in a search skips a dimmed kind for one that can be picked.
    type('date');
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(readyToUse()).toEqual(['Due Date']);
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.queryByText('Or make your own')).toBeNull();
    fireEvent.submit(screen.getByRole('form', { name: 'New Date field' }));
    fireEvent.click(screen.getByRole('button', { name: /^Due Date/ }));
    expect(onAddBuiltIn).toHaveBeenCalledWith('due');
  });

  it('closes with Escape, after a typed search is cleared first', () => {
    const { onClose } = open();
    type('mon');
    escape();
    expect((search() as HTMLInputElement).value).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    escape();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes from its cross', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
describe('Shape', () => {
  it('offers the kind’s built-in fields the type lacks as Ready to use, then your own', () => {
    const { onAddBuiltIn, onAddCustom } = open({ missing: ['assignee', 'start', 'due'] });
    pick('Date');
    expect(readyToUse()).toEqual(['Start Date', 'Due Date']);
    expect(screen.getByText('Where its bar starts on the Gantt chart')).toBeTruthy();
    expect(screen.getByText('Or make your own')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Due Date/ }));
    expect(onAddBuiltIn).toHaveBeenCalledWith('due');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Person');
    expect(readyToUse()).toEqual(['Assignee']);
    fireEvent.change(name(), { target: { value: 'Reviewer' } });
    expect(preview().getByText('Sam Rivera')).toBeTruthy();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Reviewer', kind: 'person' }),
    );
  });

  it('makes more of a kind the type has, with no Ready to use', () => {
    const { onAddCustom } = open({ missing: [] });
    pick('Colour');
    expect(screen.queryByRole('region', { name: 'Ready to use' })).toBeNull();
    expect(screen.queryByText('Or make your own')).toBeNull();
    fireEvent.change(name(), { target: { value: 'Theme' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Theme', kind: 'colour' }),
    );
  });

  it('previews each built-in kind as its field draws, and never makes an Image required', () => {
    open({ missing: [] });
    pick('Labels');
    expect(preview().getByText('Design')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Checklist');
    expect(preview().getByText(/2\/5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Colour');
    expect(preview().getByText('Teal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Image');
    expect(preview().getByText('photo.png')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
  });

  it('shows the kind, focuses Name, and adds once named, by Enter too', () => {
    const { onAddCustom } = open();
    pick('Text');
    expect(screen.getByRole('form', { name: 'New Text field' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^All kinds/ }).textContent).toBe('All kindsText');
    expect(document.activeElement).toBe(name());
    expect(addButton().textContent).toBe('Add Text Field');
    expect(addButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Name the field to add it.')).toBeTruthy();
    fireEvent.change(name(), { target: { value: '  Area ' } });
    expect(addButton().textContent).toBe('Add Area');
    expect(preview().getByText('Area')).toBeTruthy();
    expect(preview().getByText('Example card')).toBeTruthy();
    fireEvent.submit(name());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Area', kind: 'text', options: undefined }),
    );
  });

  it('goes back to Pick with All kinds or Escape, the search kept and the kind focused', () => {
    const { onClose } = open();
    type('mon');
    pick('Currency');
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect((search() as HTMLInputElement).value).toBe('mon');
    expect(document.activeElement).toBe(kind('Currency'));
    type('');
    fireEvent.click(entry('Numbers and Money'));
    pick('Rating');
    // The rail stays beside Shape, the category marked.
    expect(current()).toBe('numbers');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    expect(current()).toBe('numbers');
    expect(document.activeElement).toBe(kind('Rating'));
  });

  it('goes back to Pick on a category pressed in the rail, or a search typed, the name kept', () => {
    open();
    pick('Text');
    fireEvent.change(name(), { target: { value: 'Size' } });
    fireEvent.click(entry('Numbers and Money'));
    expect(screen.queryByRole('form')).toBeNull();
    expect(kindNames()).toEqual(['Number', 'Currency', 'Percent', 'Rating']);
    pick('Number');
    expect((name() as HTMLInputElement).value).toBe('Size');
    search().focus();
    type('stars');
    expect(screen.queryByRole('form')).toBeNull();
    expect(kindNames()).toEqual(['Rating']);
    // Typing goes on in the search: nothing takes its focus.
    expect(document.activeElement).toBe(search());
    // Keys in the search do nothing more while shaping.
    pick('Rating');
    search().focus();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(search());
  });

  it('keeps the name typed when another kind is picked', () => {
    open();
    pick('Text');
    fireEvent.change(name(), { target: { value: 'Size' } });
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Number');
    expect((name() as HTMLInputElement).value).toBe('Size');
    expect(preview().getByText('42')).toBeTruthy();
  });

  it('makes a Choice from its option rows, pasted lines too', async () => {
    const { onAddCustom } = open();
    pick('Choice');
    fireEvent.change(name(), { target: { value: 'Severity' } });
    expect(screen.getByText('Add at least one option.')).toBeTruthy();
    fireEvent.paste(screen.getByRole('textbox', { name: 'Option 1' }), {
      clipboardData: { getData: () => 'Low\nMedium\nHigh' },
    });
    await act(async () => {});
    expect(preview().getByText('Low')).toBeTruthy();
    // Enter in an option row adds a row; it never adds the field.
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Option 3' }), { key: 'Enter' });
    expect(onAddCustom).not.toHaveBeenCalled();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Severity',
        kind: 'choice',
        options: ['Low', 'Medium', 'High'],
      }),
    );
  });

  it('previews a Multiple Choice with its first two options', () => {
    open();
    pick('Multiple Choice');
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1' }), { target: { value: 'A' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Option 1' }), { key: 'Enter' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 2' }), { target: { value: 'B' } });
    expect(preview().getByText('A')).toBeTruthy();
    expect(preview().getByText('B')).toBeTruthy();
  });

  it('makes a Currency in the currency picked', () => {
    const { onAddCustom } = open();
    pick('Currency');
    fireEvent.change(name(), { target: { value: 'Budget' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    expect(preview().getByText(/\$12,500/)).toBeTruthy();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'currency', currency: 'USD' }),
    );
  });

  it('makes a Rating out of the scale picked', () => {
    const { onAddCustom } = open();
    pick('Rating');
    fireEvent.change(name(), { target: { value: 'Impact' } });
    fireEvent.change(screen.getByLabelText('Scale'), { target: { value: '10' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rating', scale: 10 }),
    );
  });

  it('makes a Link to Card once a type is picked', () => {
    const { onAddCustom } = open();
    pick('Link to Card');
    fireEvent.change(name(), { target: { value: 'Parent' } });
    expect(addButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Pick a card type it links to.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Links To' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Project/ }));
    expect(preview().getByText('A Project card')).toBeTruthy();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'card', linkType: 'project' }),
    );
  });

  // docs/specs/026-plan/item-types.md "Calculated fields".
  it('makes a Calculated field, the first calculation chosen', () => {
    const { onAddCustom } = open();
    pick('Calculated');
    fireEvent.change(name(), { target: { value: 'Progress' } });
    const calc = screen.getByLabelText<HTMLSelectElement>('Calculation');
    expect(calc.value).toBe('childCount');
    expect(preview().getByText('3')).toBeTruthy();
    fireEvent.change(calc, { target: { value: 'childrenDone' } });
    expect(preview().getByText('40%')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'calculated', calculation: 'childrenDone' }),
    );
  });

  // docs/specs/026-plan/item-types.md "Percent".
  it('makes a Percent field, its preview a bar at 40%', () => {
    const { onAddCustom } = open();
    pick('Percent');
    fireEvent.change(name(), { target: { value: 'Progress' } });
    expect(preview().getByText('40%')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Required' })).toBeTruthy();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Progress', kind: 'percent' }),
    );
  });

  it('finds Percent by progress, and Calculated by formula', () => {
    open();
    type('progress');
    expect(kindNames()).toEqual(['Percent']);
    type('formula');
    expect(kindNames()).toEqual(['Calculated']);
  });

  it('shows a Children Done as a Percent bar, a switch a Child Count never offers', () => {
    const { onAddCustom } = open();
    pick('Calculated');
    fireEvent.change(name(), { target: { value: 'Done' } });
    expect(screen.queryByRole('switch', { name: 'Show as Percent Bar' })).toBeNull();
    const calc = screen.getByLabelText<HTMLSelectElement>('Calculation');
    fireEvent.change(calc, { target: { value: 'childrenDone' } });
    const show = screen.getByRole('switch', { name: 'Show as Percent Bar' });
    expect(show.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(show);
    expect(show.getAttribute('aria-checked')).toBe('true');
    expect(preview().getByText('40%')).toBeTruthy();
    // Back to a count turns it off, and the switch goes.
    fireEvent.change(calc, { target: { value: 'childCount' } });
    expect(screen.queryByRole('switch', { name: 'Show as Percent Bar' })).toBeNull();
    fireEvent.change(calc, { target: { value: 'childrenDone' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Show as Percent Bar' }));
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'calculated',
        calculation: 'childrenDone',
        showAs: 'percent',
      }),
    );
  });

  // docs/specs/026-plan/item-types.md "Required fields".
  it('makes it required with a switch, which a Checkbox never offers', () => {
    const { onAddCustom } = open();
    pick('Email');
    fireEvent.change(name(), { target: { value: 'Contact' } });
    const required = screen.getByRole('switch', { name: 'Required' });
    fireEvent.click(required);
    expect(required.getAttribute('aria-checked')).toBe('true');
    expect(preview().getByText('required')).toBeTruthy();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'email', required: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Checkbox');
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'checkbox', required: undefined }),
    );
  });

  // docs/specs/026-plan/item-types.md "Notifies".
  it('offers a Person field Notifies, off by default, and no other kind', () => {
    const { onAddCustom } = open();
    pick('Person');
    fireEvent.change(name(), { target: { value: 'Reviewer' } });
    const notifies = screen.getByRole('switch', { name: 'Notifies' });
    expect(notifies.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(notifies);
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'person', notifies: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Email');
    expect(screen.queryByRole('switch', { name: 'Notifies' })).toBeNull();
  });
});
