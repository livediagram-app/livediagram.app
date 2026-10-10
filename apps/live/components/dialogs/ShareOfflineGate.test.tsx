// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

import { ShareOfflineGate } from './ShareOfflineGate';

// docs/specs/006-document/offline-mode.md "Sharing a Local only document": Share says the document is
// offline and offers Sync Document; nothing syncs until it is pressed, nor before the reader is known;
// a failure leaves the button to try again.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShareOfflineGate', () => {
  it('says the document is offline and syncs nothing by itself', async () => {
    const sync = vi.fn(async () => {});
    render(<ShareOfflineGate onSyncToCloud={sync} onClose={vi.fn()} />);
    await act(async () => {});
    expect(screen.getByText('This Document Is Offline')).toBeTruthy();
    expect(sync).not.toHaveBeenCalled();
  });

  it('syncs on Sync Document, showing progress, and confirms', async () => {
    let finish!: () => void;
    const sync = vi.fn(() => new Promise<void>((r) => (finish = r)));
    render(<ShareOfflineGate onSyncToCloud={sync} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync Document' }));
    expect(sync).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Syncing/ }).getAttribute('aria-busy')).toBe('true');
    await act(async () => finish());
    expect(toast.success).toHaveBeenCalledOnce();
    // Still busy until the dialog swaps the gate for the share options: no flash of the button.
    expect(screen.getByRole('button', { name: /Syncing/ })).toBeTruthy();
  });

  it('keeps the button shut until the reader is known', () => {
    const sync = vi.fn();
    render(<ShareOfflineGate onSyncToCloud={sync} ready={false} onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Sync Document' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(sync).not.toHaveBeenCalled();
  });

  it('says why and offers the button again when the sync fails', async () => {
    const sync = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<ShareOfflineGate onSyncToCloud={sync} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync Document' }));
    await act(async () => {});
    expect(toast.error).toHaveBeenCalledOnce();
    expect(
      (screen.getByRole('button', { name: 'Sync Document' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
