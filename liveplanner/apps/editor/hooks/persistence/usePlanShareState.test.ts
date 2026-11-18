// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ listShareLinks: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));

import { hasLiveLink, usePlanShareState } from './usePlanShareState';

type Props = { open: boolean; code: string | null; confined?: boolean };

function hook(initial: Props) {
  const setShareable = vi.fn();
  const view = renderHook(
    ({ open, code, confined = false }: Props) =>
      usePlanShareState({
        projectId: 'p1',
        serverStored: true,
        sessionShareCode: code,
        shareDialogOpen: open,
        confined,
        setShareable,
      }),
    { initialProps: initial },
  );
  return { ...view, setShareable };
}

beforeEach(() => vi.clearAllMocks());

describe('usePlanShareState', () => {
  it('counts only links that still open the plan', () => {
    expect(hasLiveLink([{ expiresAt: null }], 10)).toBe(true);
    expect(hasLiveLink([{ expiresAt: 5 }], 10)).toBe(false);
    expect(hasLiveLink([], 10)).toBe(false);
  });

  it('asks the index once open, and again when the Share dialog closes', async () => {
    index.listShareLinks.mockResolvedValueOnce({ links: [], passwordSet: false });
    const { rerender, setShareable } = hook({ open: false, code: null });
    await waitFor(() => expect(setShareable).toHaveBeenLastCalledWith(false));
    rerender({ open: true, code: null });
    expect(index.listShareLinks).toHaveBeenCalledTimes(1);
    index.listShareLinks.mockResolvedValueOnce({
      links: [{ expiresAt: null }],
      passwordSet: false,
    });
    rerender({ open: false, code: null });
    await waitFor(() => expect(setShareable).toHaveBeenLastCalledWith(true));
    expect(index.listShareLinks).toHaveBeenCalledTimes(2);
  });

  it('knows a visitor on a link without asking', () => {
    const { setShareable } = hook({ open: false, code: 'CODE2345' });
    expect(setShareable).toHaveBeenCalledWith(true);
    expect(index.listShareLinks).not.toHaveBeenCalled();
  });

  it('keeps what the load said when the index refuses', async () => {
    index.listShareLinks.mockRejectedValueOnce(new Error('forbidden'));
    const { setShareable } = hook({ open: false, code: null });
    await waitFor(() => expect(index.listShareLinks).toHaveBeenCalled());
    expect(setShareable).not.toHaveBeenCalled();
  });

  // Work Tracker 1138: a workbench frame (a live embed's) presents a session the index refuses with a 401.
  it('asks a workbench frame’s index nothing', () => {
    const { setShareable } = hook({ open: false, code: null, confined: true });
    expect(index.listShareLinks).not.toHaveBeenCalled();
    expect(setShareable).not.toHaveBeenCalled();
  });
});
