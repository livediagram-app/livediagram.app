// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, ITEM_TYPE_EXCLUDED_STATUSES_MAX, type ItemTypeDef } from '@livediagram/items';
import { ItemTypeEditor } from './ItemTypeEditor';

// docs/specs/026-plan/item-types.md "Editing a type": the editor's General, Fields and Statuses tabs.
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
  it('opens on General, with Fields and Statuses a tab away', () => {
    editor();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['General', 'Fields', 'Statuses']);
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.queryByText('On the Card')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Fields' }));
    expect(screen.getByText('On the Card')).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('lists the panel’s tabs, Overview first, above Details', () => {
    editor();
    fireEvent.click(screen.getByRole('tab', { name: 'Fields' }));
    const names = screen
      .getAllByRole('textbox')
      .map((t) => t.getAttribute('aria-label'))
      .filter((l) => /name$/.test(l ?? ''));
    expect(names).toEqual(['Tab 1 name', 'Details name']);
    expect((screen.getByLabelText('Tab 1 name') as HTMLInputElement).value).toBe('Overview');
  });

  it('moves between tabs with the arrow keys', () => {
    editor();
    const general = screen.getByRole('tab', { name: 'General' });
    fireEvent.keyDown(general, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Fields' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(general, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Statuses' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(general, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'General' }).getAttribute('aria-selected')).toBe('true');
  });

  it('marks the tab holding what stops Save', () => {
    editor();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    expect(
      screen.getByRole('tab', { name: /General/ }).querySelector('[aria-label="Needs attention"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole('tab', { name: /Fields/ }).querySelector('[aria-label="Needs attention"]'),
    ).toBeNull();
  });

  it('says too many statuses are turned off, on the Statuses tab, not as a custom field problem', () => {
    const excludedStatuses = Array.from(
      { length: ITEM_TYPE_EXCLUDED_STATUSES_MAX + 1 },
      (_, i) => `s${i}`,
    );
    editor({ ...ITEM_TYPES[1]!, excludedStatuses });
    expect(screen.getByText(/Too many statuses turned off/)).toBeTruthy();
    expect(screen.queryByText(/A custom field needs a name/)).toBeNull();
    expect(
      screen.getByRole('tab', { name: /Statuses/ }).querySelector('[aria-label="Needs attention"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole('tab', { name: /Fields/ }).querySelector('[aria-label="Needs attention"]'),
    ).toBeNull();
  });
});
