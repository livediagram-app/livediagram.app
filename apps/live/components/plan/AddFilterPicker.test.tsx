// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddFilterPicker } from './AddFilterPicker';

// docs/specs/026-plan/plan-views.md "Card Search": Add Filter, a field then a value.
afterEach(cleanup);

describe('Add Filter', () => {
  it('picks a field, then a value with its count, and closes', () => {
    const onPick = vi.fn();
    render(
      <AddFilterPicker
        fields={[
          { id: 'status', label: 'State' },
          { id: 'assignee', label: 'Assignee' },
        ]}
        valuesOf={(id) => (id === 'status' ? [{ key: 's:done', label: 'Done', count: 4 }] : [])}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'State' }));
    expect(screen.getByText('State is')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    expect(onPick).toHaveBeenCalledWith('status', 's:done');
    expect(screen.queryByText('State is')).toBeNull();
  });

  it('goes back to the fields, and narrows a long list', () => {
    const fields = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, label: `Field ${i}` }));
    render(<AddFilterPicker fields={fields} valuesOf={() => []} onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    fireEvent.change(screen.getByLabelText('Find a field'), { target: { value: '7' } });
    expect(screen.getAllByRole('button', { name: /^Field/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Field 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to the fields' }));
    expect(screen.getByText('Filter by')).toBeTruthy();
  });
});
