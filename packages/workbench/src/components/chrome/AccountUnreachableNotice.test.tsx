// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, TOAST_TIMEOUT_MS } from '@liveworkspace/ui/toast';
import { ACCOUNT_UNREACHABLE_COPY, AccountUnreachableNotice } from './AccountUnreachableNotice';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(onRetry?: () => void) {
  return render(
    <ToastProvider>
      <AccountUnreachableNotice onRetry={onRetry} />
    </ToastProvider>,
  );
}

// liveworkspace/docs/specs/003-accounts/accounts.md "The editors": a standing warning toast.
describe('AccountUnreachableNotice', () => {
  it('says what happened as a polite warning toast, and Try Again asks again', () => {
    const onRetry = vi.fn();
    mount(onRetry);
    const status = screen.getByRole('status');
    expect(status.getAttribute('data-toast-tone')).toBe('warning');
    expect(status.textContent).toContain(ACCOUNT_UNREACHABLE_COPY.message);
    fireEvent.click(screen.getByRole('button', { name: ACCOUNT_UNREACHABLE_COPY.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('reloads the page by default', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    try {
      mount();
      fireEvent.click(screen.getByRole('button', { name: ACCOUNT_UNREACHABLE_COPY.retry }));
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stands until the account answers, then leaves by itself; it can be closed', () => {
    vi.useFakeTimers();
    const { rerender } = mount(() => {});
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.warning * 3);
    });
    expect(screen.getByRole('status').textContent).toContain(ACCOUNT_UNREACHABLE_COPY.message);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    rerender(<ToastProvider>{null}</ToastProvider>);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
