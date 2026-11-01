import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeThisBrowserItem } from './this-browser-remove';

describe('removeThisBrowserItem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tombstones the open item before removing it, then leaves for the Explorer', async () => {
    const order: string[] = [];
    const tombstoned = new Set<string>();
    await removeThisBrowserItem('open-1', 'open-1', {
      tombstone: (id) => {
        tombstoned.add(id);
        order.push(`tombstone ${id}`);
      },
      remove: async (id) => {
        order.push(`remove ${id} tombstoned=${tombstoned.has(id)}`);
      },
      leave: (href) => {
        order.push(`leave ${href}`);
      },
    });
    expect(order).toEqual(['tombstone open-1', 'remove open-1 tombstoned=true', 'leave /explorer']);
  });

  it('removes another item and stays put', async () => {
    const remove = vi.fn(async () => {});
    const tombstone = vi.fn();
    const leave = vi.fn();
    await removeThisBrowserItem('other-2', 'open-1', { remove, tombstone, leave });
    expect(remove).toHaveBeenCalledWith('other-2');
    expect(tombstone).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('stays put when no item is open', async () => {
    const remove = vi.fn(async () => {});
    const tombstone = vi.fn();
    await removeThisBrowserItem('other-2', null, { remove, tombstone });
    expect(remove).toHaveBeenCalledWith('other-2');
    expect(tombstone).not.toHaveBeenCalled();
  });

  it('leaves with a full page load by default', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    await removeThisBrowserItem('open-1', 'open-1', {
      remove: async () => {},
      tombstone: () => {},
    });
    expect(assign).toHaveBeenCalledWith('/explorer');
  });

  it('does not leave when the remove fails', async () => {
    const leave = vi.fn();
    await expect(
      removeThisBrowserItem('open-1', 'open-1', {
        remove: async () => {
          throw new Error('quota');
        },
        tombstone: () => {},
        leave,
      }),
    ).rejects.toThrow('quota');
    expect(leave).not.toHaveBeenCalled();
  });
});
