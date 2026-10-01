import { afterEach, describe, expect, it, vi } from 'vitest';

// Preferences cached in a browser before the document rename carry `notifyDiagramJoin`
// (docs/specs/007-editor/user-preferences.md); an opt-out must survive the rename.
vi.mock('./api-client', () => ({ apiGetPreferences: vi.fn(), apiPutPreferences: vi.fn() }));

import { apiGetPreferences } from './api-client';
import { STORAGE_KEY, fetchUserPreferences, readUserPreferences } from './user-preferences';

function browserWith(value: string) {
  const store = new Map<string, string>([[STORAGE_KEY, value]]);
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal('window', { localStorage, dispatchEvent: () => true });
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal(
    'Event',
    class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  );
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('user preferences written before the document rename', () => {
  it('reads an opt-out cached under the old key', () => {
    browserWith(JSON.stringify({ notifyDiagramJoin: false }));
    expect(readUserPreferences().notifyDocumentJoin).toBe(false);
  });

  it('upgrades the old key in a server copy before merging', async () => {
    browserWith(JSON.stringify({}));
    vi.mocked(apiGetPreferences).mockResolvedValue({ notifyDiagramJoin: false });
    const merged = await fetchUserPreferences('owner');
    expect(merged?.notifyDocumentJoin).toBe(false);
    expect(merged && 'notifyDiagramJoin' in merged).toBe(false);
  });
});
