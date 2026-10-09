// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, ITEM_TYPE_EXCLUDED_STATUSES_MAX, type ItemTypeDef } from '@livediagram/items';
import { ItemTypeEditor, deleteMessage } from './ItemTypeEditor';

// docs/specs/026-plan/item-types.md "Editing a type": the editor's Configuration, States and Display tabs.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

function editor(type: ItemTypeDef = ITEM_TYPES[1]!) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { types: ITEM_TYPES, items: new Map(), statusNames: new Map() });
  render(
    <ItemTypeEditor
      type={type}
      types={ITEM_TYPES}
      itemCount={0}
      canDelete
      onSave={vi.fn()}
      onDelete={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('the type editor’s tabs', () => {
  it('opens on Configuration, with States and Display a tab away', () => {
    editor();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Configuration', 'States', 'Display']);
    expect(screen.getByRole('tab', { name: 'Configuration' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'States' }));
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByText('On the Card')).toBeNull();
  });

  it('opens a new type on Configuration too, the caret in Name', () => {
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { types: ITEM_TYPES, items: new Map(), statusNames: new Map() });
    render(
      <ItemTypeEditor
        type={null}
        types={ITEM_TYPES}
        itemCount={0}
        canDelete={false}
        onSave={vi.fn()}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Configuration' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('shows General then Fields in Configuration, each under its own heading', () => {
    editor();
    const panel = screen.getByRole('tabpanel');
    const headings = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['General', 'Fields']);
    // General's heading is for screen readers only; Fields shows its own.
    const [generalHeading, fieldsHeading] = within(panel).getAllByRole('heading', { level: 3 });
    expect(generalHeading!.className).toMatch(/\bsr-only\b/);
    expect(fieldsHeading!.className).not.toMatch(/\bsr-only\b/);
    const general = within(panel).getByRole('region', { name: 'General' });
    const fields = within(panel).getByRole('region', { name: 'Fields' });
    expect(within(general).getByLabelText('Name')).toBeTruthy();
    expect(within(general).getByText('Colour')).toBeTruthy();
    expect(within(fields).getByText('On the Card')).toBeTruthy();
    // General first, Fields after it.
    expect(general.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts Name and Colour side by side in one row, Name first', () => {
    editor();
    const general = screen.getByRole('region', { name: 'General' });
    const name = within(general).getByText('Name').parentElement!;
    const colour = within(general).getByText('Colour').parentElement!;
    // One shared row (a grid from the md breakpoint), Name on the left, Colour to its right.
    expect(name.parentElement).toBe(colour.parentElement);
    expect(name.parentElement!.className).toMatch(/\bmd:grid\b/);
    expect(name.nextElementSibling).toBe(colour);
  });

  it('lists Details above the panel’s tabs, Overview first', () => {
    editor();
    const names = screen
      .getAllByRole('textbox')
      .map((t) => t.getAttribute('aria-label'))
      .filter((l) => /name$/.test(l ?? ''));
    expect(names).toEqual(['Details name', 'Tab 1 name']);
    expect((screen.getByLabelText('Tab 1 name') as HTMLInputElement).value).toBe('Overview');
  });

  it('moves between tabs with the arrow keys', () => {
    editor();
    const configuration = screen.getByRole('tab', { name: 'Configuration' });
    fireEvent.keyDown(configuration, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'States' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(configuration, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Display' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(configuration, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Configuration' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(configuration, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Display' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(configuration, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Configuration' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('marks Configuration for a clashing name, but not a name still to be given', () => {
    editor();
    const configuration = () =>
      screen
        .getByRole('tab', { name: /Configuration/ })
        .querySelector('[aria-label="Needs attention"]');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    expect(configuration()).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ITEM_TYPES[0]!.label } });
    expect(configuration()).not.toBeNull();
    expect(
      screen.getByRole('tab', { name: /States/ }).querySelector('[aria-label="Needs attention"]'),
    ).toBeNull();
  });

  it('marks Configuration for a tab with no name', () => {
    editor();
    fireEvent.change(screen.getByLabelText('Tab 1 name'), { target: { value: ' ' } });
    expect(screen.getByText('Give every tab a name.')).toBeTruthy();
    expect(
      screen
        .getByRole('tab', { name: /Configuration/ })
        .querySelector('[aria-label="Needs attention"]'),
    ).not.toBeNull();
  });

  it('says too many statuses are turned off, on the Statuses tab, not as a custom field problem', () => {
    const excludedStatuses = Array.from(
      { length: ITEM_TYPE_EXCLUDED_STATUSES_MAX + 1 },
      (_, i) => `s${i}`,
    );
    editor({ ...ITEM_TYPES[1]!, excludedStatuses });
    expect(screen.getByText(/Too many states turned off/)).toBeTruthy();
    expect(screen.queryByText(/A custom field needs a name/)).toBeNull();
    expect(
      screen.getByRole('tab', { name: /States/ }).querySelector('[aria-label="Needs attention"]'),
    ).not.toBeNull();
    expect(
      screen
        .getByRole('tab', { name: /Configuration/ })
        .querySelector('[aria-label="Needs attention"]'),
    ).toBeNull();
  });
});

describe('deleting a type', () => {
  it('says its cards go to the Trash too, only when it has any', () => {
    expect(deleteMessage('Bug', 0)).toBe('Delete the Bug type?');
    expect(deleteMessage('Bug', 1)).toBe(
      'Delete the Bug type? Its card will be moved to the Trash too.',
    );
    expect(deleteMessage('Bug', 3)).toBe(
      'Delete the Bug type? Its 3 cards will be moved to the Trash too.',
    );
  });

  it('asks in a popover before deleting, and Cancel deletes nothing', () => {
    const onDelete = vi.fn();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { types: ITEM_TYPES, items: new Map(), statusNames: new Map() });
    render(
      <ItemTypeEditor
        type={ITEM_TYPES[1]!}
        types={ITEM_TYPES}
        itemCount={2}
        canDelete
        onSave={vi.fn()}
        onDelete={onDelete}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.getByText('Delete the Task type? Its 2 cards will be moved to the Trash too.'),
    ).toBeTruthy();
    const pop = () => document.querySelector<HTMLElement>('[data-confirm-popover]')!;
    fireEvent.click(within(pop()).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(pop()).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('the Display tab', () => {
  it('shows a live preview and saves a size that differs from the default', () => {
    const onSave = vi.fn();
    for (const key of Object.keys(plan)) delete plan[key];
    Object.assign(plan, { types: ITEM_TYPES, items: new Map(), statusNames: new Map() });
    render(
      <ItemTypeEditor
        type={ITEM_TYPES[1]!}
        types={ITEM_TYPES}
        itemCount={0}
        canDelete
        onSave={onSave}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    expect(screen.getByRole('group', { name: 'Compact card' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Minimal' }));
    // An available field, pressed, asks where it goes.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Due Date' }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'After the Title' }));
    expect(screen.getByRole('button', { name: 'Reset to Default' })).toBeTruthy();
    // On the card, moved with the keyboard to the part before the title.
    fireEvent.keyDown(screen.getByRole('button', { name: /^Due Date, in After the Title/ }), {
      key: 'ArrowUp',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave.mock.lastCall![0].display).toEqual({ minimal: { lead: ['due'] } });
  });
});
