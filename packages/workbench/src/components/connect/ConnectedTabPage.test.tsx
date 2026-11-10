// @vitest-environment jsdom

// A connected tab's page (connected-tabs.md "Opening", "How it looks"): ready, with the preview and Open, however the
// tab became the open one; only Open (or Try Again) opens the file, and an open's answer picks the card, marks the tab
// broken or mended, and renames it for an Editor only.
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type ConnectionOpen } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { ConnectedTabPage, type ConnectedTabPageProps } from './ConnectedTabPage';
import {
  connectedTabBroken,
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
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

const setup = (over: Partial<ConnectedTabPageProps> = {}, strict = false) => {
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

  it('goes nowhere by itself when its tab is opened, its Open a button a keyboard reaches', async () => {
    const { client, navigate, state } = setup();
    // A press on the tab, a load or a connect only mounts the page: it waits for Open.
    await act(async () => {
      await Promise.resolve();
    });
    expect(state()).toBe('ready');
    expect(client.openConnection).not.toHaveBeenCalled();
    expect(navigate.openNew).not.toHaveBeenCalled();
    expect(navigate.assign).not.toHaveBeenCalled();
    const open = screen.getByRole('button', { name: 'Open in liveplanner' });
    expect(open.tagName).toBe('BUTTON');
    open.focus();
    expect(document.activeElement).toBe(open);
  });

  it('waits, ready, when mounted twice at once (React Strict Mode), and Open goes once', async () => {
    const { client, navigate, state } = setup({ hostApp: 'liveplanner' }, true);
    expect(state()).toBe('ready');
    expect(client.openConnection).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(navigate.assign).toHaveBeenCalledWith(OPEN.href));
    expect(navigate.assign).toHaveBeenCalledTimes(1);
    expect(state()).toBe('opening');
  });

  it('offers Open Again once opened, without asking again', async () => {
    const { client, state } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(screen.getByRole('link', { name: 'Open Again' }).getAttribute('href')).toBe(OPEN.href);
    expect(screen.queryByRole('button', { name: 'Open in liveplanner' })).toBeNull();
    expect(client.openConnection).toHaveBeenCalledTimes(1);
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

  it('marks a broken connection and offers its mends to an Editor', async () => {
    const openConnection = vi
      .fn()
      .mockRejectedValueOnce(new IndexError(410, 'connection_link_removed'));
    const { props, state } = setup({ client: { openConnection } });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('link_removed'));
    expect(connectedTabBroken(CONNECTION.id)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Again' }));
    expect(props.onConnectAgain).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Tab' }));
    expect(props.onRemove).toHaveBeenCalled();
  });

  it('clears a mark an earlier open left once Open opens it', async () => {
    setConnectedTabBroken(CONNECTION.id, true);
    const { state } = setup();
    expect(state()).toBe('ready');
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(connectedTabBroken(CONNECTION.id)).toBe(false);
  });

  it('says so when the host is offline, or the browser is', async () => {
    const offline = setup({ offline: true });
    expect(offline.state()).toBe('offline');
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
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

  it('drops an index answer that lands after the page went', async () => {
    let answer: (value: ConnectionOpen) => void = () => {};
    const openConnection = vi.fn(
      () => new Promise<ConnectionOpen>((resolve) => (answer = resolve)),
    );
    const { navigate, props, view } = setup({ client: { openConnection } });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(openConnection).toHaveBeenCalledTimes(1));
    view.unmount();
    answer(OPEN);
    await act(async () => {
      await Promise.resolve();
    });
    expect(navigate.openNew).not.toHaveBeenCalled();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it("goes through the browser's own navigator when none is handed in", async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { state } = setup({ navigate: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Open in liveplanner' }));
    await waitFor(() => expect(state()).toBe('opened'));
    expect(open).toHaveBeenCalledWith(OPEN.href, '_blank', 'noopener');
  });
});
