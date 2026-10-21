import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { ITEM_TYPE_LABEL_MAX } from './type-catalogue';
import { duplicateItemType, duplicateLabel } from './type-duplicate';

// docs/specs/026-plan/item-types.md "The Card Types panel": Duplicate.
describe('duplicating a card type', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;

  it('copies everything but the name and id, which are fresh', () => {
    const copy = duplicateItemType(
      { ...task, tabs: [{ id: 't-a', label: 'A', fields: ['description'] }], detailsLabel: 'Info' },
      ITEM_TYPES,
    );
    expect(copy.label).toBe('Task copy');
    expect(copy.id).toBe('task-copy');
    expect(copy.newTitle).toBe('New task copy');
    expect(copy.color).toBe(task.color);
    expect(copy.glyph).toBe(task.glyph);
    expect(copy.fields).toEqual(task.fields);
    expect(copy.fields).not.toBe(task.fields);
    expect(copy.tabs).toEqual([{ id: 't-a', label: 'A', fields: ['description'] }]);
    expect(copy.detailsLabel).toBe('Info');
  });

  it('copies custom fields as their own objects', () => {
    const custom = [{ id: 'c-size', label: 'Size', kind: 'text' as const }];
    const copy = duplicateItemType({ ...task, custom }, ITEM_TYPES);
    expect(copy.custom).toEqual(custom);
    expect(copy.custom![0]).not.toBe(custom[0]);
  });

  it('counts up while a copy name is taken, ignoring case', () => {
    expect(duplicateLabel('Task', [{ label: 'Task' }, { label: 'task COPY' }])).toBe('Task copy 2');
    expect(duplicateLabel('Task', [{ label: 'Task copy' }, { label: 'Task copy 2' }])).toBe(
      'Task copy 3',
    );
  });

  it('shortens a long name so the copy fits', () => {
    const long = 'x'.repeat(ITEM_TYPE_LABEL_MAX);
    const name = duplicateLabel(long, [{ label: long }]);
    expect(name.length).toBeLessThanOrEqual(ITEM_TYPE_LABEL_MAX);
    expect(name.endsWith(' copy')).toBe(true);
  });
});
