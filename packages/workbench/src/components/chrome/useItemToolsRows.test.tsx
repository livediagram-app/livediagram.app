// @vitest-environment jsdom
// History and Webhooks in Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there"): always there
// where signing in or syncing would make them work, badged Sign In then Sync <Item>, a press opening that gate first.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToolsDoorItems } from './tools-door';
import { useItemToolsRows, type ItemToolsOffline } from './useItemToolsRows';

vi.mock('@liveworkspace/explorer', () => ({
  ItemHistoryDialog: () => <div role="dialog" aria-label="Item History" />,
  useOpenItem: () => ({ id: 'd1' }),
}));

afterEach(cleanup);

function Rows(props: {
  signedIn: boolean;
  offline?: ItemToolsOffline | null;
  onWebhooks?: () => void;
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
    expect(screen.getByText('You are not signed in.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
  });

  it('asks someone signed in to sync, then opens the tool once the item is on the server', async () => {
    const sync = vi.fn(async () => {});
    const onWebhooks = vi.fn();
    const { rerender } = render(<Rows signedIn offline={{ sync, ready: true }} />);
    expect(row('Webhooks').getAttribute('data-badges')).toBe('Sync Canvas');
    fireEvent.click(row('Webhooks'));
    expect(screen.getByText('Saved only in this browser.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Canvas' }));
    });
    expect(sync).toHaveBeenCalledOnce();
    expect(screen.queryByText('Saved only in this browser.')).toBeNull();
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
