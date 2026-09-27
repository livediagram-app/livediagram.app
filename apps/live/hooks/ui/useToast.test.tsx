// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ToastProvider, useToast, type ToastOffer } from './useToast';

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
