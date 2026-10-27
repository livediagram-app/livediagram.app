// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ItemPerson } from '@liveplanner/items';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { track } from '@/lib/telemetry';
import { PersonPicker } from './PersonPicker';
import { ACCOUNT_MARK_LABEL } from './AccountMark';

// The Assignee picker (docs/specs/026-plan/items.md "Custom assignees", "Accounts are marked").
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockReset();
});

const ME: ItemPerson = { id: 'abc123abc123abc123abc123', name: 'Me', color: '#2563eb' };
const SAM: ItemPerson = { id: 'def456def456def456def456', name: 'Sam', color: '#16a34a' };
const CASEY: ItemPerson = { id: 'n-casey', name: 'Casey', color: '#000' };
const MAYA: ItemPerson = { id: 'example-maya', name: 'Maya', color: '#7c3aed' };

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
  return { onSave, field: screen.getByRole<HTMLButtonElement>('button', { name: /^Assignee:/ }) };
};

const openList = (field: HTMLElement) => {
  fireEvent.click(field);
  return screen.getByRole('listbox', { name: 'Assignee' });
};
const rowLabels = (list: HTMLElement) =>
  within(list)
    .getAllByRole('option')
    .map((o) => o.textContent);
// A row by its name; a marked row's name then says the mark ("Sam, liveworkspace account").
const row = (list: HTMLElement, name: string) =>
  within(list)
    .getAllByRole('option')
    .find((o) => o.textContent === name)!;

describe('PersonPicker', () => {
  it('names the current assignee, and No one without one', () => {
    expect(picker({ value: SAM }).field.textContent).toBe('Sam');
    cleanup();
    expect(picker().field.getAttribute('aria-label')).toBe('Assignee: No one');
  });

  it('ends with + Custom Assignee, after No one and the people', () => {
    const list = openList(picker().field);
    expect(rowLabels(list)).toEqual(['No one', 'Me', 'Sam', '+ Custom Assignee']);
  });

  it('picks a person and clears to No one', () => {
    const { field, onSave } = picker({ value: ME });
    fireEvent.click(row(openList(field), 'Sam'));
    expect(onSave).toHaveBeenLastCalledWith(SAM);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(row(openList(field), 'No one'));
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('saves nothing when the current choice is picked again', () => {
    const { field, onSave } = picker({ value: ME });
    const list = openList(field);
    expect(row(list, 'Me').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row(list, 'Me'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('works from the keyboard: arrows open and move, Enter picks, Escape closes', () => {
    const { field, onSave } = picker({ value: ME });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    expect(document.activeElement).toBe(list);
    // Opened on the current choice (Me), one down is Sam.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSave).toHaveBeenLastCalledWith(SAM);
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    const again = screen.getByRole('listbox');
    fireEvent.keyDown(again, { key: 'ArrowUp' });
    fireEvent.keyDown(again, { key: 'ArrowUp' });
    fireEvent.keyDown(again, { key: ' ' });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
    fireEvent.click(field);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(field);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on a press outside, and a second press on the field closes it', () => {
    const { field } = picker();
    openList(field);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    openList(field);
    fireEvent.click(field);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps a current assignee who is not among the people', () => {
    const { field } = picker({ value: CASEY });
    expect(field.textContent).toBe('Casey');
    expect(rowLabels(openList(field))).toEqual([
      'No one',
      'Casey',
      'Me',
      'Sam',
      '+ Custom Assignee',
    ]);
  });

  it("marks real people's accounts left of their name in the list only, never a custom assignee", () => {
    const { field } = picker({ value: SAM, people: [ME, SAM, CASEY, MAYA] });
    // The closed field shows no mark.
    expect(within(field).queryByRole('img')).toBeNull();
    const list = openList(field);
    for (const name of ['Me', 'Sam']) {
      const mark = within(row(list, name)).getByRole('img', { name: ACCOUNT_MARK_LABEL });
      // Left of the name: the row's first child.
      expect(row(list, name).firstElementChild?.contains(mark)).toBe(true);
      expect(mark.querySelector('svg')).not.toBeNull();
    }
    expect(row(list, 'Sam').getAttribute('aria-label')).toBe(`Sam, ${ACCOUNT_MARK_LABEL}`);
    expect(within(row(list, 'Casey')).queryByRole('img')).toBeNull();
    expect(within(row(list, 'Maya')).queryByRole('img')).toBeNull();
    expect(row(list, 'Casey').getAttribute('aria-label')).toBe('Casey');
    expect(within(row(list, 'No one')).queryByRole('img')).toBeNull();
    expect(within(row(list, '+ Custom Assignee')).queryByRole('img')).toBeNull();
    // No image requests: the mark is inline SVG.
    expect(list.querySelector('img')).toBeNull();
  });

  it('opens the popover from the custom row, keeping the current choice, and adds the named person', () => {
    const { field, onSave } = picker({ value: ME });
    fireEvent.click(row(openList(field), '+ Custom Assignee'));
    expect(field.textContent).toBe('Me');
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
    const { field, onSave } = picker();
    fireEvent.click(row(openList(field), '+ Custom Assignee'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSave).toHaveBeenLastCalledWith(SAM);
  });

  it('adds nothing for a blank name, and Cancel closes it unsaved', () => {
    const { field, onSave } = picker();
    fireEvent.click(row(openList(field), '+ Custom Assignee'));
    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field);
  });

  // docs/specs/013-workspace/share-roles.md: assigning is editing a card's fields, a Participant's as an Editor's.
  it.each([
    ['edit', true],
    ['participate', true],
    ['view', false],
  ] as const)('offers a %s session the picker and its custom row: %s', (level, offered) => {
    const can = resolveEditorCapabilities({ level, adderKey: null });
    const { field } = picker({ disabled: !can.planCards });
    expect(field.disabled).toBe(!offered);
    if (offered) expect(rowLabels(openList(field))).toContain('+ Custom Assignee');
  });
});
