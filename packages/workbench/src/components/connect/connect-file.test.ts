// One connect (connected-tabs.md "Connecting"): made, then added; a failed add is taken back (#571).
import { describe, expect, it, vi } from 'vitest';
import { IndexError, type ConnectionMade } from '@liveworkspace/index-client';
import { connectFile } from './connect-file';

const made: ConnectionMade = {
  connection: { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'plan1' },
  name: 'Launch plan',
  level: 'edit',
  reverse: null,
};

const clientWith = (over: Partial<Record<'make' | 'takeBack', Error>> = {}) => ({
  makeConnection: vi.fn(async () => {
    if (over.make) throw over.make;
    return made;
  }),
  takeBackConnection: vi.fn(async () => {
    if (over.takeBack) throw over.takeBack;
  }),
});

const run = (client: ReturnType<typeof clientWith>, addTab: (m: ConnectionMade) => Promise<void>) =>
  connectFile({
    client,
    hostId: 'doc1',
    grant: 'grant',
    tabId: 'tab9',
    targetId: 'plan1',
    level: 'participate',
    both: true,
    addTab,
  });

describe('connectFile', () => {
  it('makes the connection with the host grant, then adds the tab', async () => {
    const client = clientWith();
    const addTab = vi.fn(async () => {});
    await expect(run(client, addTab)).resolves.toBe(made);
    expect(client.makeConnection).toHaveBeenCalledWith(
      'doc1',
      { targetId: 'plan1', tabId: 'tab9', level: 'participate', both: true },
      'grant',
    );
    expect(addTab).toHaveBeenCalledWith(made);
    expect(client.takeBackConnection).not.toHaveBeenCalled();
  });

  it('adds nothing when the index refuses', async () => {
    const refusal = new IndexError(409, 'connection_limit');
    const client = clientWith({ make: refusal });
    const addTab = vi.fn(async () => {});
    await expect(run(client, addTab)).rejects.toBe(refusal);
    expect(addTab).not.toHaveBeenCalled();
    expect(client.takeBackConnection).not.toHaveBeenCalled();
  });

  it('takes the connection back when the tab add fails, and reports the add', async () => {
    const client = clientWith();
    const failure = new Error('save failed');
    await expect(
      run(client, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(client.takeBackConnection).toHaveBeenCalledWith('cn_abcdefghijklmnopqrstuvwx', 'grant');
  });

  it('still reports the add when the take-back fails too', async () => {
    const client = clientWith({ takeBack: new TypeError('offline') });
    const failure = new Error('save failed');
    await expect(
      run(client, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
