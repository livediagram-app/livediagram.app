// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { noteSaveFailing } from '@liveworkspace/workbench/lib/save-health';
import { forgetPlanQueues, planQueue } from '@/lib/offline-queue/plan-queue';
import { OfflineBanner, waitingCopy } from './OfflineBanner';

// docs/specs/007-editor/load-recovery.md "Offline".

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  noteSaveFailing(false);
  localStorage.clear();
  forgetPlanQueues();
});

const wait = (seq: number) =>
  planQueue('p', 'o').add({
    id: `i${seq}`,
    seq,
    store: 'items',
    write: { kind: 'delete', id: 'c' },
  });

describe('OfflineBanner', () => {
  it('draws as nothing waiting when rendered ahead of the browser', () => {
    wait(1);
    expect(renderToString(<OfflineBanner readOnly={false} />)).toBe('');
  });

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

  // docs/specs/007-editor/offline-changes.md "What the person sees".
  it('counts the changes waiting in this browser, offline and while they are sent', () => {
    expect(waitingCopy(false, 1)).toBe(
      'You’re offline. 1 change waits in this browser and saves when you reconnect.',
    );
    expect(waitingCopy(true, 1)).toBe('Saving 1 change made without a connection.');
    act(() => setOnline(false));
    render(<OfflineBanner readOnly={false} />);
    act(() => {
      wait(1);
      wait(2);
      wait(3);
    });
    expect(screen.getByRole('status').textContent).toBe(
      'You’re offline. 3 changes wait in this browser and save when you reconnect.',
    );
    act(() => setOnline(true));
    expect(screen.getByRole('status').textContent).toBe(
      'Saving 3 changes made without a connection.',
    );
    act(() => planQueue('p', 'o').remove(['i1', 'i2', 'i3']));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('counts a Participant’s waiting changes though it is read-only, and puts a failing save first', () => {
    act(() => {
      wait(1);
    });
    render(<OfflineBanner readOnly />);
    expect(screen.getByRole('status').textContent).toBe(
      'Saving 1 change made without a connection.',
    );
    act(() => noteSaveFailing(true));
    expect(screen.getByRole('status').textContent).toBe(
      'Saving 1 change made without a connection.',
    );
  });

  it('says a failing tab save over waiting changes for someone who edits', () => {
    act(() => {
      wait(1);
      noteSaveFailing(true);
    });
    render(<OfflineBanner readOnly={false} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Couldn’t save your changes. Retrying, so keep this tab open.',
    );
  });
});
