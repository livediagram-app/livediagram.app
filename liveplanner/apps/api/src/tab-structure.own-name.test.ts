import { describe, expect, it } from 'vitest';
import { structureAgainst } from './room-structure-gate';
import { keepStoredStructure, structureChange, type StructuredTab } from './tab-structure';

// A connected tab's own name (liveworkspace/docs/specs/004-index/connected-tabs.md "A tab's own name"): the file's name
// kept beside it, `targetName`, is part of the tab's name, so a tab-scoped Editor neither writes nor drops it.

const renamed = { name: 'Plan', targetName: 'Launch plan', elements: [] };
const plain = { name: 'Launch plan', elements: [] };

describe("a connected tab's file name under a tab-scoped link", () => {
  it('counts a changed or dropped file name as a rename', () => {
    expect(structureChange(renamed, { ...renamed }, 't1')).toBeNull();
    expect(structureChange(renamed, { ...renamed, targetName: 'Forged' }, 't1')).toBe('name');
    expect(structureChange(renamed, { name: 'Plan', elements: [] }, 't1')).toBe('name');
    expect(structureChange(plain, { ...plain, targetName: 'Forged' }, 't1')).toBe('name');
    expect(structureChange(null, { ...plain, targetName: 'New' }, 't1')).toBeNull();
  });

  it('puts the stored file name back on a save, and writes none the tab lacks', () => {
    const kept = keepStoredStructure({ ...renamed, targetName: 'Forged' }, renamed, 't1');
    expect(kept).toMatchObject({ name: 'Plan', targetName: 'Launch plan' });
    const none = keepStoredStructure({ ...plain, targetName: 'Forged' }, plain, 't1');
    expect(none).toEqual(plain);
  });

  it("refuses a scoped session's whole tab that changes it in the room", () => {
    const tab = (over: Partial<StructuredTab>) => ({
      kind: 'tab',
      tabId: 't1',
      tab: { ...renamed, ...over },
    });
    expect(structureAgainst(tab({}), renamed, 't1')).toBe(true);
    expect(structureAgainst(tab({ targetName: 'Forged' }), renamed, 't1')).toBe(false);
  });
});
