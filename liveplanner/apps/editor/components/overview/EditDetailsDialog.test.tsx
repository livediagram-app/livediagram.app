// @vitest-environment jsdom

// Edit Details (docs/specs/026-plan/plan-overview.md "Edit Details").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_DESCRIPTION_MAX } from '@liveplanner/api-schema';
import { DESCRIPTION_COUNT_FROM, EditDetailsDialog } from './EditDetailsDialog';

afterEach(cleanup);

function open(over: { name?: string; description?: string } = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <EditDetailsDialog
      name={over.name ?? 'Bug Triage'}
      description={over.description ?? ''}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
}

describe('EditDetailsDialog', () => {
  it('saves the name and description as typed', () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Bugs  ' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Line one\nLine two' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Bugs', description: 'Line one\nLine two' });
  });

  it('caps the description and shows a count once past 400', () => {
    open({ description: 'x'.repeat(DESCRIPTION_COUNT_FROM) });
    const field = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(field.maxLength).toBe(PROJECT_DESCRIPTION_MAX);
    expect(screen.queryByText(/\/ 500/)).toBeNull();
    fireEvent.change(field, { target: { value: 'x'.repeat(DESCRIPTION_COUNT_FROM + 1) } });
    expect(
      screen.getByText(`${DESCRIPTION_COUNT_FROM + 1} / ${PROJECT_DESCRIPTION_MAX}`),
    ).toBeTruthy();
    expect(field.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('cannot save an empty name, by button or by Enter', () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on Enter in the name field', () => {
    const { onSave } = open();
    fireEvent.submit(screen.getByLabelText('Name').closest('form')!);
    expect(onSave).toHaveBeenCalledWith({ name: 'Bug Triage', description: '' });
  });

  it('closes without saving on Cancel', () => {
    const { onSave, onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
