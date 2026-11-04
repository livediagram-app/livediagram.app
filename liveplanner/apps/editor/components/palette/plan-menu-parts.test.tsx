// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { SwimlaneOptions } from './plan-menu-parts';

// docs/specs/026-plan/item-types.md "Edit Field": Built-in fields, "Where the name shows". The swimlane menu names a
// built-in grouping by the name every type it covers agrees on, else the built-in's own.
const TASK = ITEM_TYPES.find((t) => t.id === 'task')!;
const named = (id: string, labels: ItemTypeDef['fieldLabels']): ItemTypeDef => ({
  ...TASK,
  id,
  fields: ['title', 'status', 'assignee', 'priority'],
  ...(labels ? { fieldLabels: labels } : {}),
});

const rows = (types: ItemTypeDef[]) => {
  render(<SwimlaneOptions by="none" field={undefined} types={types} onPick={() => {}} />);
  return screen.getAllByRole('radio').map((o) => o.textContent);
};

describe('the swimlane menu’s names', () => {
  it('reads the types’ agreed name for a built-in grouping', () => {
    expect(rows([named('a', { priority: 'Severity' })])).toContain('Severity');
  });

  it('keeps the built-in’s name when the types differ', () => {
    const list = rows([named('a', { priority: 'Severity' }), named('b', undefined)]);
    expect(list).toContain('Priority');
    expect(list).not.toContain('Severity');
  });
});
