// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

import { ShareOfflineGate } from './ShareOfflineGate';

// docs/specs/006-document/offline-mode.md "Sharing a guest's Local only document": a guest's Share syncs at
// once with its progress showing; a signed-in person is asked first; nothing syncs before the reader
// is known, and a failure drops back to the gate's button.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ShareOfflineGate', () => {
  it('keeps the button shut until the reader is known', () => {
    render(<ShareOfflineGate onSyncToCloud={vi.fn()} ready={false} onClose={vi.fn()} />);
    expect(
      (screen.getByRole('button', { name: 'Sync Document' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('asks a signed-in person before syncing', () => {
    const sync = vi.fn(async () => {});
    render(<ShareOfflineGate onSyncToCloud={sync} onClose={vi.fn()} />);
    expect(sync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sync Document' }));
    expect(sync).toHaveBeenCalledOnce();
  });

  it("syncs a guest's document at once and shows the progress", async () => {
    const sync = vi.fn(() => new Promise<void>(() => {}));
    render(<ShareOfflineGate onSyncToCloud={sync} atOnce onClose={vi.fn()} />);
    await act(async () => {});
    expect(sync).toHaveBeenCalledOnce();
    expect(screen.getByText('Getting a Share Link Ready')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('open as soon as it is uploaded');
  });

  it('waits for the reader before syncing', async () => {
    const sync = vi.fn(() => new Promise<void>(() => {}));
    const { rerender } = render(
      <ShareOfflineGate onSyncToCloud={sync} atOnce ready={false} onClose={vi.fn()} />,
    );
    await act(async () => {});
    expect(sync).not.toHaveBeenCalled();
    expect(screen.getByText('Getting a Share Link Ready')).toBeTruthy();
    rerender(<ShareOfflineGate onSyncToCloud={sync} atOnce ready onClose={vi.fn()} />);
    await act(async () => {});
    expect(sync).toHaveBeenCalledOnce();
  });

  it('falls back to the button, once, when the sync fails', async () => {
    const sync = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<ShareOfflineGate onSyncToCloud={sync} atOnce onClose={vi.fn()} />);
    await act(async () => {});
    expect(sync).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Sync Document' })).toBeTruthy();
  });
});
