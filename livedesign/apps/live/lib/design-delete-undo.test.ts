// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ deleteItem: vi.fn() }));
vi.mock('@/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { handOffDeleteUndo, takeDeleteUndo, trashOpenDesign } = await import('./design-delete-undo');
const { isDesignDeleted } = await import('./design-tombstones');

afterEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('trashOpenDesign', () => {
  it('tombstones the design before the delete, so autosave cannot write it back, then leaves with the Undo', async () => {
    const seen: boolean[] = [];
    index.deleteItem.mockImplementation(async () => void seen.push(isDesignDeleted('a')));
    const leave = vi.fn();
    expect(await trashOpenDesign('a', 'Roadmap', leave)).toBe(true);
    expect(seen).toEqual([true]);
    // To the Explorer on liveworkspace.app, the design in the address for its Undo.
    expect(leave).toHaveBeenCalledWith(
      expect.stringMatching(/\/explorer\?trashed=a&title=Roadmap&from=livedesign$/),
    );
    expect(takeDeleteUndo()).toEqual({ id: 'a', title: 'Roadmap' });
  });

  it('lifts the tombstone and stays when the index refuses', async () => {
    index.deleteItem.mockRejectedValue(new Error('no'));
    const leave = vi.fn();
    expect(await trashOpenDesign('b', 'Roadmap', leave)).toBe(false);
    expect(isDesignDeleted('b')).toBe(false);
    expect(leave).not.toHaveBeenCalled();
    expect(takeDeleteUndo()).toBeNull();
  });
});

describe('the Undo handoff', () => {
  it('is taken once', () => {
    handOffDeleteUndo('c', null);
    expect(takeDeleteUndo()).toEqual({ id: 'c', title: null });
    expect(takeDeleteUndo()).toBeNull();
  });

  it('offers nothing once stale', () => {
    handOffDeleteUndo('d', 'Old', 1_000);
    expect(takeDeleteUndo(1_000 + 31_000)).toBeNull();
  });
});
