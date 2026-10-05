// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ToastProvider, useToast, type ToastOffer } from './useToast';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';

// The offer toast (docs/specs/007-editor/power-user-mode.md): two actions, and no timeout.

function Offer({ offer }: { offer: ToastOffer }) {
  const toast = useToast();
  useEffect(() => toast.offer(offer), [toast, offer]);
  return null;
}

function renderOffer() {
  const offer: ToastOffer = {
    message: 'Power user mode: fewer labels.',
    confirmLabel: 'Try power user mode',
    declineLabel: 'No thanks',
    onConfirm: vi.fn(),
    onDecline: vi.fn(),
  };
  render(
    <ToastProvider>
      <Offer offer={offer} />
    </ToastProvider>,
  );
  return offer;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('toast.offer', () => {
  it('stays until answered, however long it waits', () => {
    renderOffer();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Power user mode: fewer labels.')).toBeTruthy();
  });

  it('confirms once and goes', () => {
    const offer = renderOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Try power user mode' }));
    expect(offer.onConfirm).toHaveBeenCalledTimes(1);
    expect(offer.onDecline).not.toHaveBeenCalled();
    expect(screen.queryByText('Power user mode: fewer labels.')).toBeNull();
  });

  it('declines from its own button or the close button', () => {
    const offer = renderOffer();
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(offer.onDecline).toHaveBeenCalledTimes(1);
    cleanup();
    const again = renderOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(again.onDecline).toHaveBeenCalledTimes(1);
    expect(again.onConfirm).not.toHaveBeenCalled();
  });
});

// The action toast (docs/specs/024-agents/blueprints/agent-changesets.md "Clients"): an info toast
// with buttons, upserted in place by key, with no timeout (WCAG 2.2.1).
describe('toast.action', () => {
  function Actions({ spec }: { spec: Parameters<ReturnType<typeof useToast>['action']>[0] }) {
    const toast = useToast();
    useEffect(() => toast.action(spec), [toast, spec]);
    return null;
  }
  const spec = (message: string, onSelect = vi.fn()) => ({
    key: 'agent-1',
    message,
    actions: [{ label: 'Undo', ariaLabel: "Undo Webber's changes", onSelect }],
  });

  it('stays until dismissed, however long it waits, and runs its action', () => {
    const onSelect = vi.fn();
    render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 3 elements', onSelect)} />
      </ToastProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('status').textContent).toContain('Webber changed 3 elements');
    fireEvent.click(screen.getByRole('button', { name: "Undo Webber's changes" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('replaces the toast with the same key in place', () => {
    const { rerender } = render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 1 element')} />
      </ToastProvider>,
    );
    rerender(
      <ToastProvider>
        <Actions spec={spec('Webber changed 4 elements')} />
      </ToastProvider>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain('Webber changed 4 elements');
  });

  it('respects the "Show notifications" preference', () => {
    writeUserPreferences({ ...readUserPreferences(), notificationsEnabled: false });
    render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 3 elements')} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
