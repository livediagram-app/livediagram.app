// @vitest-environment jsdom

// A connected tab's page (connected-tabs.md "Opening", "How it looks"): ready until a person asks, a fresh press opens
// it at once, an open's answer picks the card, marks the tab broken or mended, and renames it for an Editor only.
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type ConnectionOpen } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { ConnectedTabPage, type ConnectedTabPageProps } from './ConnectedTabPage';
import {
  CONNECTED_PICK_FRESH_MS,
  connectedTabBroken,
  pickConnectedTab,
  resetConnectedTabStoreForTests,
} from './connected-tab-store';

// The card's picture asks the index on its own (useConnectedPreview, its own tests): kept out of these counts.
vi.mock('./useConnectedPreview', () => ({ useConnectedPreview: () => ({ state: 'none' }) }));

afterEach(() => {
  cleanup();
  resetConnectedTabStoreForTests();
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.restoreAllMocks();
});

const CONNECTION = { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'p1' } as const;
const OPEN: ConnectionOpen = {
  app: 'liveplanner',
  itemId: 'p1',
  name: 'Launch plan v2',
  href: 'https://www.liveplanner.app/s/code',
  via: 'link',
  level: 'edit',
  preview: '/api/previews/share/code/image.svg',
};

const setup = (over: Partial<ConnectedTabPageProps> = {}, { strict = false } = {}) => {
  const navigate = { assign: vi.fn(), openNew: vi.fn() };
  const client = { openConnection: vi.fn().mockResolvedValue(OPEN) };
  const props: ConnectedTabPageProps = {
    tabId: 't1',
    name: 'Launch plan',
    connection: CONNECTION,
    hostApp: 'livediagram',
    offline: false,
    canEdit: true,
    grant: () => Promise.resolve('grant'),
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onConnectAgain: vi.fn(),
    client,
    navigate,
    ...over,
  };
  const page = <ConnectedTabPage {...props} />;
  const view = render(strict ? <StrictMode>{page}</StrictMode> : page);
  const state = () =>
    view.container
      .querySelector('[data-connected-tab-page]')
      ?.getAttribute('data-connected-tab-page');
  return { props, client, navigate, view, state };
};

describe('ConnectedTabPage', () => {
  it('waits, ready, when nobody asked, and opens on Open', async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    const { client, navigate, state, props } = setup();
    expect(state()).toBe('ready');
    expect(screen.getByText('A connected liveplanner file.')).toBeTruthy();
    expect(client.openConnection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(client.openConnection).toHaveBeenCalledWith(
      CONNECTION.id,
      'grant',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(navigate.openNew).toHaveBeenCalledWith(OPEN.href);
    expect(track).toHaveBeenCalledWith('Tab', 'Opened', 'Connected');
    // An Editor's tab takes the file's current name (IDX26).
    expect(props.onRename).toHaveBeenCalledWith('Launch plan v2');
  });

  it('opens at once for a press made just before it mounted, and not for a stale one', async () => {
    pickConnectedTab('t1');
    const fresh = setup();
    expect(fresh.state()).toBe('opening');
    await waitFor(() => expect(fresh.state()).toBe('opened'));
    cleanup();
    resetConnectedTabStoreForTests();
    pickConnectedTab('t1', Date.now() - CONNECTED_PICK_FRESH_MS - 1);
    const stale = setup();
    expect(stale.state()).toBe('ready');
    expect(stale.client.openConnection).not.toHaveBeenCalled();
  });

  // React's development double mount (StrictMode) unmounts the page once and mounts it again: the first open, cut off
  // by that unmount, must not leave the card turning on "Opening" for good.
  it('still opens a fresh press when the page is mounted twice, as StrictMode does', async () => {
    pickConnectedTab('t1');
    const { client, navigate, state } = setup({}, { strict: true });
    await waitFor(() => expect(state()).toBe('opened'));
    expect(navigate.openNew).toHaveBeenCalledTimes(1);
    expect(client.openConnection).toHaveBeenCalledTimes(1);
  });

  it('opens again on each new press of its tab', async () => {
    const { client, state } = setup();
    act(() => pickConnectedTab('t1'));
    await waitFor(() => expect(state()).toBe('opened'));
    act(() => pickConnectedTab('t1'));
    await waitFor(() => expect(client.openConnection).toHaveBeenCalledTimes(2));
  });

  it('opens a file in the same app in place, and never renames for a Participant or Viewer', async () => {
    const same = { ...OPEN, app: 'livediagram' as const, name: 'Other' };
    const { navigate, props } = setup({
      canEdit: false,
      connection: { ...CONNECTION, app: 'livediagram' },
      client: { openConnection: vi.fn().mockResolvedValue(same) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(navigate.assign).toHaveBeenCalledWith(same.href));
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('keeps the name when it already matches', async () => {
    const { props, state } = setup({ name: 'Launch plan v2' });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('marks a broken connection, offers its mends to an Editor, and clears the mark once it opens', async () => {
    const openConnection = vi
      .fn()
      .mockRejectedValueOnce(new IndexError(410, 'connection_link_removed'))
      .mockResolvedValueOnce(OPEN);
    const { props, state } = setup({ client: { openConnection } });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('link_removed'));
    expect(connectedTabBroken(CONNECTION.id)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Again' }));
    expect(props.onConnectAgain).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tab' }));
    expect(props.onRemove).toHaveBeenCalled();
    act(() => pickConnectedTab('t1'));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(connectedTabBroken(CONNECTION.id)).toBe(false);
  });

  it('says so when the host is offline, or the browser is', async () => {
    const offline = setup({ offline: true });
    expect(offline.state()).toBe('offline');
    act(() => pickConnectedTab('t1'));
    expect(offline.client.openConnection).not.toHaveBeenCalled();
    cleanup();
    resetConnectedTabStoreForTests();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const browser = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(browser.state()).toBe('offline'));
    expect(browser.client.openConnection).not.toHaveBeenCalled();
  });

  it('cannot open without a grant, and Try Again asks again', async () => {
    const grant = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('grant');
    const { state, client } = setup({ grant });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('failed'));
    expect(client.openConnection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(state()).toBe('opened'));
  });

  it('drops an answer that lands after it was unmounted or overtaken', async () => {
    let release: (value: string) => void = () => {};
    const grant = () => new Promise<string>((resolve) => (release = resolve));
    const { client, view } = setup({ grant });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    view.unmount();
    release('grant');
    await Promise.resolve();
    expect(client.openConnection).not.toHaveBeenCalled();
  });

  it('drops an open overtaken by a newer one', async () => {
    let first: (value: ConnectionOpen) => void = () => {};
    const openConnection = vi
      .fn()
      .mockImplementationOnce(() => new Promise<ConnectionOpen>((resolve) => (first = resolve)))
      .mockResolvedValueOnce(OPEN);
    const { navigate, state } = setup({ client: { openConnection } });
    act(() => pickConnectedTab('t1'));
    await waitFor(() => expect(openConnection).toHaveBeenCalledTimes(1));
    act(() => pickConnectedTab('t1'));
    await waitFor(() => expect(state()).toBe('opened'));
    first(OPEN);
    await Promise.resolve();
    expect(navigate.openNew).toHaveBeenCalledTimes(1);
  });

  it("goes through the browser's own navigator when none is handed in", async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { state } = setup({ navigate: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(open).toHaveBeenCalledWith(OPEN.href, '_blank', 'noopener');
  });
});
