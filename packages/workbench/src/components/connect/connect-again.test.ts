// Connect Again (connected-tabs.md "Opening"): the same target in the same tab, at its app's default role, one way;
// the tab mended; its words when the other file was out of reach.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionMade } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { connectAgain, reverseUnreachedWords } from './connect-again';
import {
  connectedTabBroken,
  resetConnectedTabStoreForTests,
  setConnectedTabBroken,
} from './connected-tab-store';

const OLD = { id: 'cn_oldoldoldoldoldoldoldo', app: 'livehuddle', itemId: 'space1' } as const;
const made: ConnectionMade = {
  connection: { id: 'cn_newnewnewnewnewnewnewn', app: 'livehuddle', itemId: 'space1' },
  name: 'Standup',
  level: 'edit',
  reverse: null,
};

afterEach(() => {
  resetConnectedTabStoreForTests();
  configureWorkbench(WORKBENCH_DEFAULTS);
});

describe('connectAgain', () => {
  it("connects the same file into the same tab at its app's default role, and mends the tab", async () => {
    const track = vi.fn();
    configureWorkbench(testBindings({ track }));
    setConnectedTabBroken(OLD.id, true);
    const client = {
      makeConnection: vi.fn().mockResolvedValue(made),
      takeBackConnection: vi.fn(),
    };
    const addTab = vi.fn().mockResolvedValue(undefined);
    const answer = await connectAgain({
      client,
      hostId: 'host',
      grant: () => Promise.resolve('g'),
      tabId: 't1',
      connection: OLD,
      addTab,
    });
    expect(answer).toBe(made);
    expect(client.makeConnection).toHaveBeenCalledWith(
      'host',
      { targetId: 'space1', tabId: 't1', level: 'edit', both: false },
      'g',
    );
    expect(addTab).toHaveBeenCalledWith(made);
    expect(connectedTabBroken(OLD.id)).toBe(false);
    expect(track).toHaveBeenCalledWith('Tab', 'Added', 'ConnectedAgain');
  });

  it('asks nothing of the index without a grant', async () => {
    const client = { makeConnection: vi.fn(), takeBackConnection: vi.fn() };
    await expect(
      connectAgain({
        client,
        hostId: 'host',
        grant: () => Promise.resolve(null),
        tabId: 't1',
        connection: OLD,
        addTab: vi.fn(),
      }),
    ).rejects.toThrow('no grant');
    expect(client.makeConnection).not.toHaveBeenCalled();
  });
});

describe('reverseUnreachedWords', () => {
  it('says the other file has no tab back', () => {
    expect(reverseUnreachedWords('“Plan”')).toBe(
      '“Plan” could not be reached, so it has no tab back here.',
    );
  });
});
