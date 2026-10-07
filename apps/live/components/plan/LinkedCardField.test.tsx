// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item } from '@livediagram/items';
import { LINK_FILTER_FROM, LinkedCardField } from './LinkedCardField';

// docs/specs/026-plan/item-types.md "Card fields": Parent and every Card field use one control.
afterEach(cleanup);

const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (id: string, key: number, title: string, fields: Item['fields'] = {}): Item => ({
  id,
  type: 'project',
  key,
  rank: 'i',
  fields: { title, ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

function field(value: unknown, candidates: Item[], extra: Partial<{ disabled: boolean }> = {}) {
  const onSave = vi.fn();
  const onOpen = vi.fn();
  const items = new Map(candidates.map((c) => [c.id, c]));
  render(
    <LinkedCardField
      id="f"
      label="Parent"
      value={value}
      candidates={candidates}
      items={items}
      types={ITEM_TYPES}
      disabled={extra.disabled ?? false}
      onSave={onSave}
      onOpen={onOpen}
    />,
  );
  return { onSave, onOpen };
}

describe('LinkedCardField', () => {
  it('reads as one field: the linked card’s number and full title, and opens it from its end', () => {
    const launch = card('a', 1, 'Launch the new pricing page', { color: '#ea580c' });
    const { onOpen } = field('a', [launch]);
    const trigger = screen.getByRole('button', { name: 'Parent: #1 Launch the new pricing page' });
    expect(trigger.textContent).toContain('Launch the new pricing page');
    expect(screen.getByRole('img', { name: 'Orange colour' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open #1 Launch the new pricing page' }));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('says None, or Missing card for a link whose card is gone', () => {
    field(undefined, []);
    expect(screen.getByRole('button', { name: 'Parent: None' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
    cleanup();
    field('gone', []);
    expect(screen.getByRole('button', { name: 'Parent: Missing card' })).toBeTruthy();
  });

  it('opens a list from the keyboard, moves with the arrows, picks with Enter', () => {
    const a = card('a', 1, 'Alpha');
    const b = card('b', 2, 'Beta');
    const { onSave } = field(undefined, [a, b]);
    const trigger = screen.getByRole('button', { name: 'Parent: None' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const list = screen.getByRole('listbox', { name: 'Parent' });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'None',
      '#1Alpha',
      '#2Beta',
    ]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears the link with None, and closes on Escape without saving', () => {
    const a = card('a', 1, 'Alpha');
    const { onSave } = field('a', [a]);
    fireEvent.click(screen.getByRole('button', { name: 'Parent: #1 Alpha' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onSave).toHaveBeenCalledWith(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Parent: #1 Alpha' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('filters a long list by number or title', () => {
    const many = Array.from({ length: LINK_FILTER_FROM + 2 }, (_, i) =>
      card(`c${i}`, i + 1, i === 3 ? 'Hiring plan' : `Card ${i + 1}`),
    );
    const { onSave } = field(undefined, many);
    fireEvent.click(screen.getByRole('button', { name: 'Parent: None' }));
    const filter = screen.getByRole('textbox', { name: 'Find a card for Parent' });
    fireEvent.change(filter, { target: { value: 'hiring' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'None',
      '#4Hiring plan',
    ]);
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    fireEvent.keyDown(filter, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('c3');
  });
});
