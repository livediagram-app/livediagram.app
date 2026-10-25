// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ToastProvider, useToast, type ToastOffer } from './useToast';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';
import { TOAST_EXIT_HOLD_MS } from '@liveworkspace/workbench/components/toast/ToastStack';
import {
  TOAST_ANSWER_TIMEOUT_MS,
  TOAST_TIMEOUT_MS,
} from '@liveworkspace/workbench/components/toast/toast-queue';

// A toast leaves by playing its exit; jsdom never fires animationend, so the exit hold removes it.
function afterExit() {
  act(() => {
    vi.advanceTimersByTime(TOAST_EXIT_HOLD_MS);
  });
}

// The offer toast (docs/specs/007-editor/power-user-mode.md): two actions, and the longer answer timeout.

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
  it('stays for the answer time, then leaves unanswered', () => {
    const offer = renderOffer();
    act(() => {
      vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS - 1);
    });
    expect(screen.getByText('Power user mode: fewer labels.')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    afterExit();
    expect(screen.queryByText('Power user mode: fewer labels.')).toBeNull();
    expect(offer.onConfirm).not.toHaveBeenCalled();
    expect(offer.onDecline).not.toHaveBeenCalled();
  });

  it('confirms once and goes', () => {
    const offer = renderOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Try power user mode' }));
    expect(offer.onConfirm).toHaveBeenCalledTimes(1);
    expect(offer.onDecline).not.toHaveBeenCalled();
    afterExit();
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

  it('declines on Escape inside it, without the key reaching anything behind', () => {
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    const offer = renderOffer();
    fireEvent.keyDown(screen.getByRole('button', { name: 'No thanks' }), { key: 'Escape' });
    expect(offer.onDecline).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
    document.removeEventListener('keydown', behind);
  });

  it('answers once, however fast the second press comes', () => {
    const offer = renderOffer();
    const confirm = screen.getByRole('button', { name: 'Try power user mode' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(offer.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('lists the decline before the confirm, so the primary answer sits last', () => {
    renderOffer();
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent || b.getAttribute('aria-label'));
    expect(labels).toEqual(['No thanks', 'Try power user mode', 'Dismiss']);
  });
});

// The action toast (docs/specs/024-agents/blueprints/agent-changesets.md "Clients"): an info toast
// with buttons, upserted in place by key, up for the longer answer time.
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

  it('stays for the answer time and runs its action', () => {
    const onSelect = vi.fn();
    render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 3 elements', onSelect)} />
      </ToastProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS - 1);
    });
    expect(screen.getByRole('status').textContent).toContain('Webber changed 3 elements');
    fireEvent.click(screen.getByRole('button', { name: "Undo Webber's changes" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('times out after the answer time, never staying for good', () => {
    render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 3 elements')} />
      </ToastProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS);
    });
    afterExit();
    expect(screen.queryByText('Webber changed 3 elements')).toBeNull();
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

  it('times out once it is replaced with no buttons ("Undone")', () => {
    const { rerender } = render(
      <ToastProvider>
        <Actions spec={spec('Webber changed 1 element')} />
      </ToastProvider>,
    );
    rerender(
      <ToastProvider>
        <Actions spec={{ key: 'agent-1', message: 'Undone', actions: [] }} />
      </ToastProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.info);
    });
    afterExit();
    expect(screen.queryByText('Undone')).toBeNull();
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

  it('shows an important one with notifications off: it explains why a press did nothing', () => {
    writeUserPreferences({ ...readUserPreferences(), notificationsEnabled: false });
    render(
      <ToastProvider>
        <Actions spec={{ ...spec('Text 1 is a text layer.'), important: true }} />
      </ToastProvider>,
    );
    expect(screen.getByText('Text 1 is a text layer.')).toBeTruthy();
  });
});

// docs/specs/004-interface-design/toasts.md "Tones" and "Timing".
describe('plain toasts', () => {
  type Api = ReturnType<typeof useToast>;
  let api: Api;
  function Grab() {
    const toast = useToast();
    useEffect(() => {
      api = toast;
    }, [toast]);
    return null;
  }
  function mount() {
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
  }
  const say = (fn: (a: Api) => void) =>
    act(() => {
      fn(api);
    });

  it('announces an error as an alert and everything else as a status, in one labelled region', () => {
    mount();
    say((a) => a.error("Couldn't save."));
    say((a) => a.success('Saved'));
    say((a) => a.warning('Showing this browser only.'));
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain("Couldn't save.");
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual([
      'Saved',
      'Showing this browser only.',
    ]);
  });

  it('keeps warnings and errors when notifications are off, and quiets the rest', () => {
    writeUserPreferences({ ...readUserPreferences(), notificationsEnabled: false });
    mount();
    say((a) => a.info('Moved'));
    say((a) => a.success('Saved'));
    say((a) => a.warning('Showing this browser only.'));
    say((a) => a.error("Couldn't save."));
    expect(screen.queryByText('Moved')).toBeNull();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByText('Showing this browser only.')).toBeTruthy();
    expect(screen.getByText("Couldn't save.")).toBeTruthy();
  });

  it('times out by tone: four seconds for a note, six for a problem', () => {
    mount();
    say((a) => a.success('Saved'));
    say((a) => a.error("Couldn't save."));
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.success);
    });
    afterExit();
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByText("Couldn't save.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.error - TOAST_TIMEOUT_MS.success);
    });
    afterExit();
    expect(screen.queryByText("Couldn't save.")).toBeNull();
  });

  it('holds while hovered or focused, and resumes with the time it had left', () => {
    mount();
    say((a) => a.info('Moved'));
    const card = screen.getByRole('status');
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    fireEvent.pointerEnter(card);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Moved')).toBeTruthy();
    fireEvent.pointerLeave(card);
    fireEvent.focusIn(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Moved')).toBeTruthy();
    fireEvent.focusOut(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByText('Moved')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    afterExit();
    expect(screen.queryByText('Moved')).toBeNull();
  });

  it('closes on Escape inside it', () => {
    mount();
    say((a) => a.error("Couldn't save."));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss' }), { key: 'Escape' });
    afterExit();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the same message in the same tone once', () => {
    mount();
    say((a) => a.error("Couldn't save."));
    say((a) => a.error("Couldn't save."));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('removes a toast when its own exit animation ends', () => {
    mount();
    say((a) => a.info('Moved'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    // Hidden from assistive tech while it plays out, then gone.
    expect(screen.queryByRole('status')).toBeNull();
    const card = document.querySelector('[data-toast-tone="info"]')!;
    // React picks the event name jsdom supports (it has no AnimationEvent, so the webkit one).
    act(() => {
      for (const name of ['animationend', 'webkitAnimationEnd']) {
        card.dispatchEvent(new Event(name, { bubbles: true }));
      }
    });
    expect(document.querySelector('[data-toast-tone="info"]')).toBeNull();
  });
});
