import { describe, expect, it } from 'vitest';
import { localSeenStore } from './tombstones';

function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe('localSeenStore', () => {
  it('keeps rows per owner as compact tuples', () => {
    const s = storage();
    const store = localSeenStore(s);
    store.write('user_a', [{ kind: 'diagram', ldId: 'd1', driveFileId: 'f1' }]);
    expect(s.map.get('livediagram:v2:drive-seen:user_a')).toBe('[["diagram","d1","f1"]]');
    expect(store.read('user_a')).toEqual([{ kind: 'diagram', ldId: 'd1', driveFileId: 'f1' }]);
    expect(store.read('user_b')).toEqual([]);
    store.clear('user_a');
    expect(store.read('user_a')).toEqual([]);
  });

  it('reads corrupt or foreign values as nothing', () => {
    const s = storage();
    s.setItem('livediagram:v2:drive-seen:u', '{nope');
    expect(localSeenStore(s).read('u')).toEqual([]);
    s.setItem('livediagram:v2:drive-seen:u', '[["team","x","y"],["folder","f","g"]]');
    expect(localSeenStore(s).read('u')).toEqual([{ kind: 'folder', ldId: 'f', driveFileId: 'g' }]);
  });
});
