// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ copyItem: vi.fn(), deleteItem: vi.fn() }));
vi.mock('@/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { useProjectActions } = await import('./useProjectActions');
const { isProjectDeleted } = await import('@/lib/project-tombstones');
const { takeDeleteUndo } = await import('@/lib/project-delete-undo');

const assign = vi.fn();

function actions(over: Partial<Parameters<typeof useProjectActions>[0]> = {}) {
  return renderHook(() =>
    useProjectActions({
      projectId: 'p1',
      projectName: 'Roadmap',
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
    value: { ...window.location, origin: 'http://localhost:3200', assign },
  });
});
afterEach(() => vi.clearAllMocks());

// Copy and delete are the index's (liveworkspace/docs/one-explorer-contracts.md "Items"): the index makes the copy's
// row and has this app copy the content; a delete sends the plan to the Trash.
describe('useProjectActions', () => {
  it('copies through the link a visitor came in on, then opens the copy', async () => {
    index.copyItem.mockResolvedValue({ item: { id: 'p2' } });
    await actions({ sessionShareCode: 'code1' }).makeCopy();
    expect(index.copyItem).toHaveBeenCalledWith('p1', {}, { code: 'code1', password: null });
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/project/p2');
  });

  it('lets the person try a refused copy again', async () => {
    index.copyItem.mockRejectedValue(new Error('no'));
    const setCopying = vi.fn();
    await actions({ setCopying }).makeCopy();
    expect(setCopying).toHaveBeenLastCalledWith(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('stops saving the open plan before it goes to the Trash, then hands its Undo to the Explorer', async () => {
    let tombstonedAtDelete = false;
    index.deleteItem.mockImplementation(async () => {
      tombstonedAtDelete = isProjectDeleted('p1');
    });
    await actions().deleteProject('p1');
    expect(tombstonedAtDelete).toBe(true);
    expect(isProjectDeleted('p1')).toBe(true);
    expect(assign).toHaveBeenCalledWith('/explorer');
    expect(takeDeleteUndo()).toEqual({ id: 'p1', title: 'Roadmap' });
  });

  it('lets a refused delete save again and stay open', async () => {
    index.deleteItem.mockRejectedValue(new Error('no'));
    await actions({ projectId: 'p3' }).deleteProject('p3');
    expect(isProjectDeleted('p3')).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('opens a plan, through its link when it has one', () => {
    actions().openProject('p9', 's 1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/project/p9?s=s%201');
  });
});
