// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { LoadErrorCard } from './LoadErrorCard';

// docs/specs/007-editor/load-recovery.md "The recovery card" and "Offline".

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => setOnline(true));

describe('LoadErrorCard', () => {
  it('shows the load error with the recovery card in the full app', async () => {
    render(<LoadErrorCard embed={false} ownerId={null} reload={vi.fn()} />);
    expect(screen.getByText(/it didn’t finish loading/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: /copy diagnostics/i })).toBeTruthy();
  });

  it('keeps an embed to the bare retry card', () => {
    render(<LoadErrorCard embed ownerId={null} reload={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /copy diagnostics/i })).toBeNull();
  });

  it('says it is offline, and reloads once the connection is back', () => {
    const reload = vi.fn();
    act(() => setOnline(false));
    render(<LoadErrorCard embed={false} ownerId={null} reload={reload} />);
    expect(screen.getByText('You’re offline')).toBeTruthy();
    expect(screen.getByText(/open as soon as you reconnect/)).toBeTruthy();
    // Offline the recovery tools stay out: their chunk may be unreachable.
    expect(screen.queryByRole('button', { name: /copy diagnostics/i })).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    act(() => setOnline(true));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads itself when first shown online', () => {
    const reload = vi.fn();
    render(<LoadErrorCard embed={false} ownerId={null} reload={reload} />);
    act(() => setOnline(true));
    expect(reload).not.toHaveBeenCalled();
  });
});
