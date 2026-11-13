import { describe, expect, it, vi } from 'vitest';
import { createUseSelectTab } from './useSelectTab';

describe('createUseSelectTab', () => {
  it('switches the tab and drops every per-tab selection', () => {
    const ctx = {
      setActiveId: vi.fn(),
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      setEditingId: vi.fn(),
      setFormatSourceId: vi.fn(),
    };
    createUseSelectTab(() => ctx)()('t2');
    expect(ctx.setActiveId).toHaveBeenCalledWith('t2');
    expect(ctx.setSelectedId).toHaveBeenCalledWith(null);
    expect(ctx.setMultiSelectedIds).toHaveBeenCalledWith(new Set());
    expect(ctx.setEditingId).toHaveBeenCalledWith(null);
    expect(ctx.setFormatSourceId).toHaveBeenCalledWith(null);
  });
});
