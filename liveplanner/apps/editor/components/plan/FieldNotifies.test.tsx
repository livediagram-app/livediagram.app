// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, OVERVIEW_TAB_ID, type ItemTypeDef } from '@liveplanner/items';
import type { ComponentProps } from 'react';
import { CustomFieldForm, NOTIFIES_LINE, NotifiesSwitch } from './ItemTypeFieldForms';
import { addedField } from './AddFieldShape';
import { ItemTypeEditor } from './ItemTypeEditor';
import { FieldRow } from './ItemTypeFieldRow';
import { ItemTypeLayoutEditor } from './ItemTypeLayoutEditor';
import type { LayoutDraft } from './item-type-layout';

// docs/specs/026-plan/item-types.md "Notifies": a custom Person field's switch in its form, and the Assignee's in its
// row menu, each with its line and a `Plan` · `Changed` · `FieldNotifies` event.
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('./PlanContext', () => ({
  usePlan: () => ({ types: ITEM_TYPES, items: new Map(), statusNames: new Map() }),
}));
beforeEach(() => track.mockClear());
afterEach(cleanup);

const notifies = () => screen.getByRole('switch', { name: 'Notifies' });

describe('a custom Person field’s Notifies switch', () => {
  it('is off by default, says what it does, and switches on and back off', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomFieldForm field={{ label: 'Reviewer', kind: 'person' }} onChange={onChange} />,
    );
    expect(notifies().getAttribute('aria-checked')).toBe('false');
    expect(notifies().getAttribute('aria-describedby')).toBe(
      screen.getByText(NOTIFIES_LINE).getAttribute('id'),
    );
    fireEvent.click(notifies());
    expect(onChange).toHaveBeenLastCalledWith({ notifies: true });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'FieldNotifies');
    rerender(
      <CustomFieldForm
        field={{ label: 'Reviewer', kind: 'person', notifies: true }}
        onChange={onChange}
      />,
    );
    expect(notifies().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(notifies());
    expect(onChange).toHaveBeenLastCalledWith({ notifies: undefined });
  });

  it('is offered on a Person field alone', () => {
    render(<NotifiesSwitch field={{ kind: 'text' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('switch', { name: 'Notifies' })).toBeNull();
    expect(screen.queryByText(NOTIFIES_LINE)).toBeNull();
  });

  it('is kept by Add Field only on a Person field', () => {
    expect(addedField({ label: ' Reviewer ', kind: 'person', notifies: true })).toMatchObject({
      label: 'Reviewer',
      notifies: true,
    });
    expect(addedField({ label: 'Area', kind: 'text', notifies: true }).notifies).toBeUndefined();
    expect(addedField({ label: 'Owner', kind: 'person' }).notifies).toBeUndefined();
  });
});

describe('the Assignee’s Notifies switch', () => {
  const draft: LayoutDraft = {
    fields: ['title', 'status', 'assignee', 'priority'],
    custom: [],
    tabs: [{ id: OVERVIEW_TAB_ID, label: 'Overview', fields: [] }],
  };
  function editor(start: LayoutDraft) {
    const onChange = vi.fn<ComponentProps<typeof ItemTypeLayoutEditor>['onChange']>();
    render(
      <ItemTypeLayoutEditor
        typeId="task"
        draft={start}
        onChange={onChange}
        detailsLabel="Details"
        onDetailsLabel={() => {}}
        removedSome={false}
      />,
    );
    return onChange;
  }
  const menuOf = (name: string) => {
    const row = screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!;
    fireEvent.click(within(row).getByRole('button', { name: `More for ${name}` }));
    return screen.getByRole('menu');
  };

  it('is on in the Assignee’s menu, and switching it off stores false', () => {
    const onChange = editor(draft);
    const item = within(menuOf('Assignee')).getByRole('menuitemcheckbox', { name: 'Notifies' });
    expect(item.getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById(item.getAttribute('aria-describedby')!)?.textContent).toBe(
      NOTIFIES_LINE,
    );
    fireEvent.click(item);
    expect(onChange.mock.lastCall![0]).toEqual({ ...draft, assigneeNotifies: false });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'FieldNotifies');
    // The menu stays open, the switch flipped in place.
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('switches back on by dropping the stored false', () => {
    const onChange = editor({ ...draft, assigneeNotifies: false });
    const item = within(menuOf('Assignee')).getByRole('menuitemcheckbox', { name: 'Notifies' });
    expect(item.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(item);
    expect(onChange.mock.lastCall![0]).toEqual(draft);
  });

  it('gives a kept Assignee a menu of its switch alone', () => {
    const onChange = vi.fn();
    render(
      <ul>
        <FieldRow
          id="assignee"
          label="Assignee"
          icon={{ node: null, name: 'Person' }}
          removable={false}
          editing={false}
          moveTargets={[]}
          onMoveTo={() => {}}
          dragging={false}
          canUp={false}
          canDown={false}
          onRemove={() => {}}
          notifies={{ on: true, onChange }}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for Assignee' }));
    const menu = screen.getByRole('menu');
    expect([...menu.querySelectorAll('[role^="menuitem"]')].map((m) => m.textContent)).toEqual([
      `Notifies${NOTIFIES_LINE}`,
    ]);
    expect(within(menu).queryByRole('separator')).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Notifies' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is in no other field’s menu', () => {
    editor(draft);
    expect(
      within(menuOf('Priority')).queryByRole('menuitemcheckbox', { name: 'Notifies' }),
    ).toBeNull();
  });
});

describe('the type editor saves the Assignee’s Notifies', () => {
  function save(type: ItemTypeDef, flip: boolean) {
    const onSave = vi.fn<(t: ItemTypeDef) => void>();
    render(
      <ItemTypeEditor
        type={type}
        types={ITEM_TYPES}
        itemCount={0}
        onSave={onSave}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );
    if (flip) {
      const row = screen
        .getAllByRole('listitem')
        .find((li) => li.textContent?.startsWith('Assignee'))!;
      fireEvent.click(within(row).getByRole('button', { name: 'More for Assignee' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Notifies' }));
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    return onSave.mock.lastCall![0];
  }

  it('keeps a type’s Assignee switched off, and drops it once switched back on', () => {
    const task = ITEM_TYPES.find((t) => t.id === 'task')!;
    expect(save({ ...task, assigneeNotifies: false }, false).assigneeNotifies).toBe(false);
    cleanup();
    expect(save({ ...task, assigneeNotifies: false }, true)).not.toHaveProperty('assigneeNotifies');
    cleanup();
    expect(save(task, true).assigneeNotifies).toBe(false);
  });
});
