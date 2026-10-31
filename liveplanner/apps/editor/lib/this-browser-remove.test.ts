import { describe, expect, it, vi } from 'vitest';
import { removeThisBrowserPlan } from './this-browser-remove';
import { isProjectDeleted } from './project-tombstones';

describe('removeThisBrowserPlan', () => {
  it('tombstones the open plan before removing it, then leaves for the Explorer', async () => {
    const order: string[] = [];
    const remove = vi.fn(async (id: string) => {
      order.push(`remove ${id} tombstoned=${isProjectDeleted(id)}`);
    });
    const leave = vi.fn((href: string) => {
      order.push(`leave ${href}`);
    });
    await removeThisBrowserPlan('open-1', 'open-1', remove, leave);
    expect(order[0]).toBe('remove open-1 tombstoned=true');
    expect(leave).toHaveBeenCalledTimes(1);
    expect(order[1]).toMatch(/^leave /);
  });

  it('removes another plan and stays put', async () => {
    const remove = vi.fn(async () => {});
    const leave = vi.fn();
    await removeThisBrowserPlan('other-2', 'open-1', remove, leave);
    expect(remove).toHaveBeenCalledWith('other-2');
    expect(isProjectDeleted('other-2')).toBe(false);
    expect(leave).not.toHaveBeenCalled();
  });
});
