import { describe, expect, it, vi } from 'vitest';
import { migrateStoredElements } from './stored-elements';
import type { Element } from './index';

// The shared colour check (@liveworkspace/element-model/unsafe-colours) runs where stored elements enter.
describe('migrateStoredElements', () => {
  it('drops an unsafe colour', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1 };
    const migrated = migrateStoredElements([
      { ...el, strokeColor: 'url(x)' } as unknown as Element,
    ]);
    expect(migrated[0]).not.toHaveProperty('strokeColor');
  });
});
