// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemTypeStatuses, statusGroups } from './ItemTypeStatuses';

afterEach(cleanup);

// docs/specs/026-plan/item-types.md "Editing a type": States grouped by the boards that show them.
const STATUSES = [
  { status: 'backlog', name: 'Backlog' },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done' },
  { status: 'parked', name: 'Parked' },
];
const BOARDS = [
  { title: 'Sprint', statuses: ['doing', 'done'] },
  { title: 'Roadmap', statuses: ['backlog', 'done'] },
];

describe('statusGroups', () => {
  it('groups by board title, a shared status in each, then No Board', () => {
    expect(
      statusGroups(STATUSES, BOARDS).map((g) => [g.title, g.statuses.map((s) => s.name)]),
    ).toEqual([
      ['Sprint', ['Doing', 'Done']],
      ['Roadmap', ['Backlog', 'Done']],
      ['No Board', ['Parked']],
    ]);
  });

  it('is one untitled group without boards, and leaves out empty boards', () => {
    expect(statusGroups(STATUSES, undefined)).toEqual([{ title: null, statuses: STATUSES }]);
    expect(statusGroups(STATUSES.slice(0, 1), [{ title: 'Other', statuses: ['x'] }])).toEqual([
      { title: 'No Board', statuses: STATUSES.slice(0, 1) },
    ]);
  });
});

describe('the States tab', () => {
  it('heads each board’s states with its title and count; a shared state turns off in both', () => {
    const onChange = vi.fn();
    render(
      <ItemTypeStatuses statuses={STATUSES} excluded={[]} onChange={onChange} boards={BOARDS} />,
    );
    const sprint = screen.getByRole('region', { name: 'Sprint' });
    expect(within(sprint).getByText('2 of 2 on')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'No Board' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: 'Done' })).toHaveLength(2);
    fireEvent.click(within(sprint).getByRole('checkbox', { name: 'Done' }));
    expect(onChange).toHaveBeenCalledWith(['done']);
  });
});
