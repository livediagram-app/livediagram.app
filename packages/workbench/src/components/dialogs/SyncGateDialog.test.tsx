// @vitest-environment jsdom
// The gate a tool opens on an item kept Offline, or for a guest (each app's offline-mode.md; the platform's
// automations.md "Who may do what"): the app's prompt inside the shared header and footer, the dialog slot held
// across the sync and given back when it fails, and Cancel held while it runs.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const undo = vi.fn();
const hold = vi.fn(() => undo);
vi.mock('@liveworkspace/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/ui')>()),
  holdDialogSlot: () => hold(),
}));

const { SyncGateDialog } = await import('./SyncGateDialog');
import type { SyncPromptProps } from './SyncGateDialog';

// A stand-in for an app's prompt: shows what it was handed and drives the two callbacks.
const seen = vi.fn<(props: SyncPromptProps) => void>();
const handed = (): SyncPromptProps => seen.mock.lastCall![0];
function Prompt(props: SyncPromptProps) {
  seen(props);
  return (
    <div>
      <p>{props.title}</p>
      <p>{props.message}</p>
      {props.signInHref ? <a href={props.signInHref}>Sign In</a> : null}
      <button type="button" onClick={() => props.onBusyChange(true)}>
        Busy
      </button>
    </div>
  );
}

const draw = (over: Partial<Parameters<typeof SyncGateDialog>[0]> = {}) =>
  render(
    <SyncGateDialog
      title="Automations"
      message="Sync it to use Automations."
      promptTitle="Sync Document"
      onSyncToCloud={async () => {}}
      onClose={() => {}}
      Prompt={Prompt}
      {...over}
    />,
  );

describe('SyncGateDialog', () => {
  it('draws the title, the help beside the close, and the app’s prompt with its words', () => {
    draw({ subtitle: 'Saved only in this browser.', help: <a href="/help">Help</a> });
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
    expect(screen.getByText('Saved only in this browser.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Help' })).toBeTruthy();
    expect(screen.getByText('Sync Document')).toBeTruthy();
    expect(screen.getByText('Sync it to use Automations.')).toBeTruthy();
    expect(handed().ready).toBe(true);
    expect(handed().signInHref).toBeUndefined();
  });

  it('hands a guest’s Sign In and a not-ready reader to the prompt', () => {
    draw({ signInHref: '/sign-in/?back=1', ready: false });
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe(
      '/sign-in/?back=1',
    );
    expect(handed().ready).toBe(false);
  });

  it('holds the dialog slot through a sync, and keeps it once the sync lands', async () => {
    const sync = vi.fn(async () => {});
    draw({ onSyncToCloud: sync });
    hold.mockClear();
    undo.mockClear();
    await act(() => handed().onSyncToCloud());
    expect(hold).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('gives the slot back and passes the failure on when the sync fails', async () => {
    const failure = new Error('offline');
    draw({
      onSyncToCloud: async () => {
        throw failure;
      },
    });
    undo.mockClear();
    await expect(handed().onSyncToCloud()).rejects.toBe(failure);
    expect(undo).toHaveBeenCalledOnce();
  });

  it('closes on Cancel and on the close, and holds Cancel while the prompt is busy', () => {
    const onClose = vi.fn();
    draw({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Busy' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
  });

  it('closes by nothing while the sync runs: not the close, Escape or the backdrop', () => {
    const onClose = vi.fn();
    draw({ onClose });
    const backdrop = document.querySelector<HTMLElement>('[data-dialog-backdrop]')!;
    const tryAll = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.pointerDown(backdrop);
      fireEvent.click(backdrop);
    };
    fireEvent.click(screen.getByRole('button', { name: 'Busy' }));
    tryAll();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
    // Each way out works once the prompt is idle again.
    act(() => handed().onBusyChange(false));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
