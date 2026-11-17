// @vitest-environment jsdom
// History and Webhooks in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there"): always there
// where signing in or syncing would make them work, badged Sign In then Sync <Item>, a press opening that gate first.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { HistoryExtras } from '@liveworkspace/explorer';
import { usePublishItemVersions, useToolsDoorItems } from './tools-door';
import {
  historyMode,
  useItemToolsRows,
  type ItemHistoryHost,
  type ItemSnapshotsHost,
  type ItemToolsOffline,
} from './useItemToolsRows';

vi.mock('@liveworkspace/explorer', () => ({
  createExplorerAccounts: () => ({}),
  ItemHistoryDialog: ({ extras, onClose }: { extras?: HistoryExtras; onClose: () => void }) => (
    <div role="dialog" aria-label="Item History">
      {extras?.top}
      {extras?.pins.map((pin) => (
        <div key={pin.key}>{pin.render(true)}</div>
      ))}
      <button type="button" onClick={onClose}>
        Close History
      </button>
    </div>
  ),
  useOpenItem: () => ({ id: 'd1' }),
}));

const HISTORY: ItemHistoryHost = {
  app: 'livediagram',
  client: {} as ItemHistoryHost['client'],
  itemHref: () => '/d1',
  viewerId: 'u1',
  itemId: 'd1',
  shareCode: null,
  sharePassword: () => null,
  useTeams: () => [],
};

const SNAPSHOTS: ItemSnapshotsHost = {
  useExtras: () => ({
    top: <p>Take Snapshot here</p>,
    pins: [{ key: 'snapshot:s1', at: 1, render: () => <p>Pinned Launch</p> }],
  }),
  Alone: ({ onClose, after }: { onClose: () => void; after?: ReactNode }) => (
    <div role="dialog" aria-label="Snapshots">
      {after}
      <button type="button" onClick={onClose}>
        Close Snapshots
      </button>
    </div>
  ),
};

function Versions({ open }: { open: () => void }) {
  usePublishItemVersions(open);
  return null;
}

afterEach(cleanup);

function Rows(props: {
  signedIn: boolean;
  offline?: ItemToolsOffline | null;
  onWebhooks?: () => void;
  history?: ItemHistoryHost | null;
  snapshots?: ItemSnapshotsHost | null;
}) {
  const dialog = useItemToolsRows({ app: 'livediagram', history: null, ...props });
  const items = useToolsDoorItems();
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-badges={item.badges?.join(', ') ?? ''}
          data-in-place={item.inPlace ? 'yes' : 'no'}
          data-description={item.description}
          onClick={() => item.onSelect(null)}
        >
          {item.label}
        </button>
      ))}
      {dialog}
    </>
  );
}

const row = (name: string) => screen.getByRole('button', { name });

describe('History and Webhooks in Tools', () => {
  it('shows a guest on an item in This Browser both, badged Sign In then Sync Canvas, asking to sign in first', () => {
    render(<Rows signedIn={false} offline={{ sync: vi.fn(), ready: true }} />);
    expect(row('History').getAttribute('data-badges')).toBe('Sign In, Sync Canvas');
    expect(row('Webhooks').getAttribute('data-badges')).toBe('Sign In, Sync Canvas');
    fireEvent.click(row('Webhooks'));
    expect(screen.getByText('Sign In Needed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
  });

  it('asks someone signed in to sync, then opens the tool once the item is on the server', async () => {
    const sync = vi.fn(async () => {});
    const onWebhooks = vi.fn();
    const { rerender } = render(<Rows signedIn offline={{ sync, ready: true }} />);
    expect(row('Webhooks').getAttribute('data-badges')).toBe('Sync Canvas');
    fireEvent.click(row('Webhooks'));
    expect(screen.getByText(/You need to sync this canvas/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Canvas' }));
    });
    expect(sync).toHaveBeenCalledOnce();
    expect(screen.queryByText(/You need to sync this canvas/)).toBeNull();
    rerender(<Rows signedIn offline={null} onWebhooks={onWebhooks} />);
    expect(onWebhooks).toHaveBeenCalledOnce();
    expect(row('Webhooks').getAttribute('data-badges')).toBe('');
  });

  it('keeps the gate open, saying so, when the sync fails', async () => {
    const sync = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<Rows signedIn offline={{ sync, ready: true }} />);
    fireEvent.click(row('History'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Canvas' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Couldn');
  });

  it('holds Sync until the reader is known', () => {
    render(<Rows signedIn offline={{ sync: vi.fn(), ready: false }} />);
    fireEvent.click(row('History'));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Sync Canvas' }).disabled).toBe(
      true,
    );
  });

  it('draws neither for someone signed in on a stored item who may use neither', () => {
    render(<Rows signedIn />);
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Webhooks' })).toBeNull();
  });
});

describe('History with Snapshots in it (owner, 2026-11-17)', () => {
  it('picks what History opens from what this person may use', () => {
    const none = { timeline: false, snapshots: false, gated: false, versions: false };
    expect(historyMode({ ...none, timeline: true, snapshots: true })).toBe('timeline');
    expect(historyMode({ ...none, snapshots: true, gated: true })).toBe('snapshots');
    expect(historyMode({ ...none, gated: true, versions: true })).toBe('gate');
    expect(historyMode({ ...none, versions: true })).toBe('versions');
    expect(historyMode(none)).toBeNull();
  });

  it('puts Take Snapshot over the timeline and each snapshot on it', () => {
    render(<Rows signedIn history={HISTORY} snapshots={SNAPSHOTS} />);
    expect(row('History').getAttribute('data-description')).toBe(
      'Snapshots, and who changed what.',
    );
    fireEvent.click(row('History'));
    const dialog = screen.getByRole('dialog', { name: 'Item History' });
    expect(dialog.textContent).toContain('Take Snapshot here');
    expect(dialog.textContent).toContain('Pinned Launch');
    fireEvent.click(screen.getByRole('button', { name: 'Close History' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the timeline alone where there are no snapshots to take', () => {
    render(<Rows signedIn history={HISTORY} />);
    expect(row('History').getAttribute('data-description')).toBe('Who changed what, and when.');
    fireEvent.click(row('History'));
    expect(screen.getByRole('dialog', { name: 'Item History' }).textContent).not.toContain(
      'Take Snapshot here',
    );
  });

  it('shows a share-link Editor the snapshots alone, and a guest the account line under them', () => {
    const { rerender } = render(<Rows signedIn snapshots={SNAPSHOTS} />);
    expect(row('History').getAttribute('data-badges')).toBe('');
    fireEvent.click(row('History'));
    expect(screen.getByRole('dialog', { name: 'Snapshots' }).textContent).toBe('Close Snapshots');
    fireEvent.click(screen.getByRole('button', { name: 'Close Snapshots' }));
    rerender(<Rows signedIn={false} snapshots={SNAPSHOTS} />);
    fireEvent.click(row('History'));
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Snapshots' }).textContent).toContain(
      'to see who changed this canvas',
    );
  });

  it('opens Version History straight from the row where History has nothing else', () => {
    const open = vi.fn();
    render(
      <>
        <Versions open={open} />
        <Rows signedIn />
      </>,
    );
    expect(row('History').getAttribute('data-in-place')).toBe('no');
    fireEvent.click(row('History'));
    expect(open).toHaveBeenCalledOnce();
  });

  it('offers Open Version History inside History, which closes it as it opens', () => {
    const open = vi.fn();
    render(
      <>
        <Versions open={open} />
        <Rows signedIn history={HISTORY} snapshots={SNAPSHOTS} />
      </>,
    );
    fireEvent.click(row('History'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Version History' }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers it under the timeline alone, under snapshots alone, and under the sign-in prompt', () => {
    const open = vi.fn();
    const { rerender } = render(
      <>
        <Versions open={open} />
        <Rows signedIn history={HISTORY} />
      </>,
    );
    fireEvent.click(row('History'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Version History' }));
    rerender(
      <>
        <Versions open={open} />
        <Rows signedIn snapshots={SNAPSHOTS} />
      </>,
    );
    fireEvent.click(row('History'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Version History' }));
    rerender(
      <>
        <Versions open={open} />
        <Rows signedIn={false} />
      </>,
    );
    fireEvent.click(row('History'));
    expect(screen.getByText('Sign In Needed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Version History' }));
    expect(open).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('Sign In Needed')).toBeNull();
  });
});
