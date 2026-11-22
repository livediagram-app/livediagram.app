// Where each connected row leads (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar"):
// asked once a connection for the session, a few at once, and each way an ask ends.
import { describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';
import {
  CONNECTED_ROW_STORES,
  connectedRowStoreFor,
  createConnectedRowStore,
  rowStateOfError,
} from './connected-row-store';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeClient() {
  const asked: string[] = [];
  const waiting = new Map<string, (answer: unknown) => void>();
  const client = {
    openConnection: vi.fn((id: string) => {
      asked.push(id);
      return new Promise((resolve, reject) =>
        waiting.set(id, (answer) => (answer instanceof Error ? reject(answer) : resolve(answer))),
      );
    }),
  };
  return { client, asked, answer: (id: string, value: unknown) => waiting.get(id)?.(value) };
}

describe('the connected row store', () => {
  it('asks a connection once, with the grant, and keeps the answer', async () => {
    const { client, asked, answer } = fakeClient();
    const store = createConnectedRowStore(client as never);
    store.setGrant(async () => 'grant');
    expect(store.stateOf('cn_a')).toEqual({ kind: 'asking' });
    store.request('cn_a');
    store.request('cn_a');
    await flush();
    expect(asked).toEqual(['cn_a']);
    expect(client.openConnection).toHaveBeenCalledWith('cn_a', 'grant');
    answer('cn_a', { app: 'liveplanner', name: 'Launch Plan', href: 'https://x.example/p' });
    await flush();
    expect(store.stateOf('cn_a')).toEqual({
      kind: 'ready',
      href: 'https://x.example/p',
      name: 'Launch Plan',
    });
    store.request('cn_a');
    await flush();
    expect(asked).toEqual(['cn_a']);
  });

  it('runs a few asks at once and the rest after them', async () => {
    const { client, asked, answer } = fakeClient();
    const store = createConnectedRowStore(client as never, 2);
    store.setGrant(async () => 'grant');
    for (const id of ['a', 'b', 'c', 'd']) store.request(id);
    await flush();
    expect(asked).toEqual(['a', 'b']);
    answer('a', { app: 'livediagram', name: 'A', href: 'https://x.example/a' });
    await flush();
    await flush();
    expect(asked).toEqual(['a', 'b', 'c']);
  });

  it('says why a row opens nothing, and keeps a passing failure plain', () => {
    expect(rowStateOfError(new IndexError(410, 'connection_target_gone'))).toEqual({
      kind: 'broken',
      reason: 'gone',
    });
    expect(rowStateOfError(new IndexError(410, 'connection_link_removed'))).toEqual({
      kind: 'broken',
      reason: 'link_removed',
    });
    expect(rowStateOfError(new IndexError(404, 'not_found'))).toEqual({
      kind: 'broken',
      reason: 'copy',
    });
    expect(rowStateOfError(new Error('offline'))).toEqual({ kind: 'failed' });
  });

  it('fails without a grant, and asks again on resolve', async () => {
    const { client, answer } = fakeClient();
    const store = createConnectedRowStore(client as never);
    store.request('cn_a');
    await flush();
    expect(store.stateOf('cn_a')).toEqual({ kind: 'failed' });
    store.setGrant(async () => 'grant');
    const again = store.resolve('cn_a');
    await flush();
    answer('cn_a', { app: 'livediagram', name: 'A', href: 'https://x.example/a' });
    expect(await again).toMatchObject({ kind: 'ready' });
  });

  it('notifies its readers when an answer lands', async () => {
    const { client, answer } = fakeClient();
    const store = createConnectedRowStore(client as never);
    store.setGrant(async () => 'grant');
    const heard = vi.fn();
    store.subscribe(heard);
    store.request('cn_a');
    await flush();
    answer('cn_a', new IndexError(410, 'connection_target_gone'));
    await flush();
    expect(heard).toHaveBeenCalled();
    expect(store.stateOf('cn_a')).toEqual({ kind: 'broken', reason: 'gone' });
  });

  it('keeps one store a knowledgebase, for the last few opened', () => {
    const { client } = fakeClient();
    const first = connectedRowStoreFor('kb-0', client as never);
    expect(connectedRowStoreFor('kb-0', client as never)).toBe(first);
    for (let i = 1; i <= CONNECTED_ROW_STORES; i++)
      connectedRowStoreFor(`kb-${i}`, client as never);
    expect(connectedRowStoreFor('kb-0', client as never)).not.toBe(first);
  });
});
