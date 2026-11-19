// @vitest-environment jsdom

// Connect File in a start panel (connected-tabs.md "Connecting"): one read of Recent once mounted, a press
// connects with the host's grant and the editor's add, telemetry says one way or both, and the clock ticks once a
// minute until the list goes.
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BESIDE_OFFERS,
  IndexError,
  type ConnectionMade,
  type Item,
} from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import {
  CONNECT_CLOCK_MS,
  ConnectFilePanel,
  useTickingNow,
  type ConnectFilePanelProps,
} from './ConnectFilePanel';

afterEach(() => {
  cleanup();
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.useRealTimers();
});

const NOW = Date.UTC(2026, 10, 7, 12);
const PLAN: Item = {
  id: 'p1',
  app: 'liveplanner',
  kind: 'plan',
  title: 'Launch plan',
  ownerId: 'me',
  teamId: null,
  folderId: null,
  source: null,
  intent: null,
  createdAt: NOW - 86_400_000,
  updatedAt: NOW - 3_600_000,
  trashedAt: null,
  trashReason: null,
  summary: {},
  access: 'edit',
} as Item;
const MADE: ConnectionMade = {
  connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'p1' },
  name: 'Launch plan',
  level: 'edit',
  reverse: null,
};

const setup = (over: Partial<ConnectFilePanelProps> = {}) => {
  const client = {
    listItems: vi.fn().mockResolvedValue({ items: [PLAN], nextCursor: null }),
    makeConnection: vi.fn().mockResolvedValue(MADE),
    makeBeside: vi.fn().mockResolvedValue(MADE),
    takeBackConnection: vi.fn().mockResolvedValue(undefined),
  };
  const props: ConnectFilePanelProps = {
    hostId: 'host',
    hostKind: 'canvas',
    hostManaged: true,
    connected: new Map(),
    grant: () => Promise.resolve('grant'),
    newTabId: () => 'new-tab',
    addTab: vi.fn().mockResolvedValue(undefined),
    onConnected: vi.fn(),
    onGoTo: vi.fn(),
    client,
    ...over,
  };
  render(<ConnectFilePanel {...props} />);
  return { client, props };
};

describe('ConnectFilePanel', () => {
  it('connects a pressed file into a new tab and says so', async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    const { client, props } = setup({
      ink: {
        text: '#111111',
        muted: '#555555',
        border: '#dddddd',
        surface: '#fafafa',
        column: '#f1f1f1',
        card: '#ffffff',
        accent: '#2563eb',
      },
      onOpenExplorer: vi.fn(),
    });
    expect(screen.getByRole('heading', { name: 'Connect File' })).toBeTruthy();
    expect(client.listItems).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByText('Launch plan'));
    await waitFor(() => expect(props.onConnected).toHaveBeenCalledWith('new-tab', MADE));
    expect(client.makeConnection).toHaveBeenCalledWith(
      'host',
      { targetId: 'p1', tabId: 'new-tab', level: 'edit', both: false },
      'grant',
    );
    expect(props.addTab).toHaveBeenCalledWith(MADE, 'new-tab');
    expect(track).toHaveBeenCalledWith('Tab', 'Added', 'Connected');
  });

  it('counts a both-ways connect as such', async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    const { client } = setup();
    await screen.findByText('Launch plan');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('Launch plan'));
    await waitFor(() => expect(track).toHaveBeenCalledWith('Tab', 'Added', 'ConnectedBoth'));
    expect(client.makeConnection.mock.calls[0]![1]).toMatchObject({ both: true });
  });

  it('makes nothing without the host grant, and says why on the row', async () => {
    const { client, props } = setup({ grant: () => Promise.resolve(null) });
    fireEvent.click(await screen.findByText('Launch plan'));
    expect(
      await screen.findByText('Could not connect it. Check your connection and try again.'),
    ).toBeTruthy();
    expect(client.makeConnection).not.toHaveBeenCalled();
    expect(props.onConnected).not.toHaveBeenCalled();
  });
});

describe('Make a plan beside it (Work Tracker 1281)', () => {
  it('shows no offer unless the host has one', async () => {
    setup();
    await screen.findByText('Launch plan');
    expect(screen.queryByText('Suggested')).toBeNull();
    expect(screen.queryByText('Make a plan beside it')).toBeNull();
  });

  it('makes the plan only when pressed, at the chosen role, into a new tab, and counts the connection', async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    const { client, props } = setup({ offer: BESIDE_OFFERS.plan, hostKind: 'document' });
    expect(screen.getByRole('heading', { name: 'Suggested' })).toBeTruthy();
    expect(
      screen.getByText('New liveplanner Project Planner, connected to this document'),
    ).toBeTruthy();
    // Shown, nothing is made: only a press makes the plan.
    await screen.findByText('Launch plan');
    expect(client.makeBeside).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: /Viewer/ }));
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByText('Make a plan beside it'));
    await waitFor(() => expect(props.onConnected).toHaveBeenCalledWith('new-tab', MADE));
    expect(client.makeBeside).toHaveBeenCalledWith(
      'host',
      { offer: 'plan', tabId: 'new-tab', level: 'view', both: true },
      'grant',
    );
    expect(props.addTab).toHaveBeenCalledWith(MADE, 'new-tab');
    expect(client.makeConnection).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Tab', 'Added', 'ConnectedBoth');
  });

  it('holds the files while it makes, and says why on the row when the plan could not be made', async () => {
    let fail!: (e: unknown) => void;
    const { client, props } = setup({ offer: BESIDE_OFFERS.plan });
    client.makeBeside.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    await screen.findByText('Launch plan');
    fireEvent.click(screen.getByText('Make a plan beside it'));
    await waitFor(() =>
      expect(
        document.querySelector('[data-connect-offer]')!.getAttribute('data-connect-state'),
      ).toBe('busy'),
    );
    expect(screen.getByText('Making')).toBeTruthy();
    expect(
      document.querySelector('[data-connect-row="p1"]')!.getAttribute('data-connect-state'),
    ).toBe('waiting');
    // A second press while it runs makes nothing more.
    fireEvent.click(screen.getByText('Make a plan beside it'));
    expect(client.makeBeside).toHaveBeenCalledTimes(1);
    await act(async () => fail(new IndexError(503, 'unavailable')));
    expect(await screen.findByText('The plan could not be made just now. Try again.')).toBeTruthy();
    expect(props.onConnected).not.toHaveBeenCalled();
    expect(document.querySelector('[data-connect-offer]')!.getAttribute('data-connect-state')).toBe(
      'open',
    );
  });

  it('counts a one-way plan as a connection one way', async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    const { client } = setup({ offer: BESIDE_OFFERS.plan });
    await screen.findByText('Launch plan');
    fireEvent.click(screen.getByText('Make a plan beside it'));
    await waitFor(() => expect(track).toHaveBeenCalledWith('Tab', 'Added', 'Connected'));
    expect(client.makeBeside.mock.calls[0]![1]).toMatchObject({ level: 'edit', both: false });
  });

  it('waits while a file connects', async () => {
    const { client } = setup({ offer: BESIDE_OFFERS.plan });
    client.makeConnection.mockImplementation(() => new Promise(() => {}));
    fireEvent.click(await screen.findByText('Launch plan'));
    await waitFor(() =>
      expect(
        document.querySelector('[data-connect-offer]')!.getAttribute('data-connect-state'),
      ).toBe('waiting'),
    );
    fireEvent.click(screen.getByText('Make a plan beside it'));
    expect(client.makeBeside).not.toHaveBeenCalled();
  });

  it('makes nothing without the host grant', async () => {
    const { client } = setup({ offer: BESIDE_OFFERS.plan, grant: () => Promise.resolve(null) });
    await screen.findByText('Launch plan');
    fireEvent.click(screen.getByText('Make a plan beside it'));
    expect(
      await screen.findByText('Could not connect it. Check your connection and try again.'),
    ).toBeTruthy();
    expect(client.makeBeside).not.toHaveBeenCalled();
  });
});

describe('useTickingNow', () => {
  it('ticks once a minute and stops when unmounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { result, unmount } = renderHook(() => useTickingNow());
    expect(result.current).toBe(NOW);
    act(() => {
      vi.advanceTimersByTime(CONNECT_CLOCK_MS);
    });
    expect(result.current).toBe(NOW + CONNECT_CLOCK_MS);
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
