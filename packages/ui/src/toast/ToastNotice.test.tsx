// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastCard } from './ToastCard';
import { ToastNotice } from './ToastNotice';
import { ToastProvider, useToast, type ToastApi } from './ToastProvider';
import { DIALOG_WATCH_MS } from './dialog-open';
import { noticeCount, noticeSlotHeld } from './notice-slot';
import { resetToastHistoryForTests, setToastHistoryScope } from './toast-history';

// liveworkspace/docs/specs/016-notifications/toasts.md "One place for everything that pops up": every notice is drawn
// in the page's one toast stack, above its toasts, and waits under a dialog.

let api: ToastApi;
function Grab() {
  const toast = useToast();
  useEffect(() => {
    api = toast;
  }, [toast]);
  return null;
}

const Suggestion = ({ hold }: { hold?: boolean }) => (
  <ToastNotice hold={hold}>
    <ToastCard
      tone="info"
      data-testid="notice"
      title="Make These a Plan"
      message="3 action stickies here could be cards in a liveplanner plan, one each."
      actions={[
        { label: 'Don’t Suggest This Again', onSelect: () => {}, quiet: true },
        { label: 'Send to Plan', onSelect: () => {}, primary: true },
      ]}
      onClose={() => {}}
    />
  </ToastNotice>
);

beforeEach(() => {
  vi.useFakeTimers();
  setToastHistoryScope(() => 'test');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetToastHistoryForTests();
  localStorage.clear();
});

describe('ToastNotice', () => {
  it('lands in the stack, above its toasts, and holds the notice slot while mounted', () => {
    const { rerender } = render(
      <ToastProvider>
        <Grab />
        <Suggestion />
      </ToastProvider>,
    );
    act(() => api.info('“Roadmap” moved to the Trash'));
    const stack = screen.getByRole('region', { name: 'Notifications' });
    const notice = screen.getByTestId('notice');
    const toast = screen.getByText('“Roadmap” moved to the Trash').closest('[data-toast-tone]')!;
    expect(stack.contains(notice)).toBe(true);
    expect(notice.parentElement!.hasAttribute('data-toast-notices')).toBe(true);
    // Notices above the toasts: the newest toast stays nearest the bottom edge.
    expect(notice.compareDocumentPosition(toast) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(noticeCount()).toBe(1);
    expect(noticeSlotHeld()).toBe(true);
    rerender(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(noticeCount()).toBe(0);
    expect(noticeSlotHeld()).toBe(false);
  });

  it('a suggestion yields: drawn in the stack without holding the slot', () => {
    render(
      <ToastProvider>
        <Suggestion hold={false} />
      </ToastProvider>,
    );
    expect(
      screen.getByRole('region', { name: 'Notifications' }).contains(screen.getByTestId('notice')),
    ).toBe(true);
    expect(noticeSlotHeld()).toBe(false);
  });

  it('waits, undrawn, while a dialog is open; a toast still shows over it', async () => {
    render(
      <ToastProvider>
        <Grab />
        <Suggestion />
      </ToastProvider>,
    );
    act(() => api.error('Couldn’t save the card.'));
    const row = () => document.querySelector('[data-toast-notices]')!;
    expect(row().className).toBe('contents');
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    await act(async () => {
      document.body.appendChild(dialog);
      await Promise.resolve();
      vi.advanceTimersByTime(DIALOG_WATCH_MS);
    });
    expect(row().className).toBe('hidden');
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t save the card.');
    await act(async () => {
      dialog.remove();
      await Promise.resolve();
      vi.advanceTimersByTime(DIALOG_WATCH_MS);
    });
    expect(row().className).toBe('contents');
  });

  it('stands alone at the bottom centre with no stack on the page', () => {
    render(<Suggestion />);
    const alone = screen.getByTestId('notice').parentElement!;
    expect(alone.hasAttribute('data-toast-notice-alone')).toBe(true);
    expect(alone.className).toContain('fixed');
    expect(alone.className).toContain('bottom-4');
  });
});
