// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ copyItem: vi.fn(), deleteItem: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { useDesignActions } = await import('./useDesignActions');
const { isDesignDeleted } = await import('@/lib/design-tombstones');
const { takeDeleteUndo } = await import('@/lib/design-delete-undo');

const assign = vi.fn();

function actions(over: Partial<Parameters<typeof useDesignActions>[0]> = {}) {
  return renderHook(() =>
    useDesignActions({
      designId: 'p1',
      designName: 'Roadmap',
      confirm: vi.fn(async () => true),
      copying: false,
      setCopying: vi.fn(),
      sessionShareCode: null,
      ...over,
    }),
  ).result.current;
}

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'http://localhost:3402', assign },
  });
});
afterEach(() => vi.clearAllMocks());

// Copy and delete are the index's (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items"): the index makes the copy's
// row and has this app copy the content; a delete sends the design to the Trash.
describe('useDesignActions', () => {
  it('copies through the link a visitor came in on, then opens the copy', async () => {
    index.copyItem.mockResolvedValue({ item: { id: 'p2' } });
    await actions({ sessionShareCode: 'code1' }).makeCopy();
    expect(index.copyItem).toHaveBeenCalledWith('p1', {}, { code: 'code1', password: null });
    expect(assign).toHaveBeenCalledWith('http://localhost:3402/design/p2');
  });

  it('lets the person try a refused copy again', async () => {
    index.copyItem.mockRejectedValue(new Error('no'));
    const setCopying = vi.fn();
    await actions({ setCopying }).makeCopy();
    expect(setCopying).toHaveBeenLastCalledWith(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('stops saving the open design before it goes to the Trash, then hands its Undo to the Explorer', async () => {
    let tombstonedAtDelete = false;
    index.deleteItem.mockImplementation(async () => {
      tombstonedAtDelete = isDesignDeleted('p1');
    });
    await actions().deleteDesign('p1');
    expect(tombstonedAtDelete).toBe(true);
    expect(isDesignDeleted('p1')).toBe(true);
    // To the Explorer, the design in the address for its Undo.
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^\/explorer\?trashed=p1/));
    expect(takeDeleteUndo()).toEqual({ id: 'p1', title: 'Roadmap' });
  });

  it('lets a refused delete save again and stay open', async () => {
    index.deleteItem.mockRejectedValue(new Error('no'));
    await actions({ designId: 'p3' }).deleteDesign('p3');
    expect(isDesignDeleted('p3')).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('opens a design, through its link when it has one', () => {
    actions().openDesign('p9', 's 1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3402/design/p9?s=s%201');
  });
});
