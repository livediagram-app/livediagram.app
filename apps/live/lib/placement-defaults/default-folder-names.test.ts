import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { buildDefaultFolderIndex } from './default-destination';
import { rememberDefaultFolders, rememberedDefaultFolder } from './default-folder-names';

// The names Settings can still show for a deleted default folder (blueprint D113).

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const withFolder = buildDefaultFolderIndex(
  [{ id: 'w', name: 'Workshops', parentId: null }],
  {},
  [],
);
const without = buildDefaultFolderIndex([], {}, []);
const defaults = new Map<PlacementDefaultKey, string>([['mode:draw', 'w']]);

describe('default folder names', () => {
  it('remembers a visible default folder and keeps it once the folder is gone', () => {
    const store = memoryStore();
    rememberDefaultFolders('owner', defaults, withFolder, store);
    rememberDefaultFolders('owner', defaults, without, store);
    expect(rememberedDefaultFolder('owner', 'w', store)).toEqual({
      name: 'Workshops',
      teamId: null,
    });
  });

  it('forgets a folder that is no longer a default', () => {
    const store = memoryStore();
    rememberDefaultFolders('owner', defaults, withFolder, store);
    rememberDefaultFolders('owner', new Map(), withFolder, store);
    expect(rememberedDefaultFolder('owner', 'w', store)).toBeNull();
  });

  it('keeps each owner’s memory apart', () => {
    const store = memoryStore();
    rememberDefaultFolders('owner', defaults, withFolder, store);
    expect(rememberedDefaultFolder('someone-else', 'w', store)).toBeNull();
  });

  it('reads unreadable storage as nothing remembered', () => {
    const store = memoryStore();
    store.setItem('livediagram:v2:default-folder-names:owner', '{not json');
    expect(rememberedDefaultFolder('owner', 'w', store)).toBeNull();
  });
});
