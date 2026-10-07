// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import { useWorkbenchEnd } from './useWorkbenchEnd';

// A workbench page ends when the editor finds its document trashed (docs/specs/013-workspace/
// blueprints/workbench-embeds.md "The workbench page" step 6).
describe('useWorkbenchEnd', () => {
  it('ends the session once the document is trashed', () => {
    const end = vi.fn();
    const workbench = { end } as unknown as WorkbenchSession;
    const { rerender } = renderHook(({ trashed }) => useWorkbenchEnd(workbench, trashed), {
      initialProps: { trashed: false },
    });
    expect(end).not.toHaveBeenCalled();

    rerender({ trashed: true });

    expect(end).toHaveBeenCalledWith('trashed');
  });

  it('does nothing outside a workbench', () => {
    expect(() => renderHook(() => useWorkbenchEnd(null, true))).not.toThrow();
  });
});
