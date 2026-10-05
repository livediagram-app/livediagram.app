import { describe, expect, it } from 'vitest';
import { createApiClient } from '@livediagram/api-client';
import { DOCUMENT_TRASHED_CLOSE } from '@livediagram/api-schema';
import { fakeIo, type Route } from '../testing/fake-io';
import { openRoomStream, ROOM_RECONNECT_MAX_MS, ROOM_RECONNECT_MIN_MS } from './room-stream';

// docs/specs/015-api/blueprints/cli.md "The room stream", CLI32.

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setUp(tickets: Route) {
  const io = fakeIo({ routes: [tickets] });
  const api = createApiClient({
    baseUrl: 'https://livediagram.app/api',
    headers: () => ({}),
    fetch: io.fetch,
  });
  const ops: unknown[] = [];
  const notices: string[] = [];
  const logs: string[] = [];
  let reconnected = 0;
  const stream = openRoomStream({
    io,
    api,
    apiBase: 'https://livediagram.app/api',
    documentId: 'd 1',
    log: (l) => void logs.push(l),
    notice: (l) => void notices.push(l),
    onOp: (op) => void ops.push(op),
    onReconnected: () => void reconnected++,
  });
  return { io, stream, ops, notices, logs, reconnected: () => reconnected };
}

let minted = 0;
const ticketing: Route = (request, url) =>
  request.method === 'POST' && url.pathname === '/api/documents/d%201/room-ticket'
    ? Response.json({ ticket: `t${++minted}` })
    : undefined;

describe('openRoomStream', () => {
  it('opens a socket with a fresh ticket and passes on each op, sending nothing', async () => {
    const { io, ops, logs, stream } = setUp(ticketing);
    await tick();
    const socket = io.sockets[0]!;
    expect(socket.url).toMatch(/^wss:\/\/livediagram\.app\/api\/documents\/d%201\/ws\?t=t\d+$/);
    socket.open();
    socket.send({ kind: 'presence', participants: [] });
    socket.send({ kind: 'op', from: 'p', op: { kind: 'tab', tabId: 't1' } });
    socket.send({ kind: 'op' });
    socket.send({ kind: 'facilitator' });
    socket.send(null);
    expect(ops).toEqual([{ kind: 'tab', tabId: 't1' }]);
    stream.stop();
    expect(socket.closedWith).toBe(1000);
    expect(await stream.ended).toBe('stopped');
    expect(logs).toContain('room open');
  });

  it('logs a frame that is not JSON and carries on', async () => {
    const { io, logs } = setUp(ticketing);
    await tick();
    io.sockets[0]!.sendRaw('{not json');
    expect(logs).toContain('room frame not JSON');
  });

  it('reconnects a dropped socket with a fresh ticket, backing off and saying so', async () => {
    const { io, notices, reconnected, stream } = setUp(ticketing);
    await tick();
    io.sockets[0]!.open();
    io.sockets[0]!.drop(1006);
    expect(notices).toEqual(['reconnecting…']);
    await io.advance(ROOM_RECONNECT_MIN_MS);
    await tick();
    expect(io.sockets).toHaveLength(2);
    io.sockets[1]!.drop(1011);
    await io.advance(ROOM_RECONNECT_MIN_MS * 2);
    await tick();
    io.sockets[2]!.open();
    expect(reconnected()).toBe(1);
    expect(io.sockets[2]!.url).not.toBe(io.sockets[0]!.url);
    stream.stop();
  });

  it('caps the backoff, and retries a ticket the network lost', async () => {
    let calls = 0;
    const { io, logs, stream } = setUp((request, url) =>
      ++calls <= 7 ? Response.json({}, { status: 503 }) : ticketing(request, url),
    );
    await tick();
    for (let i = 0; i < 7; i++) {
      await io.advance(ROOM_RECONNECT_MAX_MS);
      await tick();
    }
    expect(
      logs.filter((l) => l.startsWith('room reconnect in')).map((l) => Number(l.split(' ')[3])),
    ).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(io.sockets).toHaveLength(1);
    stream.stop();
  });

  it('cancels a pending reconnect when stopped', async () => {
    const { io, stream } = setUp(() => Response.json({}, { status: 503 }));
    await tick();
    stream.stop();
    stream.stop();
    await io.advance(ROOM_RECONNECT_MAX_MS);
    expect(io.requests).toHaveLength(1);
  });

  it('ends when the document goes to the Trash', async () => {
    const { io, stream } = setUp(ticketing);
    await tick();
    io.sockets[0]!.drop(DOCUMENT_TRASHED_CLOSE);
    expect(await stream.ended).toBe('trashed');
    stream.stop();
  });

  it('fails when the ticket is refused', async () => {
    const { stream } = setUp(() => Response.json({ error: 'not_found' }, { status: 404 }));
    await expect(stream.ended).rejects.toMatchObject({ status: 404 });
  });

  it('opens nothing when stopped while the ticket is on its way, and ignores a late ticket failure', async () => {
    const first = setUp(ticketing);
    first.stream.stop();
    await tick();
    expect(first.io.sockets).toHaveLength(0);
    const second = setUp(() => Response.json({}, { status: 500 }));
    second.stream.stop();
    await tick();
    expect(second.notices).toEqual([]);
    expect(await second.stream.ended).toBe('stopped');
  });
});
