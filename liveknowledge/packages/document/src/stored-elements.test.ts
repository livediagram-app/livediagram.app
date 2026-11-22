import { describe, expect, it } from 'vitest';
import { migrateStoredElements } from './stored-elements';
import type { Element } from './index';

describe('migrateStoredElements', () => {
  it('returns the SAME array when there is nothing to migrate', () => {
    const elements = [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 10, height: 10 }] as Element[];
    expect(migrateStoredElements(elements)).toBe(elements);
  });
});
