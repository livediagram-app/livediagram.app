import { describe, expect, it } from 'vitest';
import { isRepairClearable, REPAIR_KEPT_KEYS } from './kept-keys';
import { repairBrowserStorage } from './repair';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

const blocked = (): Storage => {
  throw new DOMException('denied', 'SecurityError');
};

describe('isRepairClearable', () => {
  it('clears livediagram settings and caches', () => {
    for (const k of [
      'livediagram:user-preferences:v2',
      'livediagram:recent-diagrams:v1',
      'livediagram:share-password:abc',
      'livediagram:v2:ui-mode',
      'livediagram:stale-chunk-reloads',
      'livediagram-build',
    ]) {
      expect(isRepairClearable(k), k).toBe(true);
    }
  });

  it('keeps identity, per-browser keys and Drive state', () => {
    for (const k of [
      ...REPAIR_KEPT_KEYS,
      'livediagram:v2:drive-state',
      'livediagram:v2:drive-seen:user_a',
      'livediagram:drive-mirror',
    ]) {
      expect(isRepairClearable(k), k).toBe(false);
    }
  });

  it('never touches keys outside its scope, such as the sign-in provider', () => {
    expect(isRepairClearable('__clerk_environment')).toBe(false);
    expect(isRepairClearable('theme')).toBe(false);
  });
});

describe('repairBrowserStorage', () => {
  it('removes clearable keys from both storages and keeps the rest', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    localStorage.setItem('livediagram:v2:self-id', 'guest');
    localStorage.setItem('livediagram:user-preferences:v2', '{}');
    localStorage.setItem('livediagram:panel-layout:v1', '{}');
    localStorage.setItem('__clerk_x', '1');
    sessionStorage.setItem('livediagram:stale-chunk-reloads', '{}');

    const { cleared } = repairBrowserStorage({ localStorage, sessionStorage });

    expect(cleared.sort()).toEqual([
      'livediagram:panel-layout:v1',
      'livediagram:stale-chunk-reloads',
      'livediagram:user-preferences:v2',
    ]);
    expect(localStorage.getItem('livediagram:v2:self-id')).toBe('guest');
    expect(localStorage.getItem('__clerk_x')).toBe('1');
    expect(sessionStorage.length).toBe(0);
  });

  it('repairs what it can when a storage is blocked', () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem('livediagram:v2:ui-mode', 'x');
    const win = {
      localStorage,
      get sessionStorage() {
        return blocked();
      },
    };
    expect(repairBrowserStorage(win).cleared).toEqual(['livediagram:v2:ui-mode']);
  });

  it('keeps going when one key will not remove', () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem('livediagram:a', '1');
    localStorage.setItem('livediagram:b', '1');
    const remove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = (k: string) => {
      if (k === 'livediagram:a') throw new Error('nope');
      remove(k);
    };
    const { cleared } = repairBrowserStorage({ localStorage, sessionStorage: new MemoryStorage() });
    expect(cleared).toEqual(['livediagram:b']);
  });
});
