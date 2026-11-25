// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../toast/ToastProvider';
import { TOAST_EXIT_HOLD_MS } from '../toast/ToastStack';
import { TOAST_ANSWER_TIMEOUT_MS, TOAST_TIMEOUT_MS } from '../toast/toast-queue';
import {
  readToastHistory,
  resetToastHistoryForTests,
  setToastHistoryScope,
} from '../toast/toast-history';
import { UNDO_FAILED_MESSAGE, useUndoableAction, type UndoableAction } from './useUndoableAction';

// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md "The Undo toast".

let offer: (action: UndoableAction) => Promise<boolean>;
function Grab() {
  const run = useUndoableAction();
  useEffect(() => {
    offer = run;
  }, [run]);
  return null;
}

// Notifications quieted, as In-Editor Notifications off does: the Undo toast shows anyway.
const mount = (quiet = false) =>
  render(
    <ToastProvider quiet={() => quiet}>
      <Grab />
    </ToastProvider>,
  );

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

const stateOf = (message: string) => readToastHistory().find((r) => r.message === message)?.state;

beforeEach(() => {
  resetToastHistoryForTests();
  vi.useFakeTimers();
  setToastHistoryScope(() => 'test');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useUndoableAction', () => {
  it('acts at once, then says so with an Undo that takes it back once', async () => {
    mount();
    const act1 = vi.fn();
    const undo = vi.fn();
    let did = false;
    await act(async () => {
      did = await offer({
        message: 'Deleted “Layer 2”.',
        act: act1,
        undo,
        undoLabel: 'Undo deleting Layer 2',
      });
    });
    expect(did).toBe(true);
    expect(act1).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
    expect(screen.getByText('Deleted “Layer 2”.')).toBeTruthy();
    // A polite live region, its Undo a real button named for what it undoes.
    expect(screen.getByText('Deleted “Layer 2”.').closest('[role="status"]')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Undo deleting Layer 2' });
    fireEvent.click(button);
    fireEvent.click(button);
    await flush();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('says nothing when the action did nothing', async () => {
    mount();
    let did = true;
    await act(async () => {
      did = await offer({ message: 'Cleared.', act: () => false, undo: vi.fn() });
    });
    expect(did).toBe(false);
    expect(screen.queryByText('Cleared.')).toBeNull();
  });

  it('shows even with notifications quieted, since it stands in for the confirm', async () => {
    mount(true);
    await act(async () => {
      await offer({ message: 'Reset the canvas.', act: () => {}, undo: () => {} });
    });
    expect(screen.getByText('Reset the canvas.')).toBeTruthy();
  });

  it('stays up longer than a plain toast, then leaves on its own', async () => {
    mount();
    await act(async () => {
      await offer({ message: 'Deleted the slide.', act: () => {}, undo: () => {} });
    });
    expect(TOAST_ANSWER_TIMEOUT_MS).toBeGreaterThan(TOAST_TIMEOUT_MS.info);
    act(() => {
      vi.advanceTimersByTime(TOAST_TIMEOUT_MS.info + 100);
    });
    expect(stateOf('Deleted the slide.')).toBe('live');
    act(() => {
      vi.advanceTimersByTime(TOAST_ANSWER_TIMEOUT_MS);
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_EXIT_HOLD_MS);
    });
    expect(stateOf('Deleted the slide.')).toBe('missed');
  });

  it('gives each action its own toast, so a second never takes the first one’s Undo', async () => {
    mount();
    await act(async () => {
      await offer({ message: 'Deleted A.', act: () => {}, undo: () => {} });
      await offer({ message: 'Deleted B.', act: () => {}, undo: () => {} });
    });
    expect(screen.getByText('Deleted A.')).toBeTruthy();
    expect(screen.getByText('Deleted B.')).toBeTruthy();
  });

  it('says so when the undo fails, by answer or by throw', async () => {
    mount();
    await act(async () => {
      await offer({ message: 'One.', act: () => true, undo: () => false });
      await offer({
        message: 'Two.',
        act: async () => true,
        undo: () => {
          throw new Error('no');
        },
        undoFailed: 'Couldn’t bring it back.',
      });
    });
    const [first, second] = screen.getAllByRole('button', { name: 'Undo' });
    fireEvent.click(first!);
    await flush();
    expect(screen.getByText(UNDO_FAILED_MESSAGE)).toBeTruthy();
    fireEvent.click(second!);
    await flush();
    expect(screen.getByText('Couldn’t bring it back.')).toBeTruthy();
  });
});
