// @vitest-environment jsdom

// The doors every editor shares (connected-tabs.md "Connecting", "Opening"): the add after the save, the empty start
// tab given way, the move to the new tab and its toast, Connect Again and its failure, the grant and the Connected map.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type ConnectionMade } from '@liveworkspace/index-client';
import { useConnectedTabActions, type ConnectedTabActionsDeps } from './useConnectedTabActions';
import { resetConnectedTabStoreForTests } from './connected-tab-store';

afterEach(() => resetConnectedTabStoreForTests());

type Tab = { id: string; name: string; connection?: unknown };
const A = { id: 'cn_aaaaaaaaaaaaaaaaaaaaaaaa', app: 'liveplanner', itemId: 'p1' } as const;
const B = { id: 'cn_bbbbbbbbbbbbbbbbbbbbbbbb', app: 'liveplanner', itemId: 'p1' } as const;
const made = (over: Partial<ConnectionMade> = {}): ConnectionMade => ({
  connection: A,
  name: 'Launch plan',
  level: 'edit',
  reverse: null,
  ...over,
});

const setup = (tabs: Tab[], over: Partial<ConnectedTabActionsDeps<Tab>> = {}) => {
  let list = tabs;
  const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
  const deps: ConnectedTabActionsDeps<Tab> = {
    tabs,
    hostKind: 'canvas',
    documentId: 'host',
    grantFor: vi.fn().mockResolvedValue('grant'),
    createTab: (name) => ({ id: 'minted', name }),
    saveTab: vi.fn().mockResolvedValue(undefined),
    commitTabs: (map) => {
      list = map(list);
    },
    markTabLoaded: vi.fn(),
    openTab: vi.fn(),
    toast,
    ...over,
  };
  const hook = renderHook((d: ConnectedTabActionsDeps<Tab>) => useConnectedTabActions(d), {
    initialProps: deps,
  });
  return { hook, deps, toast, tabs: () => list };
};

describe('useConnectedTabActions', () => {
  it('saves the new tab whole, then appends it, giving way to the empty start tab', async () => {
    const { hook, deps, tabs } = setup([
      { id: 't1', name: 'Tab 1' },
      { id: 'blank', name: 'Tab 2' },
    ]);
    await act(() => hook.result.current.addConnectedTab(made(), 'new', 'blank'));
    expect(deps.saveTab).toHaveBeenCalledWith({ id: 'new', name: 'Launch plan', connection: A });
    expect(tabs().map((t) => t.id)).toEqual(['t1', 'new']);
    expect(deps.markTabLoaded).toHaveBeenCalledWith('new');
  });

  it("keeps the item's only tab and appends beside it", async () => {
    const { hook, tabs } = setup([{ id: 'only', name: 'Tab 1' }]);
    await act(() => hook.result.current.addConnectedTab(made(), 'new', 'only'));
    expect(tabs().map((t) => t.id)).toEqual(['only', 'new']);
  });

  it('adds nothing when the save fails', async () => {
    const { hook, tabs } = setup([{ id: 't1', name: 'Tab 1' }], {
      saveTab: vi.fn().mockRejectedValue(new Error('down')),
    });
    await expect(hook.result.current.addConnectedTab(made(), 'new')).rejects.toThrow('down');
    expect(tabs()).toHaveLength(1);
  });

  it('opens the new tab, and says when the other file had no tab back', () => {
    const { hook, deps, toast } = setup([]);
    hook.result.current.showConnected('new', made());
    expect(deps.openTab).toHaveBeenCalledWith('new');
    expect(toast.info).not.toHaveBeenCalled();
    hook.result.current.showConnected('new', made({ reverse: { state: 'unreached' } }));
    expect(toast.info).toHaveBeenCalledWith(
      '“Launch plan” could not be reached, so it has no tab back here.',
    );
    hook.result.current.showConnected('new', made({ name: ' ', reverse: { state: 'unreached' } }));
    expect(toast.info).toHaveBeenLastCalledWith(
      'The other file could not be reached, so it has no tab back here.',
    );
  });

  it('connects a tab again in place, with its new connection and name', async () => {
    const client = {
      makeConnection: vi.fn().mockResolvedValue(made({ connection: B, name: 'Launch plan v2' })),
      takeBackConnection: vi.fn(),
    };
    const { hook, deps, tabs, toast } = setup(
      [
        { id: 't1', name: 'Tab 1' },
        { id: 'c', name: 'Launch plan', connection: A },
      ],
      { client },
    );
    await act(() => hook.result.current.connectAgainTab('c'));
    expect(client.makeConnection).toHaveBeenCalledWith(
      'host',
      { targetId: 'p1', tabId: 'c', level: 'edit', both: false },
      'grant',
    );
    expect(deps.saveTab).toHaveBeenCalledWith({ id: 'c', name: 'Launch plan v2', connection: B });
    expect(tabs()[1]).toEqual({ id: 'c', name: 'Launch plan v2', connection: B });
    expect(tabs()[0]).toEqual({ id: 't1', name: 'Tab 1' });
    expect(toast.success).toHaveBeenCalledWith('“Launch plan v2” is connected again.');
  });

  it('says why Connect Again failed, and ignores a tab of content', async () => {
    const client = {
      makeConnection: vi.fn().mockRejectedValue(new IndexError(409, 'share_link_limit')),
      takeBackConnection: vi.fn(),
    };
    const { hook, toast } = setup(
      [
        { id: 'plain', name: 'Tab 1' },
        { id: 'c', name: '', connection: A },
      ],
      { client },
    );
    await act(() => hook.result.current.connectAgainTab('plain'));
    expect(client.makeConnection).not.toHaveBeenCalled();
    await act(() => hook.result.current.connectAgainTab('c'));
    expect(toast.error).toHaveBeenCalledWith(
      'This file has too many links already. Remove one in its Share first.',
    );
  });

  it('says the file is connected again when it has no name', async () => {
    const client = {
      makeConnection: vi.fn().mockResolvedValue(made({ name: '' })),
      takeBackConnection: vi.fn(),
    };
    const { hook, toast } = setup([{ id: 'c', name: 'x', connection: A }], { client });
    await act(() => hook.result.current.connectAgainTab('c'));
    expect(toast.success).toHaveBeenCalledWith('The file is connected again.');
  });

  it('asks the host grant for the open item, none without one, and maps the connected tabs', async () => {
    const { hook, deps } = setup([{ id: 'c', name: 'x', connection: A }]);
    await expect(hook.result.current.grant()).resolves.toBe('grant');
    expect(deps.grantFor).toHaveBeenCalledWith('host');
    expect([...hook.result.current.connected]).toEqual([['p1', 'c']]);
    hook.result.current.goTo('c');
    expect(deps.openTab).toHaveBeenCalledWith('c');
    hook.rerender({ ...deps, documentId: null });
    await expect(hook.result.current.grant()).resolves.toBeNull();
    await act(() => hook.result.current.connectAgainTab('c'));
  });
});
