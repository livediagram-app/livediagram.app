// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ copyItem: vi.fn(), deleteItem: vi.fn() }));
vi.mock('@/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { useProjectActions } = await import('./useProjectActions');

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

  it('sends the open plan to the Trash and goes there', async () => {
    index.deleteItem.mockResolvedValue(undefined);
    await actions().deleteProject('p1');
    expect(index.deleteItem).toHaveBeenCalledWith('p1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/explorer/trash');
  });

  it('deletes nothing the person did not confirm', async () => {
    await actions({ confirm: vi.fn(async () => false) }).deleteProject('p1');
    expect(index.deleteItem).not.toHaveBeenCalled();
  });

  it('opens a plan, through its link when it has one', () => {
    actions().openProject('p9', 's 1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/project/p9?s=s%201');
  });
});
