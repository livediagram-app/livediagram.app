// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToastActionSpec } from '../../hooks/ui/useToast';
import { OFFSCREEN_TOAST_KEY, OffscreenContentHint } from './OffscreenContentHint';

// liveworkspace/docs/specs/016-notifications/toasts.md "Timing": Nothing in view is a standing toast with Show All.
const toast = vi.hoisted(() => ({
  action: vi.fn<(spec: ToastActionSpec) => void>(),
  dismissAction: vi.fn<(key: string) => void>(),
}));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));

afterEach(() => {
  cleanup();
  toast.action.mockReset();
  toast.dismissAction.mockReset();
});

describe('OffscreenContentHint', () => {
  it('raises one standing toast whose Show All brings the tab back, and leaves with the hint', () => {
    const fit = vi.fn();
    const { unmount } = render(<OffscreenContentHint onBringBack={fit} />);
    const spec = toast.action.mock.calls.at(-1)![0];
    expect(spec).toMatchObject({
      key: OFFSCREEN_TOAST_KEY,
      message: 'Nothing in view',
      sticky: true,
    });
    expect(spec.actions.map((a) => a.label)).toEqual(['Show All']);
    spec.actions[0]!.onSelect();
    expect(fit).toHaveBeenCalledOnce();
    unmount();
    expect(toast.dismissAction).toHaveBeenCalledWith(OFFSCREEN_TOAST_KEY);
  });

  it('closed, it is not raised again while the hint stays', () => {
    const { rerender } = render(<OffscreenContentHint onBringBack={() => {}} />);
    toast.action.mock.calls.at(-1)![0].onDismiss!();
    toast.action.mockClear();
    rerender(<OffscreenContentHint onBringBack={() => {}} />);
    expect(toast.action).not.toHaveBeenCalled();
  });
});
