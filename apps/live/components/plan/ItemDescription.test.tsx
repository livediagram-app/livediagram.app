// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Item } from '@livediagram/items';
import { ItemDescription, descriptionPatch, descriptionRuns } from './ItemDescription';

// docs/specs/026-plan/plan-board.md "Working on a board": the description reads until clicked.
afterEach(cleanup);

const item = (fields: Item['fields']) =>
  ({ id: 'item0001', key: 1, type: 'task', fields }) as unknown as Item;

describe('ItemDescription', () => {
  it('invites a description when there is none', () => {
    render(<ItemDescription item={item({})} canEdit onPatch={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add a description/ }));
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('reads as text with an Edit button, never a button around the text', () => {
    render(
      <ItemDescription item={item({ description: 'Fewer fields' })} canEdit onPatch={() => {}} />,
    );
    const text = screen.getByText('Fewer fields');
    expect(text.closest('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit the description' }));
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('is plain text to someone who may only view', () => {
    render(<ItemDescription item={item({})} canEdit={false} onPatch={vi.fn()} />);
    expect(screen.getByText('No description')).toBeTruthy();
  });

  it('writes both fields, or clears both', () => {
    const runs = descriptionRuns(item({ description: 'a' }));
    expect(descriptionPatch('a', runs).set?.description).toBe('a');
    expect(descriptionPatch('  ', [])).toEqual({ clear: ['description', 'descriptionRich'] });
  });
});
