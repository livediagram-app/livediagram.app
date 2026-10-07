// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVERVIEW_TAB_ID } from '@livediagram/items';
import { ItemTypeLayoutEditor } from './ItemTypeLayoutEditor';
import { detailFields, type LayoutDraft } from './item-type-layout';

// docs/specs/026-plan/item-types.md "Editing a type": a field row's handle, lock and ⋯ menu, and Details first.
afterEach(cleanup);

const draft: LayoutDraft = {
  fields: ['title', 'status', 'assignee', 'priority', 'description'],
  custom: [],
  tabs: [{ id: OVERVIEW_TAB_ID, label: 'Overview', fields: ['description'] }],
};

function editor(typeId = 'task') {
  const onChange = vi.fn();
  render(
    <ItemTypeLayoutEditor
      typeId={typeId}
      draft={draft}
      onChange={onChange}
      detailsLabel="Details"
      onDetailsLabel={() => {}}
      removedSome={false}
    />,
  );
  return onChange;
}

const row = (name: string) =>
  screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!;

describe('a field row', () => {
  it('lists Details before the tabs', () => {
    editor();
    const names = screen
      .getAllByRole('textbox')
      .map((t) => t.getAttribute('aria-label'))
      .filter((l) => /name$/.test(l ?? ''));
    expect(names).toEqual(['Details name', 'Tab 1 name']);
  });

  it('puts a lock beside a kept field’s name, with no “Always” text', () => {
    editor('project');
    expect(screen.getByLabelText('Status is always on this type')).toBeTruthy();
    expect(screen.queryByText('Always')).toBeNull();
    expect(screen.queryByLabelText('Assignee is always on this type')).toBeNull();
  });

  it('moves a field to another group and removes it from its ⋯ menu', () => {
    const onChange = editor();
    fireEvent.click(within(row('Assignee')).getByRole('button', { name: 'More for Assignee' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Overview' }));
    expect(onChange.mock.lastCall![0].tabs[0].fields).toEqual(['description', 'assignee']);
    fireEvent.click(within(row('Priority')).getByRole('button', { name: 'More for Priority' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Up' }));
    expect(detailFields(onChange.mock.lastCall![0])).toEqual(['status', 'priority', 'assignee']);
    fireEvent.click(within(row('Priority')).getByRole('button', { name: 'More for Priority' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onChange.mock.lastCall![0].fields).not.toContain('priority');
  });

  it('offers no Remove for a kept field, and no menu for Title', () => {
    editor();
    expect(within(row('Title')).queryByRole('button', { name: /More for/ })).toBeNull();
    fireEvent.click(within(row('Status')).getByRole('button', { name: 'More for Status' }));
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Move to Overview' })).toBeTruthy();
  });

  it('drags a field by its handle to a new slot, and Escape puts it back', () => {
    const onChange = editor();
    // Rows 40px tall with a 4px gap, top to bottom in the Details list.
    for (const [i, name] of ['Status', 'Assignee', 'Priority'].entries()) {
      row(name).getBoundingClientRect = () =>
        ({ top: i * 44, bottom: i * 44 + 40, height: 40 }) as DOMRect;
    }
    const handle = row('Priority').querySelector<HTMLElement>('.cursor-grab')!;
    expect(row('Status').querySelector('.cursor-grab')).toBeNull();
    fireEvent.pointerDown(handle, { button: 0, clientY: 108, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 1 });
    expect(row('Priority').style.transform).toBe('translateY(-48px)');
    expect(row('Assignee').style.transform).toBe('translateY(44px)');
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 1 });
    expect(detailFields(onChange.mock.lastCall![0])).toEqual(['status', 'priority', 'assignee']);

    onChange.mockClear();
    fireEvent.pointerDown(handle, { button: 0, clientY: 108, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientY: 60, pointerId: 2 });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(row('Priority').style.transform).toBe('');
    fireEvent.pointerUp(handle, { clientY: 60, pointerId: 2 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
