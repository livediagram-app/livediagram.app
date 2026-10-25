// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { saveSwitchCopy, showsSaveSwitch } from './save-switch';
import { SaveSwitch } from './SaveSwitchRow';

const FRESH = {
  ready: true,
  isOwner: true,
  canEdit: true,
  embedded: false,
  tabCount: 1,
  empty: true,
  shared: false,
  othersPresent: false,
};

describe('saveSwitchCopy', () => {
  it('names the switch by the app’s kind', () => {
    for (const kind of ['Canvas', 'Plan', 'Document', 'Design'])
      expect(saveSwitchCopy({ kind, onServer: false, signedIn: false }).label).toBe(
        `Sync ${kind} to Server`,
      );
  });

  it('says where it is, and why to turn it on, for each state', () => {
    expect(saveSwitchCopy({ kind: 'Plan', onServer: false, signedIn: true }).helper).toBe(
      'Saved in this browser only. Turn on to open it anywhere and share it.',
    );
    expect(saveSwitchCopy({ kind: 'Plan', onServer: false, signedIn: false }).helper).toBe(
      'Saved in this browser only. Turn on to save it to our servers and share it.',
    );
    expect(saveSwitchCopy({ kind: 'Plan', onServer: true, signedIn: true }).helper).toBe(
      'Saved to your account, on every device.',
    );
    // Honest for a guest: on the server, but not on every device until they sign in.
    expect(saveSwitchCopy({ kind: 'Plan', onServer: true, signedIn: false }).helper).toBe(
      'Saved on liveworkspace servers. Sign in to open it on any device.',
    );
    expect(
      saveSwitchCopy({ kind: 'Plan', onServer: true, signedIn: true, moving: 'server' }).helper,
    ).toBe('Syncing to the server…');
    expect(
      saveSwitchCopy({ kind: 'Plan', onServer: false, signedIn: true, moving: 'browser' }).helper,
    ).toBe('Moving to this browser…');
  });
});

describe('showsSaveSwitch', () => {
  it('shows on a fresh item that is the viewer’s alone', () => {
    expect(showsSaveSwitch(FRESH)).toBe(true);
  });

  it.each([
    ['not loaded yet', { ready: false }],
    ['someone else’s', { isOwner: false }],
    ['view only', { canEdit: false }],
    ['embedded', { embedded: true }],
    ['more than one tab', { tabCount: 2 }],
    ['something on it', { empty: false }],
    ['shared', { shared: true }],
    ['someone else in it', { othersPresent: true }],
  ])('hides when %s', (_why, change) => {
    expect(showsSaveSwitch({ ...FRESH, ...change })).toBe(false);
  });
});

// A host whose `onServer` follows a successful move, as an app's offline-ids subscription does.
function Host({
  start,
  toServer,
  toBrowser,
  onFailure = () => {},
  shown = true,
}: {
  start: boolean;
  toServer: () => Promise<void>;
  toBrowser: () => Promise<void>;
  onFailure?: (move: 'server' | 'browser', e: unknown) => void;
  shown?: boolean;
}) {
  const [onServer, setOnServer] = useState(start);
  return (
    <SaveSwitch
      shown={shown}
      kind="Design"
      signedIn
      onServer={onServer}
      toServer={async () => {
        await toServer();
        setOnServer(true);
      }}
      toBrowser={async () => {
        await toBrowser();
        setOnServer(false);
      }}
      onFailure={onFailure}
    />
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SaveSwitch', () => {
  it('is hidden when the app says the item cannot move', () => {
    render(<Host start shown={false} toServer={vi.fn()} toBrowser={vi.fn()} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('labels and describes the switch, and the label flips it', () => {
    const toServer = vi.fn(() => Promise.resolve());
    render(<Host start={false} toServer={toServer} toBrowser={vi.fn()} />);
    const sw = screen.getByRole('switch', { name: 'Sync Design to Server' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(sw.getAttribute('aria-describedby')!)!.textContent).toBe(
      'Saved in this browser only. Turn on to open it anywhere and share it.',
    );
    fireEvent.click(screen.getByText('Sync Design to Server'));
    expect(toServer).toHaveBeenCalledTimes(1);
  });

  it('turned on, syncs: busy and announced while it runs, then on', async () => {
    const run = deferred();
    const toBrowser = vi.fn();
    render(<Host start={false} toServer={() => run.promise} toBrowser={toBrowser} />);
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Syncing to the server…');
    // A second press while it runs does nothing.
    fireEvent.click(sw);
    expect(toBrowser).not.toHaveBeenCalled();
    await act(async () => run.resolve());
    expect(sw.getAttribute('aria-busy')).toBeNull();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Synced to the server.');
    expect(screen.getByText('Saved to your account, on every device.')).toBeTruthy();
  });

  it('turned off, takes it to this browser', async () => {
    const toBrowser = vi.fn(() => Promise.resolve());
    const toServer = vi.fn();
    render(<Host start toServer={toServer} toBrowser={toBrowser} />);
    await act(async () => fireEvent.click(screen.getByRole('switch')));
    expect(toBrowser).toHaveBeenCalledTimes(1);
    expect(toServer).not.toHaveBeenCalled();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('Moved to this browser.');
  });

  it('a failure hands the error to the app and returns the switch', async () => {
    const run = deferred();
    const onFailure = vi.fn();
    render(
      <Host
        start={false}
        toServer={() => run.promise}
        toBrowser={vi.fn()}
        onFailure={onFailure}
      />,
    );
    const sw = screen.getByRole('switch');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    const boom = new Error('offline');
    await act(async () => run.reject(boom));
    expect(onFailure).toHaveBeenCalledWith('server', boom);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('aria-busy')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('stays while a move runs, even if the item stops qualifying', async () => {
    const run = deferred();
    const { rerender } = render(
      <Host start={false} toServer={() => run.promise} toBrowser={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('switch'));
    rerender(<Host start={false} shown={false} toServer={() => run.promise} toBrowser={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeTruthy();
    await act(async () => run.resolve());
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
