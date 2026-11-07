// Opening a connected tab (connected-tabs.md "Opening"): the index says where, the same app in place, another in a new
// browser tab, a refusal as its state.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type ConnectionOpen } from '@liveworkspace/index-client';
import { openConnectedTab } from './open-connected-tab';

const connection = {
  id: 'cn_abcdefghijklmnopqrstuvwx',
  app: 'liveplanner',
  itemId: 'plan1',
} as const;
const answer = (app: ConnectionOpen['app']): ConnectionOpen => ({
  app,
  itemId: 'plan1',
  name: 'Launch plan (renamed)',
  href: 'https://www.liveplanner.app/s/code',
  via: 'link',
  level: 'edit',
  preview: '/api/previews/share/code/image.svg',
});

afterEach(() => vi.unstubAllGlobals());

describe('openConnectedTab', () => {
  it('opens another app in a new browser tab and offers Open Again', async () => {
    const navigate = { assign: vi.fn(), openNew: vi.fn() };
    const client = { openConnection: vi.fn(async () => answer('liveplanner')) };
    const result = await openConnectedTab({
      client,
      connection,
      grant: 'g',
      hostApp: 'livediagram',
      navigate,
    });
    expect(client.openConnection).toHaveBeenCalledWith(connection.id, 'g', {});
    expect(navigate.openNew).toHaveBeenCalledWith('https://www.liveplanner.app/s/code');
    expect(navigate.assign).not.toHaveBeenCalled();
    expect(result.view).toEqual({ state: 'opened', href: 'https://www.liveplanner.app/s/code' });
    expect(result.open?.name).toBe('Launch plan (renamed)');
  });

  it('opens the same app in place', async () => {
    const navigate = { assign: vi.fn(), openNew: vi.fn() };
    const client = { openConnection: vi.fn(async () => answer('livediagram')) };
    const signal = new AbortController().signal;
    const result = await openConnectedTab({
      client,
      connection,
      grant: 'g',
      hostApp: 'livediagram',
      signal,
      navigate,
    });
    expect(client.openConnection).toHaveBeenCalledWith(connection.id, 'g', { signal });
    expect(navigate.assign).toHaveBeenCalledWith('https://www.liveplanner.app/s/code');
    expect(result.view).toEqual({ state: 'opening' });
  });

  it('answers a refusal as its state, going nowhere', async () => {
    const navigate = { assign: vi.fn(), openNew: vi.fn() };
    const client = {
      openConnection: vi.fn(async () => {
        throw new IndexError(410, 'connection_link_removed');
      }),
    };
    const result = await openConnectedTab({
      client,
      connection,
      grant: 'g',
      hostApp: 'livediagram',
      navigate,
    });
    expect(result).toEqual({ view: { state: 'link_removed' }, open: null });
    expect(navigate.assign).not.toHaveBeenCalled();
    expect(navigate.openNew).not.toHaveBeenCalled();
  });

  it('goes through the browser by default, with no handle back to this page', async () => {
    const open = vi.fn(() => null);
    vi.stubGlobal('window', { open, location: { assign: vi.fn() } });
    const client = { openConnection: vi.fn(async () => answer('liveplanner')) };
    await openConnectedTab({ client, connection, grant: 'g', hostApp: 'livediagram' });
    expect(open).toHaveBeenCalledWith('https://www.liveplanner.app/s/code', '_blank', 'noopener');
    const assign = vi.fn();
    vi.stubGlobal('window', { open, location: { assign } });
    await openConnectedTab({
      client: { openConnection: vi.fn(async () => answer('livediagram')) },
      connection,
      grant: 'g',
      hostApp: 'livediagram',
    });
    expect(assign).toHaveBeenCalledWith('https://www.liveplanner.app/s/code');
  });
});
