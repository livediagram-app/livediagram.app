// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ deleteItem: vi.fn() }));
vi.mock('./index-client', () => ({ indexClient: index }));

const { DELETE_HANDOFF_MAX_AGE_MS, openItemDeleteUndo } = await import('./open-item-delete-undo');

// Each product's docs/specs/013-workspace/trash.md "Deleting", and
// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md: the open item goes to the Trash with no question,
// and the Explorer offers its Undo.

const deleted = new Set<string>();
const make = (handOff?: boolean) => {
  const onDeleted = vi.fn();
  const undo = openItemDeleteUndo({
    key: 'test:deleted',
    markDeleted: (id) => deleted.add(id),
    unmarkDeleted: (id) => deleted.delete(id),
    onDeleted,
    ...(handOff === undefined ? {} : { handOff }),
  });
  return { undo, onDeleted };
};

afterEach(() => {
  vi.clearAllMocks();
  deleted.clear();
  sessionStorage.clear();
});

describe('openItemDeleteUndo', () => {
  it('tombstones the item before the delete, counts it, then leaves for the Explorer with the Undo', async () => {
    const { undo, onDeleted } = make();
    const seen: boolean[] = [];
    index.deleteItem.mockImplementation(async () => void seen.push(deleted.has('a')));
    const leave = vi.fn();
    expect(await undo.trashOpen('a', 'Roadmap', leave)).toBe(true);
    expect(seen).toEqual([true]);
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(leave).toHaveBeenCalledWith('/explorer?trashed=a&title=Roadmap');
    expect(undo.take()).toEqual({ id: 'a', title: 'Roadmap' });
  });

  it('lifts the tombstone and stays when the index refuses', async () => {
    const { undo, onDeleted } = make();
    index.deleteItem.mockRejectedValue(new Error('no'));
    const leave = vi.fn();
    expect(await undo.trashOpen('b', null, leave)).toBe(false);
    expect(deleted.has('b')).toBe(false);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('without a frame Explorer, carries the Undo in the address alone', async () => {
    const { undo } = make(false);
    index.deleteItem.mockResolvedValue(undefined);
    const leave = vi.fn();
    expect(await undo.trashOpen('c d', null, leave)).toBe(true);
    expect(leave).toHaveBeenCalledWith('/explorer?trashed=c+d');
    expect(undo.take()).toBeNull();
  });

  it('hands over once, never a stale one, and survives storage being off', () => {
    const { undo } = make();
    undo.handOff('e', null);
    expect(undo.take()).toEqual({ id: 'e', title: null });
    expect(undo.take()).toBeNull();
    undo.handOff('f', 'Old', 1_000);
    expect(undo.take(1_000 + DELETE_HANDOFF_MAX_AGE_MS + 1)).toBeNull();
    undo.handOff('g', 'Future', 5_000);
    expect(undo.take(4_000)).toBeNull();
    sessionStorage.setItem('test:deleted', '{"id":1}');
    expect(undo.take()).toBeNull();
    sessionStorage.setItem('test:deleted', 'not json');
    expect(undo.take()).toBeNull();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('off');
    });
    expect(() => undo.handOff('h', 'x')).not.toThrow();
    set.mockRestore();
  });

  it('takes the arrival once per page load and keeps the answer', () => {
    const { undo } = make();
    undo.handOff('i', 'Plan');
    expect(undo.arrived()).toEqual({ id: 'i', title: 'Plan' });
    undo.handOff('j', 'Later');
    expect(undo.arrived()).toEqual({ id: 'i', title: 'Plan' });
  });
});
