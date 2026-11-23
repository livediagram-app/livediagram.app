// A connected tab's own name (connected-tabs.md "A tab's own name"): the name is the host's label, the target's kept
// beside it as `targetName`; nothing typed (or the target's name) follows the target again; an open's answered name
// goes to `targetName` on a renamed tab and to the name on any other.
import { describe, expect, it } from 'vitest';
import {
  followedConnectedTab,
  hasOwnName,
  renamedConnectedTab,
  targetNameOf,
} from './tab-connection';

const plain = { id: 'c', name: 'Launch plan' };
const renamed = { id: 'c', name: 'Plan', targetName: 'Launch plan' };

describe('hasOwnName and targetNameOf', () => {
  it('reads a non-empty string targetName only', () => {
    expect(hasOwnName(renamed)).toBe(true);
    expect(hasOwnName(plain)).toBe(false);
    expect(hasOwnName({ name: 'x', targetName: '' })).toBe(false);
    expect(hasOwnName({ name: 'x', targetName: 7 })).toBe(false);
    expect(targetNameOf(renamed)).toBe('Launch plan');
    expect(targetNameOf(plain)).toBe('Launch plan');
    expect(targetNameOf({ name: 'x', targetName: 7 } as { name: string })).toBe('x');
  });
});

describe('renamedConnectedTab', () => {
  it('gives a following tab a name of its own, keeping the target’s beside it', () => {
    expect(renamedConnectedTab(plain, 'Plan')).toEqual(renamed);
  });

  it('renames a renamed tab again, the target’s name kept', () => {
    expect(renamedConnectedTab(renamed, 'Roadmap')).toEqual({
      id: 'c',
      name: 'Roadmap',
      targetName: 'Launch plan',
    });
  });

  it('follows the target again when renamed to nothing or to the target’s name', () => {
    expect(renamedConnectedTab(renamed, '')).toEqual(plain);
    expect(renamedConnectedTab(renamed, 'Launch plan')).toEqual(plain);
  });

  it('changes nothing when nothing changes', () => {
    expect(renamedConnectedTab(plain, '')).toBe(plain);
    expect(renamedConnectedTab(plain, 'Launch plan')).toBe(plain);
    expect(renamedConnectedTab(renamed, 'Plan')).toBe(renamed);
  });
});

describe('followedConnectedTab', () => {
  it('renames a following tab to the answered name', () => {
    expect(followedConnectedTab(plain, 'Launch plan v2')).toEqual({
      id: 'c',
      name: 'Launch plan v2',
    });
    expect(followedConnectedTab(plain, 'Launch plan')).toBe(plain);
  });

  it('keeps a renamed tab’s own name and holds the answered name beside it', () => {
    expect(followedConnectedTab(renamed, 'Launch plan v2')).toEqual({
      id: 'c',
      name: 'Plan',
      targetName: 'Launch plan v2',
    });
    expect(followedConnectedTab(renamed, 'Launch plan')).toBe(renamed);
  });

  it('follows again once the target takes the tab’s own name', () => {
    expect(followedConnectedTab(renamed, 'Plan')).toEqual({ id: 'c', name: 'Plan' });
  });
});
