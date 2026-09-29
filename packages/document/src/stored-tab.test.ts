import { describe, expect, it, vi } from 'vitest';
import { migrateStoredTab } from './stored-tab';
import type { Element, Tab } from './index';

// Every tab-level migration on the way in, in one call (docs/specs/011-theme/retired-schemes.md): the api's
// tab read, the thumbnail render, the offline store and a file import all run this.
describe('migrateStoredTab', () => {
  it('migrates a retired scheme and retired element fields in one pass', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = {
      id: 't',
      name: 'T',
      theme: 'charcoal',
      backgroundColor: '#2b2b33',
      patternColor: '#636373',
      elements: [
        {
          id: 'a',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fillColor: '#2c2c33',
          groupId: 'g',
        },
      ],
    } as unknown as Tab;
    const out = migrateStoredTab(tab);
    expect(out.theme).toBe('brand');
    expect(out.elements[0]).not.toHaveProperty('fillColor');
    expect(out.elements[0]).not.toHaveProperty('groupId');
  });

  it('returns the same tab when there is nothing to migrate', () => {
    const tab: Tab = {
      id: 't',
      name: 'T',
      elements: [{ id: 'a', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as Element],
    };
    expect(migrateStoredTab(tab)).toBe(tab);
  });
});
