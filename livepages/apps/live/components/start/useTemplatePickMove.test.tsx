// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handTemplatePick, readTemplatePick } from '@/lib/placement-defaults/template-pick-handoff';
import { useTemplatePickMove } from './useTemplatePickMove';

const info = vi.fn();
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ info, error: vi.fn(), success: vi.fn() }),
}));
const move = vi.fn(async () => 'Moved to Boards, your default folder for Kanban boards.');
vi.mock('@/lib/placement-defaults/move-on-template-pick', () => ({ moveOnTemplatePick: move }));

// docs/specs/013-workspace/default-folders.md "A template picked after creation"
afterEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

const base = { ownerId: 'o', documentId: 'd', tabId: 't', signedIn: false, tabHasContent: false };

describe('useTemplatePickMove', () => {
  it('moves at the first pick on the document /new made, and says where', async () => {
    handTemplatePick({ documentId: 'd', tabId: 't', placementChosen: false });
    const { result } = renderHook(() => useTemplatePickMove(base));
    result.current('kanban');
    expect(readTemplatePick()).toBeNull();
    await vi.waitFor(() =>
      expect(info).toHaveBeenCalledWith(expect.stringMatching(/^Moved to Boards/)),
    );
    expect(move).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'd', kind: 'kanban' }));
    result.current('kanban');
    expect(move).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a handoff, or for a folder the person chose', () => {
    const { result } = renderHook(() => useTemplatePickMove(base));
    result.current('kanban');
    handTemplatePick({ documentId: 'd', tabId: 't', placementChosen: true });
    result.current('kanban');
    expect(move).not.toHaveBeenCalled();
  });

  it('drops the handoff once the tab has content drawn some other way', () => {
    handTemplatePick({ documentId: 'd', tabId: 't', placementChosen: false });
    renderHook(() => useTemplatePickMove({ ...base, tabHasContent: true }));
    expect(readTemplatePick()).toBeNull();
  });
});
