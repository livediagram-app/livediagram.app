// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { ITEM_TYPE_CUSTOM_MAX, type ItemFieldId } from '@liveplanner/items';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { NewFieldForm } from './NewFieldForm';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field, Pick (search, one list of kinds in an accordion, the
// keyboard) then Shape (Ready to use, name, the kind's settings, Required, the preview, Add {Name}), Escape and back.
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
      width={384}
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
const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const kind = (name: string) => screen.getByRole('button', { name, exact: true } as never);
const kindNames = () =>
  [...document.querySelectorAll('[data-kind]')].map((b) => b.getAttribute('aria-label'));
const readyToUse = () =>
  within(screen.getByRole('region', { name: 'Ready to use' }))
    .getAllByRole('button')
    .map((b) => b.querySelector('.font-medium')?.textContent);
const tagged = () =>
  [...document.querySelectorAll('[data-kind]')]
    .filter((b) => b.textContent?.includes('Ready to use'))
    .map((b) => b.getAttribute('aria-label'));
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
const preview = () => within(screen.getByRole('figure', { name: 'Preview' }));
const name = () => screen.getByRole('textbox', { name: 'Name' });
const addButton = () => screen.getByRole('button', { name: /^Add (?!an option)/ });
const pick = (k: string, group?: string) => {
  if (group && header(group).getAttribute('aria-expanded') !== 'true')
    fireEvent.click(header(group));
  fireEvent.click(kind(k));
};

describe('Pick', () => {
  it('opens on the search and the first group of one list of kinds, with their lines', () => {
    open();
    expect(document.activeElement).toBe(search());
    expect(screen.queryByText('Ready-made')).toBeNull();
    expect(screen.queryByText('Your own field')).toBeNull();
    expect(header('Text & links').getAttribute('aria-expanded')).toBe('true');
    expect(header('Numbers & dates').getAttribute('aria-expanded')).toBe('false');
    expect(kindNames()).toEqual(['Text', 'Long Text', 'Link', 'Email']);
    expect(kind('Link').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('A web address')).toBeTruthy();
  });

  it('keeps one group open at a time, and closes the open one when pressed', () => {
    open();
    fireEvent.click(header('Choices'));
    expect(header('Choices').getAttribute('aria-expanded')).toBe('true');
    expect(header('Text & links').getAttribute('aria-expanded')).toBe('false');
    expect(kindNames()).toEqual(['Choice', 'Multiple Choice', 'Checkbox', 'Labels']);
    fireEvent.click(header('Choices'));
    expect(kindNames()).toEqual([]);
  });

  it('lists the built-ins’ kinds in their groups, tagging those the type lacks Ready to use', () => {
    open({ missing: ['assignee', 'due', 'labels', 'comments'] });
    fireEvent.click(header('People & teamwork'));
    expect(kindNames()).toEqual(['Person', 'Checklist', 'Comments', 'Votes']);
    expect(tagged()).toEqual(['Person', 'Comments']);
    fireEvent.click(header('Colour & images'));
    expect(kindNames()).toEqual(['Colour', 'Image']);
    fireEvent.click(header('Numbers & dates'));
    expect(tagged()).toEqual(['Date']);
  });

  // docs/specs/026-plan/item-types.md "Comments and Votes fields": they open Shape as every kind does.
  it('opens Shape for Comments and Votes, offering the built-in while the type lacks it', () => {
    const { onAddBuiltIn, onAddCustom } = open({ missing: ['votes'] });
    pick('Votes', 'People & teamwork');
    expect(readyToUse()).toEqual(['Votes']);
    expect(screen.getByText('Session votes, Top Voted and sorting')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Votes/ }));
    expect(onAddBuiltIn).toHaveBeenCalledWith('votes');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Comments', 'People & teamwork');
    expect(screen.queryByRole('region', { name: 'Ready to use' })).toBeNull();
    fireEvent.change(name(), { target: { value: 'Design Review' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Design Review', kind: 'comments' }),
    );
  });

  it('makes a Votes field from its name alone, never required, its preview a ▲ count', () => {
    const { onAddCustom } = open({ missing: [] });
    pick('Votes', 'People & teamwork');
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
    expect(preview().getByText('▲ 3')).toBeTruthy();
    fireEvent.change(name(), { target: { value: 'Priority Vote' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith({ label: 'Priority Vote', kind: 'votes' });
  });

  it('filters the kinds as you type, by a built-in’s name too, opening every group with a match', () => {
    open();
    type('date');
    expect(kindNames()).toEqual(['Date']);
    expect(header('Numbers & dates').getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Text & links/ })).toBeNull();
    type('due');
    expect(kindNames()).toEqual(['Date']);
    type('assignee');
    expect(kindNames()).toEqual(['Person']);
    type('photo');
    expect(kindNames()).toEqual(['Image']);
    type('money');
    expect(kindNames()).toEqual(['Currency']);
    type('yes/no');
    expect(kindNames()).toEqual(['Checkbox']);
    type('parent');
    expect(kindNames()).toEqual(['Link to Card']);
    type('percent');
    expect(kindNames()).toEqual(['Calculated']);
    type('url');
    expect(kindNames()).toEqual(['Link']);
    type('stars');
    expect(kindNames()).toEqual(['Rating']);
    type('dropdown');
    expect(kindNames()).toEqual(['Choice']);
    expect(screen.getByText('1 field matches')).toBeTruthy();
    // Clearing it brings the accordion back as it was.
    type('');
    expect(kindNames()).toEqual(['Text', 'Long Text', 'Link', 'Email']);
  });

  it('says so when nothing matches', () => {
    open();
    type('zebra');
    expect(screen.getByRole('status').textContent).toContain('No matches for “zebra”');
    expect(screen.getByText('Try a word like money, date or parent.')).toBeTruthy();
    expect(kindNames()).toEqual([]);
  });

  it('moves through the results with the arrow keys, and Enter in the search picks the first', () => {
    open();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toMatch(/^Text & links/);
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement?.textContent).toMatch(/^Linked cards/);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(search());
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
    expect(kind('Text').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(kind('Text'));
    expect(screen.queryByRole('form')).toBeNull();
    pick('Date', 'Numbers & dates');
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
    pick('Date', 'Numbers & dates');
    expect(readyToUse()).toEqual(['Start Date', 'Due Date']);
    expect(screen.getByText('Where its bar starts on the Gantt chart')).toBeTruthy();
    expect(screen.getByText('Or make your own')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Due Date/ }));
    expect(onAddBuiltIn).toHaveBeenCalledWith('due');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Person', 'People & teamwork');
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
    pick('Colour', 'Colour & images');
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
    pick('Labels', 'Choices');
    expect(preview().getByText('Design')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Checklist', 'People & teamwork');
    expect(preview().getByText(/2\/5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Colour', 'Colour & images');
    expect(preview().getByText('Teal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Image', 'Colour & images');
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
    pick('Rating', 'Numbers & dates');
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    expect(header('Numbers & dates').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(kind('Rating'));
  });

  it('keeps the name typed when another kind is picked', () => {
    open();
    pick('Text');
    fireEvent.change(name(), { target: { value: 'Size' } });
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Number', 'Numbers & dates');
    expect((name() as HTMLInputElement).value).toBe('Size');
    expect(preview().getByText('42')).toBeTruthy();
  });

  it('makes a Choice from its option rows, pasted lines too', async () => {
    const { onAddCustom } = open();
    pick('Choice', 'Choices');
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
    pick('Multiple Choice', 'Choices');
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1' }), { target: { value: 'A' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Option 1' }), { key: 'Enter' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Option 2' }), { target: { value: 'B' } });
    expect(preview().getByText('A')).toBeTruthy();
    expect(preview().getByText('B')).toBeTruthy();
  });

  it('makes a Currency in the currency picked', () => {
    const { onAddCustom } = open();
    pick('Currency', 'Numbers & dates');
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
    pick('Rating', 'Numbers & dates');
    fireEvent.change(name(), { target: { value: 'Impact' } });
    fireEvent.change(screen.getByLabelText('Scale'), { target: { value: '10' } });
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rating', scale: 10 }),
    );
  });

  it('makes a Link to Card once a type is picked', () => {
    const { onAddCustom } = open();
    pick('Link to Card', 'Linked cards');
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
    pick('Calculated', 'Linked cards');
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
    pick('Checkbox', 'Choices');
    expect(screen.queryByRole('switch', { name: 'Required' })).toBeNull();
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'checkbox', required: undefined }),
    );
  });

  // docs/specs/026-plan/item-types.md "Notifies".
  it('offers a Person field Notifies, off by default, and no other kind', () => {
    const { onAddCustom } = open();
    pick('Person', 'People & teamwork');
    fireEvent.change(name(), { target: { value: 'Reviewer' } });
    const notifies = screen.getByRole('switch', { name: 'Notifies' });
    expect(notifies.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(notifies);
    fireEvent.click(addButton());
    expect(onAddCustom).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'person', notifies: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^All kinds/ }));
    pick('Email', 'Text & links');
    expect(screen.queryByRole('switch', { name: 'Notifies' })).toBeNull();
  });
});
