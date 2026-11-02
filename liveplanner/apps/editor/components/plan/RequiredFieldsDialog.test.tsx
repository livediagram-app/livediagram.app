// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { useRequiredFieldsGate } from '@/hooks/plan/useRequiredFieldsGate';
import { RequiredFieldsDialog } from './RequiredFieldsDialog';

// docs/specs/026-plan/item-types.md "Required fields": New {Type} asks for what a new card lacks.

const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const epic: Item = {
  id: 'item-epic',
  type: 'epic',
  key: 7,
  rank: 'i',
  fields: { title: 'Checkout' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
};
const epicType: ItemTypeDef = {
  id: 'epic',
  label: 'Epic',
  newTitle: 'New epic',
  glyph: 'project',
  color: '#2563eb',
  fields: ['title', 'status'],
};
const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'f-sev', 'f-area', 'f-epic'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1', 'S2'], required: true },
    { id: 'f-area', label: 'Area', kind: 'text', required: true },
    { id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'epic', required: true },
  ],
};

vi.mock('./PlanContext', () => ({
  usePlan: () => ({ items: new Map([[epic.id, epic]]), types: [epicType, bug] }),
}));
afterEach(cleanup);

function open(missing = bug.custom!) {
  const onDone = vi.fn();
  render(
    <RequiredFieldsDialog
      request={{ type: bug, fields: { title: 'Crash', priority: 'high' }, missing }}
      onDone={onDone}
    />,
  );
  return onDone;
}

describe('New {Type}', () => {
  it('asks for the title and each missing field, creating only once all are filled', () => {
    const onDone = open();
    expect(screen.getByRole('dialog', { name: 'New Bug' })).toBeTruthy();
    const create = screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(screen.getByText('Fill in Severity, Area, Epic')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Severity/ }));
    fireEvent.click(screen.getByRole('option', { name: 'S2' }));
    const area = screen.getByLabelText(/^Area/);
    fireEvent.change(area, { target: { value: 'Payments' } });
    fireEvent.blur(area);
    fireEvent.click(screen.getByRole('button', { name: /^Epic/ }));
    fireEvent.click(screen.getByRole('option', { name: /Checkout/ }));
    expect(create.disabled).toBe(false);
    // A title is needed too.
    const title = screen.getByLabelText(/^Title/);
    fireEvent.change(title, { target: { value: '  ' } });
    expect(screen.getByText('Add a title')).toBeTruthy();
    fireEvent.change(title, { target: { value: ' Crash on pay ' } });
    fireEvent.click(create);
    expect(onDone).toHaveBeenCalledWith({
      title: 'Crash on pay',
      priority: 'high',
      'f-sev': 'S2',
      'f-area': 'Payments',
      'f-epic': 'item-epic',
    });
  });

  it('marks every field required and makes nothing on Cancel', () => {
    const onDone = open([bug.custom![1]!]);
    expect(screen.getAllByText('required')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it('starts from the type’s new title when the card has none', () => {
    render(
      <RequiredFieldsDialog
        request={{ type: bug, fields: {}, missing: [bug.custom![1]!] }}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>(/^Title/).value).toBe('New bug');
  });
});

describe('useRequiredFieldsGate', () => {
  it('passes a card with nothing missing straight through', () => {
    const { result } = renderHook(() => useRequiredFieldsGate([bug]));
    const fields = { title: 'A', 'f-sev': 'S1', 'f-area': 'x', 'f-epic': 'item-epic' };
    expect(result.current.fill('bug', fields)).toBe(fields);
    expect(result.current.fill('other', { title: 'A' })).toEqual({ title: 'A' });
    expect(result.current.request).toBeNull();
  });

  it('waits for the dialog, and a second ask cancels the first', async () => {
    const { result } = renderHook(() => useRequiredFieldsGate([bug]));
    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.fill('bug', { title: 'A' }) as Promise<unknown>;
    });
    expect(result.current.request?.missing.map((f) => f.id)).toEqual(['f-sev', 'f-area', 'f-epic']);
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      second = result.current.fill('bug', { title: 'B' }) as Promise<unknown>;
    });
    await expect(first).resolves.toBeNull();
    act(() => result.current.settle({ title: 'B', 'f-sev': 'S1' }));
    await expect(second).resolves.toEqual({ title: 'B', 'f-sev': 'S1' });
    expect(result.current.request).toBeNull();
    // Settling with nothing waiting does nothing.
    act(() => result.current.settle(null));
  });
});
