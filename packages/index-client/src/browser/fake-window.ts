// A window for node tests: the two storages, a location whose assign is recorded, and globals to set.
import { vi, type Mock } from 'vitest';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

export function fakeWindow(
  pathname = '/design/d1',
  search = '?x=1',
): { win: Window & Record<string, unknown>; assign: Mock } {
  const assign = vi.fn();
  const win = {
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    location: { pathname, search, hash: '', assign },
  } as unknown as Window & Record<string, unknown>;
  vi.stubGlobal('window', win);
  return { win, assign };
}
