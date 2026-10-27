// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemPerson } from '@liveplanner/items';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { track } from '@/lib/telemetry';
import { CUSTOM_ASSIGNEE_OPTION, PersonPicker } from './PersonPicker';

// The Assignee picker's custom assignees (docs/specs/026-plan/items.md "Custom assignees").
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockReset();
});

const ME: ItemPerson = { id: 'abc123', name: 'Me', color: '#2563eb' };
const SAM: ItemPerson = { id: 'def456', name: 'Sam', color: '#16a34a' };

const picker = (opts: { disabled?: boolean; value?: ItemPerson; people?: ItemPerson[] } = {}) => {
  const onSave = vi.fn();
  render(
    <PersonPicker
      id="assignee"
      value={opts.value}
      people={opts.people ?? [ME, SAM]}
      disabled={opts.disabled ?? false}
      onSave={onSave}
    />,
  );
  return { onSave, select: screen.getByRole<HTMLSelectElement>('combobox') };
};

const optionLabels = (select: HTMLSelectElement) => [...select.options].map((o) => o.text);

describe('PersonPicker', () => {
  it('ends with + Custom Assignee, after No one and the people', () => {
    const { select } = picker();
    expect(optionLabels(select)).toEqual(['No one', 'Me', 'Sam', '+ Custom Assignee']);
  });

  it('picks a person and clears to No one', () => {
    const { select, onSave } = picker({ value: ME });
    fireEvent.change(select, { target: { value: SAM.id } });
    expect(onSave).toHaveBeenLastCalledWith(SAM);
    fireEvent.change(select, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps a current assignee who is not among the people', () => {
    const casey = { id: 'n-casey', name: 'Casey', color: '#000' };
    const { select } = picker({ value: casey });
    expect(optionLabels(select)).toEqual(['No one', 'Casey', 'Me', 'Sam', '+ Custom Assignee']);
    expect(select.value).toBe('n-casey');
  });

  it('opens the popover from the custom row, keeping the current choice, and adds the named person', () => {
    const { select, onSave } = picker({ value: ME });
    fireEvent.change(select, { target: { value: CUSTOM_ASSIGNEE_OPTION } });
    expect(select.value).toBe(ME.id);
    const dialog = screen.getByRole('dialog', { name: 'Custom Assignee' });
    const add = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.maxLength).toBe(60);
    fireEvent.change(name, { target: { value: '  Casey Jones ' } });
    expect(add.disabled).toBe(false);
    fireEvent.submit(dialog.querySelector('form')!);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({ id: 'n-casey-jones', name: 'Casey Jones' });
    expect(track).toHaveBeenCalledWith('Plan', 'Added', 'CustomAssignee');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reuses a person already in the picker, case aside', () => {
    const { select, onSave } = picker();
    fireEvent.change(select, { target: { value: CUSTOM_ASSIGNEE_OPTION } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSave).toHaveBeenLastCalledWith(SAM);
  });

  it('adds nothing for a blank name, and Cancel closes it unsaved', () => {
    const { select, onSave } = picker();
    fireEvent.change(select, { target: { value: CUSTOM_ASSIGNEE_OPTION } });
    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(select);
  });

  // docs/specs/013-workspace/share-roles.md: assigning is editing a card's fields, a Participant's as an Editor's.
  it.each([
    ['edit', true],
    ['participate', true],
    ['view', false],
  ] as const)('offers a %s session the custom row: %s', (level, offered) => {
    const can = resolveEditorCapabilities({ level, adderKey: null });
    const { select } = picker({ disabled: !can.planCards });
    expect(select.disabled).toBe(!offered);
    expect(optionLabels(select).includes('+ Custom Assignee')).toBe(offered);
  });
});
