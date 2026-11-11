import { describe, expect, it } from 'vitest';
import { migrateStoredElements } from './stored-elements';
import type { Element } from './index';

describe('migrateStoredElements', () => {
  it('drops a legacy group', () => {
    const elements = [
      {
        id: 'a',
        type: 'shape',
        shape: 'focus-button',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        groupId: 'g',
      },
    ] as unknown as Element[];
    expect(migrateStoredElements(elements)[0]).not.toHaveProperty('groupId');
  });

  it('returns the SAME array when there is nothing to migrate', () => {
    const elements = [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 10, height: 10 }] as Element[];
    expect(migrateStoredElements(elements)).toBe(elements);
  });
});
