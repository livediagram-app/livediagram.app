import { describe, expect, it } from 'vitest';
import { migrateStoredElements } from './stored-elements';
import type { Element } from './index';

describe('migrateStoredElements', () => {
  it('drops a legacy group and a legacy dock in one pass', () => {
    const elements = [
      { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, groupId: 'g' },
      { id: 'c', type: 'sticky', x: 0, y: 0, width: 10, height: 10, esDock: { hostId: 'a' } },
    ] as unknown as Element[];
    const out = migrateStoredElements(elements);
    expect(out[0]).not.toHaveProperty('groupId');
    expect(out[1]).not.toHaveProperty('esDock');
  });

  it('returns the SAME array when there is nothing to migrate', () => {
    const elements = [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 10, height: 10 }] as Element[];
    expect(migrateStoredElements(elements)).toBe(elements);
  });
});
