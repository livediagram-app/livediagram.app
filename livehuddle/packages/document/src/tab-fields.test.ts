import { describe, expect, it } from 'vitest';
import { migrateIncomingTab } from './stored-tab';
import { paintOrder } from './paint-order';
import type { Element, Tab } from './index';

// A tab's raw-read fields settled on the way in. livehuddle drops layers (./retired-layers); the settling here is
// for a tab handed on to a product that still has them.
describe('settleTabFields', () => {
  const base = { id: 't', name: 'T', elements: [] as Element[] };

  it('a malformed tab arriving from outside renders after the migration', () => {
    const el = { id: 'e', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x' };
    for (const layers of ['x', 0.5, [1, 'a', null], [{ id: 'a' }, null]]) {
      const tab = migrateIncomingTab({ ...base, elements: [el], layers }) as Tab;
      expect('layers' in tab).toBe(false);
      expect(() => paintOrder(tab.elements)).not.toThrow();
    }
  });
});
