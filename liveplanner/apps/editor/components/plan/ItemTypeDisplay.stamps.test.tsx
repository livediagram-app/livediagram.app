// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, dayLabel, stampDay } from '@liveplanner/items';
import { ItemTypeDisplay } from './ItemTypeDisplay';

// docs/specs/026-plan/item-types.md "Card display": Age and the card's stamps are listed apart in Available Fields,
// under Filled In Automatically, and the example card reads placed stamps as a real card's.
afterEach(cleanup);

const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const tray = () => screen.getByRole('region', { name: 'Available Fields' });
const chipNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button')
    .map((b) => b.textContent);

describe('Filled In Automatically', () => {
  it('lists Age and the four stamps under their own heading, after the fields a person fills in', () => {
    render(
      <ItemTypeDisplay type={task} display={{ detailed: { head: ['key'] } }} onChange={vi.fn()} />,
    );
    const lists = within(tray()).getAllByRole('list');
    expect(lists).toHaveLength(2);
    expect(within(tray()).getByText('Filled In Automatically')).toBeTruthy();
    expect(chipNames(lists[0]!)).toContain('Due Date');
    expect(chipNames(lists[0]!)).not.toContain('Age');
    expect(chipNames(lists[1]!)).toEqual([
      'Age',
      'Created At',
      'Created By',
      'Last Edited At',
      'Last Edited By',
    ]);
  });

  it('shows only that group once every other field is on the card (a default Display)', () => {
    render(<ItemTypeDisplay type={task} display={{}} onChange={vi.fn()} />);
    const lists = within(tray()).getAllByRole('list');
    expect(lists).toHaveLength(1);
    expect(chipNames(lists[0]!)).toEqual([
      'Age',
      'Created At',
      'Created By',
      'Last Edited At',
      'Last Edited By',
    ]);
  });

  it('draws placed stamps on the example card', () => {
    render(
      <ItemTypeDisplay
        type={task}
        display={{ detailed: { foot: ['createdAt', 'updatedAt', 'createdBy'] } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(`Edited ${dayLabel(stampDay(Date.now()))}`)).toBeTruthy();
    expect(
      screen.getByText(`Created ${dayLabel(stampDay(Date.now() - 2 * 86_400_000))}`),
    ).toBeTruthy();
    expect(screen.getByLabelText('Created by Sam Rivera')).toBeTruthy();
  });
});
