// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { noteSaveFailing } from '@/lib/save-health';
import { OfflineBanner } from './OfflineBanner';

// docs/specs/007-editor/load-recovery.md "Offline".

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  noteSaveFailing(false);
});

describe('OfflineBanner', () => {
  it('shows nothing online', () => {
    const { container } = render(<OfflineBanner readOnly={false} />);
    expect(container.textContent).toBe('');
  });

  it('tells an editor their changes stay in this tab, and goes when back online', () => {
    act(() => setOnline(false));
    render(<OfflineBanner readOnly={false} />);
    expect(screen.getByRole('status').textContent).toBe(
      'You’re offline. Changes stay in this tab and save when you reconnect.',
    );
    act(() => setOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells a viewer they will see changes on reconnect', () => {
    act(() => setOnline(false));
    render(<OfflineBanner readOnly />);
    expect(screen.getByRole('status').textContent).toBe(
      'You’re offline. You’ll see changes when you reconnect.',
    );
  });

  // "A failing save stays on screen".
  it('says a failing save is retrying while online, and goes when a save lands', () => {
    render(<OfflineBanner readOnly={false} />);
    act(() => noteSaveFailing(true));
    expect(screen.getByRole('status').textContent).toBe(
      'Couldn’t save your changes. Retrying, so keep this tab open.',
    );
    act(() => noteSaveFailing(false));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never tells a viewer about a failing save, and says offline over it', () => {
    act(() => noteSaveFailing(true));
    const { container, unmount } = render(<OfflineBanner readOnly />);
    expect(container.textContent).toBe('');
    unmount();
    act(() => setOnline(false));
    render(<OfflineBanner readOnly={false} />);
    expect(screen.getByRole('status').textContent).toContain('You’re offline.');
  });
});
