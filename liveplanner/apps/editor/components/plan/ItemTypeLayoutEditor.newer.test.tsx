// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomFieldDef } from '@liveplanner/items';
import type { ComponentProps } from 'react';
import { ItemTypeLayoutEditor, NEWER_FIELD_LOCK } from './ItemTypeLayoutEditor';
import { detailFields, type LayoutDraft } from './item-type-layout';

// docs/specs/026-plan/item-types.md "Fields from a newer version": in the type editor a field a newer liveplanner made
// wears the Newer Field icon and a lock, has no Edit and no Remove, and moves as any field does.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const SIGNED = {
  id: 'f-signed',
  label: 'Signed By',
  kind: 'signature',
  required: true,
} as unknown as CustomFieldDef;
const draft: LayoutDraft = {
  fields: ['title', 'status', 'f-amount', 'f-signed'],
  custom: [{ id: 'f-amount', label: 'Amount', kind: 'number' }, SIGNED],
  tabs: [],
};

function editor() {
  const onChange = vi.fn<ComponentProps<typeof ItemTypeLayoutEditor>['onChange']>();
  render(
    <ItemTypeLayoutEditor
      typeId="contract"
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

describe('a newer field in the type editor', () => {
  it('wears the Newer Field icon and a lock that says why, never a required mark', () => {
    editor();
    const signed = within(row('Signed By'));
    expect(signed.getByRole('img', { name: 'Newer Field' })).toBeTruthy();
    expect(signed.getByRole('img', { name: NEWER_FIELD_LOCK })).toBeTruthy();
    expect(row('Signed By').textContent).toBe('Signed By');
  });

  it('has no Edit and no Remove, while a known field keeps both', () => {
    editor();
    expect(within(row('Signed By')).queryByRole('button', { name: 'Edit Signed By' })).toBeNull();
    expect(within(row('Amount')).getByRole('button', { name: 'Edit Amount' })).toBeTruthy();
    fireEvent.click(within(row('Signed By')).getByRole('button', { name: 'More for Signed By' }));
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
  });

  it('moves among the type’s fields', () => {
    const onChange = editor();
    fireEvent.click(within(row('Signed By')).getByRole('button', { name: 'More for Signed By' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Up' }));
    const moved = onChange.mock.lastCall![0];
    expect(detailFields(moved)).toEqual(['status', 'f-signed', 'f-amount']);
    expect(moved.custom).toEqual(draft.custom);
  });
});
