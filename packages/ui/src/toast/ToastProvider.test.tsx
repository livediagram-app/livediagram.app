// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastApi } from './ToastProvider';
import { TOAST_EXIT_HOLD_MS } from './ToastStack';
import { TOAST_BELL_ATTR, TOAST_COLLAPSE_MS } from './toast-collapse';
import { TOAST_ANSWER_TIMEOUT_MS, TOAST_TIMEOUT_MS } from './toast-queue';
import {
  announceToastListOpened,
  readToastHistory,
  resetToastHistoryForTests,
  setToastHistoryScope,
} from './toast-history';

// liveworkspace/docs/specs/016-notifications/toasts.md: every toast can be closed, a plain toast may carry one action,
// standing toasts, one stack per page, and every toast written to the notification list.

let api: ToastApi;
function Grab() {
  const toast = useToast();
  useEffect(() => {
    api = toast;
  }, [toast]);
  return null;
}

const afterExit = () =>
  act(() => {
    vi.advanceTimersByTime(TOAST_EXIT_HOLD_MS);
  });
const states = () => readToastHistory().map((r) => [r.message, r.state]);

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

describe('ToastProvider', () => {
  it('closes any toast with its close button, and lists it as seen', () => {
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.success('“Roadmap” moved'));
    expect(states()).toEqual([['“Roadmap” moved', 'live']]);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    afterExit();
    expect(screen.queryByRole('status')).toBeNull();
    expect(states()).toEqual([['“Roadmap” moved', 'seen']]);
  });

  it('a plain toast’s action runs, then closes it; it stays the answer time', () => {
    const undo = vi.fn();
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() =>
      api.info('Moved “Roadmap” to the Trash.', { action: { label: 'Undo', onSelect: undo } }),
    );
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.info);
    });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledOnce();
    afterExit();
    expect(screen.queryByRole('status')).toBeNull();
    expect(states()).toEqual([['Moved “Roadmap” to the Trash.', 'seen']]);
  });

  it('a timed-out toast is listed as missed', () => {
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.warning('Showing this browser only'));
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.warning);
    });
    afterExit();
    expect(states()).toEqual([['Showing this browser only', 'missed']]);
  });

  it('quiet: the chatter does not pop up but is listed as missed; problems and standing toasts still show', () => {
    render(
      <ToastProvider quiet={() => true}>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.info('Tab duplicated'));
    act(() => api.action({ key: 'k', message: 'Webber changed 3 elements', actions: [] }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => api.error('Couldn’t save.'));
    act(() => api.info('A new version is ready.', { sticky: true }));
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t save.');
    expect(screen.getByRole('status').textContent).toContain('A new version is ready.');
    expect(states()).toEqual([
      ['Tab duplicated', 'missed'],
      ['Webber changed 3 elements', 'missed'],
      ['Couldn’t save.', 'live'],
      ['A new version is ready.', 'live'],
    ]);
  });

  it('a standing toast never times out; closing it calls onDismiss once', () => {
    const onDismiss = vi.fn();
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.action({ key: 'nv', message: 'Ready', actions: [], sticky: true, onDismiss }));
    act(() => {
      vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS * 5);
    });
    expect(screen.getByRole('status').textContent).toContain('Ready');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('an action toast updated in place is listed once, in its final words, and its action sees it', () => {
    const show = vi.fn();
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.action({ key: 'c', message: 'Webber changed 1 element', actions: [] }));
    act(() =>
      api.action({
        key: 'c',
        message: 'Webber changed 3 elements',
        actions: [{ label: 'Show', onSelect: show }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(show).toHaveBeenCalledOnce();
    expect(states()).toEqual([['Webber changed 3 elements', 'seen']]);
    act(() => api.dismissAction('c'));
    afterExit();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a toast pushed out of a full stack is listed as missed; an empty message is ignored', () => {
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.info(''));
    for (const n of [1, 2, 3, 4]) act(() => api.info(`Toast ${n}`));
    expect(states()[0]).toEqual(['Toast 1', 'missed']);
    expect(states()).toHaveLength(4);
  });

  it('a provider inside another hands its toasts to the outer stack and its quiet', () => {
    let inner: ToastApi | null = null;
    function GrabInner() {
      const toast = useToast();
      useEffect(() => {
        inner = toast;
      }, [toast]);
      return null;
    }
    render(
      <ToastProvider quiet={() => true}>
        <Grab />
        <ToastProvider historyScope={() => 'explorer'}>
          <GrabInner />
        </ToastProvider>
      </ToastProvider>,
    );
    expect(inner).toBe(api);
    act(() => inner!.success('Invitation sent'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByRole('region', { name: 'Notifications' })).toHaveLength(1);
    // The inner provider's scope is not taken: the outer page's list holds it.
    expect(states()).toEqual([['Invitation sent', 'missed']]);
  });

  it('a toast raised in a child’s first effect goes in the top provider’s list', () => {
    resetToastHistoryForTests();
    function RaisesOnMount() {
      const toast = useToast();
      useEffect(() => {
        toast.warning('That item was archived');
      }, [toast]);
      return null;
    }
    render(
      <ToastProvider historyScope={() => 'explorer'}>
        <RaisesOnMount />
      </ToastProvider>,
    );
    expect(readToastHistory('explorer').map((r) => r.message)).toEqual(['That item was archived']);
  });

  it('a top provider names the page’s list while it is mounted', () => {
    resetToastHistoryForTests();
    const view = render(
      <ToastProvider historyScope={() => 'explorer'}>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.info('In the Explorer'));
    expect(readToastHistory('explorer').map((r) => r.message)).toEqual(['In the Explorer']);
    view.unmount();
    expect(readToastHistory().map((r) => r.message)).toEqual([]);
  });

  it('a leaving toast collapses into the bell, and is removed when that ends', async () => {
    const bell = document.createElement('button');
    bell.setAttribute(TOAST_BELL_ATTR, '');
    bell.getBoundingClientRect = () =>
      ({ left: 900, top: 700, width: 28, height: 28, right: 928, bottom: 728 }) as DOMRect;
    document.body.append(bell);
    let finish: () => void = () => {};
    const animate = vi.fn(
      () =>
        ({
          finished: new Promise<void>((done) => (finish = done)),
          cancel: vi.fn(),
        }) as unknown as Animation,
    );
    HTMLElement.prototype.animate = animate;
    try {
      render(
        <ToastProvider>
          <Grab />
        </ToastProvider>,
      );
      act(() => api.info('Collapse me'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(animate).toHaveBeenCalled();
      // Past the plain exit, it is still collapsing.
      afterExit();
      expect(screen.getByText('Collapse me')).toBeTruthy();
      await act(async () => finish());
      expect(screen.queryByText('Collapse me')).toBeNull();
      // The fallback hold covers a collapse whose end never comes.
      act(() => api.info('Never ends'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      act(() => {
        vi.advanceTimersByTime(TOAST_COLLAPSE_MS + TOAST_EXIT_HOLD_MS);
      });
      expect(screen.queryByText('Never ends')).toBeNull();
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      bell.remove();
    }
  });

  it('opening the list sends passing toasts into the bell, seen; a standing toast and an offer stay', () => {
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() => api.success('Tab duplicated'));
    act(() => api.info('A new version is ready.', { sticky: true }));
    act(() =>
      api.offer({
        message: 'Move 3 cards?',
        confirmLabel: 'Move',
        declineLabel: 'No Thanks',
        onConfirm: vi.fn(),
        onDecline: vi.fn(),
      }),
    );
    act(() => announceToastListOpened());
    afterExit();
    expect(screen.queryByText('Tab duplicated')).toBeNull();
    expect(screen.getByText('A new version is ready.')).toBeTruthy();
    expect(screen.getByText('Move 3 cards?')).toBeTruthy();
    expect(states()[0]).toEqual(['Tab duplicated', 'seen']);
  });

  it('an offer’s close is its decline', () => {
    const onDecline = vi.fn();
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    act(() =>
      api.offer({
        message: 'Move 3 cards?',
        confirmLabel: 'Move',
        declineLabel: 'No Thanks',
        onConfirm: vi.fn(),
        onDecline,
      }),
    );
    fireEvent.keyDown(screen.getByRole('status'), { key: 'Escape' });
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
