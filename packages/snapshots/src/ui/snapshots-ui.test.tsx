// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRevertReload, SnapshotsApiError, type SnapshotsApi } from '../client';
import type { SnapshotSummary } from '../wire';
import {
  SnapshotsDoorProvider,
  useEditorSnapshotsDoor,
  useItemSnapshotsDoor,
  type SnapshotsDoor,
} from './door';
import { useHistorySnapshotsHost, useSnapshotsExtras } from './history-snapshots';
import { useSnapshots } from './useSnapshots';
import {
  snapshotAuthor,
  snapshotMeta,
  snapshotSize,
  snapshotTime,
  snapshotTitle,
} from './snapshot-words';

afterEach(() => resetRevertReload());

const NOW = Date.UTC(2026, 10, 15, 12, 0);

function snap(i: number, over: Partial<SnapshotSummary> = {}): SnapshotSummary {
  return {
    id: `s_${i}`,
    name: `Snap ${i}`,
    kind: 'manual',
    author: { id: 'user_a', name: 'Ada', color: '#f00' },
    createdAt: NOW - i * 60_000,
    bytes: 2048,
    ...over,
  };
}

function fakeApi(initial: SnapshotSummary[]): SnapshotsApi & { list: ReturnType<typeof vi.fn> } {
  let list = [...initial];
  return {
    list: vi.fn(async () => ({ snapshots: list, kept: 5 })),
    take: vi.fn(async (name: string) => {
      const s = snap(99, { name: name || null, createdAt: NOW });
      list = [s, ...list].slice(0, 5);
      return s;
    }),
    remove: vi.fn(async (id: string) => {
      list = list.filter((s) => s.id !== id);
    }),
    revert: vi.fn(async (id: string) => ({
      snapshotId: id,
      safetySnapshotId: 's_x',
      generation: 1,
    })),
  };
}

// History in Tools, for someone with no timeline to read: a press shows Snapshots on their own.
function SnapshotsRow() {
  const host = useHistorySnapshotsHost();
  const [open, setOpen] = useState(false);
  if (!host) return null;
  return (
    <>
      <button type="button" data-snapshots-button="" onClick={() => setOpen(true)}>
        Snapshots
      </button>
      {open ? (
        <host.Alone onClose={() => setOpen(false)} after={<p>Sign in for the rest</p>} />
      ) : null}
    </>
  );
}

function mount(door: SnapshotsDoor | null) {
  return render(
    <SnapshotsDoorProvider door={door}>
      <SnapshotsRow />
    </SnapshotsDoorProvider>,
  );
}

const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }));
  // The dialog's code loads on first open; a cold load on a busy machine can pass findBy's default second.
  return screen.findByRole('dialog', {}, { timeout: 5000 });
};

// Take Snapshot is a button that opens its form in a popover; the form's own button takes it.
function openTake() {
  fireEvent.click(document.querySelector<HTMLElement>('[data-snapshot-button]')!);
}
function takeButton() {
  return within(screen.getByLabelText('Snapshot name').closest('form')!).getByRole('button', {
    name: /Take Snapshot|Taking…/,
  });
}

describe('Snapshots alone, in History', () => {
  it('draws nothing without a door', () => {
    const { container } = mount(null);
    expect(container.querySelector('[data-snapshots-button]')).toBeNull();
  });

  it('hands History one host while the door is open, and draws what History puts under it', async () => {
    const { result, rerender } = renderHook(() => useHistorySnapshotsHost(), {
      wrapper: ({ children }) => (
        <SnapshotsDoorProvider door={{ api: fakeApi([]), noun: 'plan', viewerId: null }}>
          {children}
        </SnapshotsDoorProvider>
      ),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    mount({ api: fakeApi([]), noun: 'plan', viewerId: null });
    await open();
    expect(screen.getByText('Sign in for the rest')).toBeTruthy();
  });

  it('draws nothing once the door shuts', () => {
    const host = renderHook(() => useHistorySnapshotsHost(), {
      wrapper: ({ children }) => (
        <SnapshotsDoorProvider door={{ api: fakeApi([]), noun: 'plan', viewerId: null }}>
          {children}
        </SnapshotsDoorProvider>
      ),
    }).result.current!;
    const { container } = render(<host.Alone onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('gives History the open door’s snapshots, and draws alone with nothing under it', async () => {
    const door = { api: fakeApi([snap(1)]), noun: 'plan', viewerId: null };
    function Pins() {
      const extras = useHistorySnapshotsHost()!.useExtras();
      return <p>{extras.pins.length} pinned</p>;
    }
    function AloneBare() {
      const host = useHistorySnapshotsHost()!;
      return <host.Alone onClose={() => {}} />;
    }
    render(
      <SnapshotsDoorProvider door={door}>
        <Pins />
        <AloneBare />
      </SnapshotsDoorProvider>,
    );
    expect(await screen.findByText('1 pinned')).toBeTruthy();
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    expect(dialog.querySelector('.border-t.px-4')).toBeNull();
  });

  it('opens the dialog, empty, and takes a named snapshot', async () => {
    const api = fakeApi([]);
    mount({ api, noun: 'plan', viewerId: 'user_a' });
    await open();
    expect(await screen.findByText('No snapshots yet')).toBeTruthy();
    expect(screen.getByText('Save points for the whole plan. The latest 5 are kept.')).toBeTruthy();
    openTake();
    fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'Launch' } });
    fireEvent.click(takeButton());
    expect(await screen.findByText('Launch')).toBeTruthy();
    expect(api.take).toHaveBeenCalledWith('Launch');
    // Taken, the popover closes.
    await waitFor(() => expect(screen.queryByLabelText('Snapshot name')).toBeNull());
    expect(screen.getByText(/^You · /)).toBeTruthy();
  });

  it('says which snapshot the next one removes when five are kept', async () => {
    const api = fakeApi([0, 1, 2, 3, 4].map((i) => snap(i)));
    mount({ api, noun: 'design', viewerId: null });
    await open();
    await screen.findByText('Snap 4');
    openTake();
    expect(await screen.findByText('Taking another removes the oldest, “Snap 4”.')).toBeTruthy();
  });

  it('puts the Before revert badge on its own line below sm, and keeps the bin pad off Revert', async () => {
    const api = fakeApi([snap(1, { kind: 'before-revert', name: 'A long snapshot name' })]);
    mount({ api, noun: 'plan', viewerId: null });
    await open();
    const line = (await screen.findByText('Before revert')).parentElement!;
    expect(line.hasAttribute('data-snapshot-title-line')).toBe(true);
    const classes = line.className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['flex-col', 'items-start', 'sm:flex-row']));
    expect(screen.getByText('A long snapshot name').className.split(' ')).toContain('max-w-full');
    // The bin's 44px touch pad is anchored to the bin itself, so on a phone it never covers Revert.
    const bin = screen.getByRole('button', { name: 'Delete snapshot' }).className.split(' ');
    expect(bin).toEqual(expect.arrayContaining(['relative', 'touch-target']));
  });

  it('confirms Revert beside its button, can cancel by button and Escape, then reverts and reloads', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
    const api = fakeApi([snap(1, { kind: 'before-revert' })]);
    mount({ api, noun: 'document', viewerId: null });
    await open();
    expect(await screen.findByText('Before revert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revert to Snap 1' }));
    expect(screen.getByText(/A snapshot of the document as it is now is taken first/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Revert to Snap 1' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Revert to Snap 1' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(api.revert).toHaveBeenCalledWith('s_1');
    expect(screen.getByText('Reverted. Reloading…')).toBeTruthy();
  });

  it('deletes at once, with no question, and removes the row', async () => {
    const api = fakeApi([snap(1), snap(2, { name: null, author: null })]);
    mount({ api, noun: 'Space', viewerId: null });
    await open();
    await screen.findByText('Snap 1');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete snapshot' })[0]!);
    });
    await waitFor(() => expect(screen.queryByText('Snap 1')).toBeNull());
    expect(api.remove).toHaveBeenCalledWith('s_1');
  });

  it('shows a refusal and a failed list', async () => {
    const api = fakeApi([]);
    api.take = vi.fn(async () => {
      throw new SnapshotsApiError(413, 'snapshot_too_large', 'This is too large to snapshot.');
    });
    mount({ api, noun: 'plan', viewerId: null });
    await open();
    await screen.findByText('No snapshots yet');
    openTake();
    fireEvent.click(takeButton());
    expect((await screen.findByRole('alert')).textContent).toBe('This is too large to snapshot.');
    api.take = vi.fn(async () => {
      throw new Error('offline');
    });
    fireEvent.click(takeButton());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Something went wrong. Try again.'),
    );
  });

  it('shows the generic message when the list fails, and closes', async () => {
    const api = fakeApi([]);
    api.list.mockRejectedValueOnce(new Error('offline'));
    mount({ api, noun: 'plan', viewerId: null });
    await open();
    expect(await screen.findByText("Couldn't load snapshots")).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Check your connection');
    expect(screen.queryByText('No snapshots yet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('No snapshots yet')).toBeTruthy();
    expect(screen.queryByText("Couldn't load snapshots")).toBeNull();
    expect(api.list).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('ignores answers that land after it closed', async () => {
    let resolve: (v: { snapshots: SnapshotSummary[]; kept: number }) => void = () => {};
    let reject: (e: unknown) => void = () => {};
    const api = fakeApi([]);
    api.list.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const first = mount({ api, noun: 'plan', viewerId: null });
    await open();
    expect(screen.getByRole('status', { name: 'Loading snapshots' })).toBeTruthy();
    first.unmount();
    await act(async () => resolve({ snapshots: [], kept: 5 }));
    api.list.mockImplementationOnce(() => new Promise((_, j) => (reject = j)));
    const second = mount({ api, noun: 'plan', viewerId: null });
    await open();
    second.unmount();
    await act(async () => reject(new Error('late')));
  });

  it('a submit while busy does nothing', async () => {
    let finish: () => void = () => {};
    const api = fakeApi([]);
    api.take = vi.fn(() => new Promise<SnapshotSummary>((r) => (finish = () => r(snap(5)))));
    mount({ api, noun: 'plan', viewerId: null });
    await open();
    await screen.findByText('No snapshots yet');
    openTake();
    const form = screen.getByLabelText('Snapshot name').closest('form')!;
    fireEvent.submit(form);
    expect(await screen.findByText('Taking…')).toBeTruthy();
    fireEvent.submit(form);
    expect(api.take).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

// History's timeline with Snapshots in it: the Take Snapshot button (History's action) over it, each snapshot a pinned entry on the rail.
function Timeline({ door }: { door: SnapshotsDoor }) {
  const extras = useSnapshotsExtras(door, () => NOW);
  return (
    <div>
      {extras.action}
      {extras.top}
      <ol aria-label="Timeline">
        {extras.pins.map((pin, i) => (
          <div key={pin.key} data-at={pin.at}>
            {pin.render(i === extras.pins.length - 1)}
          </div>
        ))}
      </ol>
    </div>
  );
}

describe('Snapshots in the History timeline', () => {
  it('takes one from the top and pins each on the rail, with Revert and Delete in place', async () => {
    const api = fakeApi([snap(1), snap(2)]);
    const { container } = render(<Timeline door={{ api, noun: 'canvas', viewerId: 'user_a' }} />);
    expect(await screen.findByText('Snap 1')).toBeTruthy();
    const pins = container.querySelectorAll('[data-history-snapshot]');
    expect(pins).toHaveLength(2);
    expect(pins[0]!.parentElement!.getAttribute('data-at')).toBe(String(NOW - 60_000));
    // The rail runs on under every pin but the last.
    expect(pins[0]!.querySelector('span.w-px')).toBeTruthy();
    expect(pins[1]!.querySelector('span.w-px')).toBeNull();
    // The row inside a pin is a block, the pin being the list item.
    expect(pins[0]!.querySelector('[data-snapshot-row]')!.tagName).toBe('DIV');
    openTake();
    fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'Launch' } });
    fireEvent.click(takeButton());
    expect(await screen.findByText('Launch')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revert to Snap 1' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete snapshot' })[1]!);
    });
    await waitFor(() => expect(screen.queryByText('Snap 1')).toBeNull());
    expect(api.remove).toHaveBeenCalledWith('s_1');
  });

  it('reverts from a pin and says so over the timeline', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, configurable: true });
    const api = fakeApi([snap(1)]);
    render(<Timeline door={{ api, noun: 'canvas', viewerId: null }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revert to Snap 1' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Reverted. Reloading…')).toBeTruthy();
  });
});

describe('useEditorSnapshotsDoor', () => {
  const session = {
    hydrated: true,
    isOffline: false,
    embedMode: false,
    workbench: null as unknown,
    isStructureReadOnly: false,
    level: 'edit',
    itemId: 'd 1' as string | null,
    selfId: 'u' as string | null,
    shareCode: 'abc' as string | null,
  };
  it('opens only for an Editor of the whole stored item, with its share code on every call', async () => {
    const apiFetch = vi.fn(async () => new Response(JSON.stringify({ snapshots: [], kept: 5 })));
    const apiHeaders = vi.fn(async () => ({}));
    const { result, rerender } = renderHook(
      (props: typeof session) =>
        useEditorSnapshotsDoor({
          ...props,
          apiBase: '/api',
          collection: 'documents',
          noun: 'document',
          apiFetch,
          apiHeaders,
        }),
      { initialProps: session },
    );
    expect(result.current?.noun).toBe('document');
    await result.current!.api.list();
    expect(apiFetch).toHaveBeenCalledWith('/api/documents/d%201/snapshots', expect.anything());
    expect(apiHeaders).toHaveBeenCalledWith('u', { share: 'abc', body: false });
    for (const closed of [
      { hydrated: false },
      { isOffline: true },
      { embedMode: true },
      { workbench: {} },
      { isStructureReadOnly: true },
      { level: 'view' },
      { selfId: 'self' },
      { selfId: null },
      { itemId: null },
    ]) {
      rerender({ ...session, ...closed });
      expect(result.current).toBeNull();
    }
  });
});

describe('useItemSnapshotsDoor', () => {
  it('is null unless allowed with a route, and keeps one api per item and caller', async () => {
    const apiFetch = vi.fn(async () => new Response(JSON.stringify({ snapshots: [], kept: 5 })));
    const apiHeaders = async () => ({});
    const { result, rerender } = renderHook(
      (props: { allowed: boolean; itemUrl: string | null }) =>
        useItemSnapshotsDoor({ ...props, noun: 'plan', viewerId: 'u', apiFetch, apiHeaders }),
      { initialProps: { allowed: false, itemUrl: '/api/projects/p' as string | null } },
    );
    expect(result.current).toBeNull();
    rerender({ allowed: true, itemUrl: null });
    expect(result.current).toBeNull();
    rerender({ allowed: true, itemUrl: '/api/projects/p' });
    const first = result.current;
    expect(first?.noun).toBe('plan');
    rerender({ allowed: true, itemUrl: '/api/projects/p' });
    expect(result.current).toBe(first);
    await first!.api.list();
    expect(apiFetch).toHaveBeenCalledWith('/api/projects/p/snapshots', expect.anything());
  });
});

describe('useSnapshots', () => {
  it('a delete before the list lands leaves an empty list', async () => {
    const api = fakeApi([]);
    api.list.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useSnapshots(api));
    await act(async () => result.current.remove('s_1'));
    expect(result.current.snapshots).toEqual([]);
  });
});

describe('snapshot words', () => {
  it('names, sizes and attributes', () => {
    expect(snapshotTime(NOW, 'en-GB')).toMatch(/15 Nov/);
    expect(snapshotTitle(snap(1, { name: null }), 'en-GB')).toMatch(/^Snapshot of 15 Nov/);
    expect(snapshotSize(10)).toBe('1.0 KB');
    expect(snapshotSize(20 * 1024)).toBe('20 KB');
    expect(snapshotSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(snapshotSize(20 * 1024 * 1024)).toBe('20 MB');
    expect(snapshotAuthor(snap(1, { author: null }), null)).toBe('Someone');
    expect(snapshotAuthor(snap(1, { author: { id: 'u', name: '', color: '' } }), null)).toBe(
      'Someone',
    );
    expect(snapshotAuthor(snap(1), 'user_a')).toBe('You');
    expect(snapshotAuthor(snap(1), 'user_b')).toBe('Ada');
    expect(snapshotMeta(snap(0, { createdAt: NOW + 5 }), null, NOW)).toBe(
      'Ada · just now · 2.0 KB',
    );
  });
});
