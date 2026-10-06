// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { planPalette } from './plan-palette';
import { ItemSlideView } from './ItemSlideView';
import { descriptionPatch } from './ItemDescription';

// docs/specs/012-collaboration/presentation-mode.md "Item slides".
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const item = (fields: Item['fields']): Item =>
  ({
    id: 'it-1',
    type: 'task',
    key: 7,
    rank: 'm',
    fields,
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;
const palette = planPalette('light', {});

afterEach(cleanup);

describe('ItemSlideView', () => {
  it('shows the card full screen: type, key, title, facts, description and checklist', () => {
    render(
      <ItemSlideView
        types={ITEM_TYPES}
        palette={palette}
        item={item({
          title: 'Ship the checkout',
          status: 'in-progress',
          assignee: SAM,
          priority: 'high',
          due: '2026-10-20',
          estimate: 3,
          labels: ['payments'],
          description: 'Carefully',
          descriptionRich: [{ text: 'Carefully', bold: true }],
          checklist: [
            { text: 'Design', done: true },
            { text: 'Build', done: false },
          ],
        })}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ship the checkout');
    expect(screen.getByText('#7')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('High priority')).toBeTruthy();
    expect(screen.getByText('3 points')).toBeTruthy();
    expect(screen.getByText('payments')).toBeTruthy();
    expect(screen.getByText('Carefully')).toBeTruthy();
    expect(screen.getByText(/1 of 2 done/)).toBeTruthy();
  });

  it("names the status as its board's column does", () => {
    render(
      <ItemSlideView
        types={ITEM_TYPES}
        palette={palette}
        statusNames={new Map([['doing~k3f9', 'In progress']])}
        item={item({ title: 'Named', status: 'doing~k3f9' })}
      />,
    );
    expect(screen.getByText('In progress')).toBeTruthy();
  });

  it('leaves out the facts an item has no value in', () => {
    render(<ItemSlideView types={[]} palette={palette} item={item({ title: 'Bare' })} />);
    expect(screen.queryByText(/priority/)).toBeNull();
    expect(screen.queryByText(/Checklist/)).toBeNull();
  });

  it('says so when the item was deleted', () => {
    render(<ItemSlideView types={ITEM_TYPES} palette={palette} item={undefined} />);
    expect(screen.getByText('This card was deleted')).toBeTruthy();
  });
});

describe('descriptionPatch', () => {
  it('writes both fields, or clears both when emptied', () => {
    expect(descriptionPatch('Hi', [{ text: 'Hi' }])).toEqual({
      set: { description: 'Hi', descriptionRich: [{ text: 'Hi' }] },
    });
    expect(descriptionPatch('  ', [])).toEqual({ clear: ['description', 'descriptionRich'] });
  });
});
