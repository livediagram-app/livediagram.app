import { describe, expect, it } from 'vitest';
import { DOCUMENT_TRASHED_CLOSE } from '@livediagram/api-schema';
import { WAIT_SETTLE_MS } from '../commands/wait';
import { run } from '../main';
import { fakeIo, TOKEN, type FakeIo } from '../testing/fake-io';
import { box, hostDoc, linkHost, type HostDoc } from '../testing/link-host';
import { SYNC_LOCAL_SETTLE_MS, SYNC_WATCH_COVERAGE_MS } from './constants';

// `sync --watch` (docs/specs/027-repositories/blueprints/repository-link.md "`sync --watch`"): room bursts settle
// into one pass, local changes too, own writes are ignored, coverage is read again, and Ctrl-C ends it.

const folders = [
  { id: 'games', name: 'Minigames', parentId: null, teamId: null },
  { id: 'other', name: 'Other', parentId: null, teamId: null },
];
const MIRROR = '/work/diagrams/home.livediagram.json';

function setup(docs: HostDoc[], level = 'files') {
  const host = linkHost(docs, folders);
  const io = fakeIo({
    env: { LIVEDIAGRAM_TOKEN: TOKEN },
    routes: [host.route],
    files: {
      '/work/livediagram.toml': `[covers]\nfolder = "games"\n[mirror]\nlevel = "${level}"\n`,
    },
  });
  return { host, io };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await tick();
  expect(check()).toBe(true);
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await tick();
};
const lines = (io: FakeIo) => io.out().split('\n').filter(Boolean);
const changed = (tabId: string) => ({
  kind: 'op',
  from: 'p',
  op: { kind: 'el', tabId, op: { kind: 'update', element: { id: 'b1' } } },
});
const socketOf = (io: FakeIo, id: string) =>
  io.sockets.find((s) => s.url.includes(`/documents/${id}/`))!;

describe('sync --watch', () => {
  it('passes once, then once per settled burst of room changes, until Ctrl-C', async () => {
    const { io, host } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const done = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 1);
    expect(lines(io)).toEqual([
      '08:00:00 + diagrams/home.livediagram.json  "Home" · 1 tab · rev 1 · ~ diagrams/INDEX.md',
    ]);
    socketOf(io, 'd-home').open();
    host.edit('d-home', 0, [box('b1', 'Play')]);
    socketOf(io, 'd-home').send(changed('d-home-t1'));
    await io.advance(WAIT_SETTLE_MS / 2);
    socketOf(io, 'd-home').send(changed('d-home-t1'));
    socketOf(io, 'd-home').send({ kind: 'op', from: 'p', op: { kind: 'cursor' } });
    await io.advance(WAIT_SETTLE_MS);
    await until(() => lines(io).length === 2);
    expect(lines(io)[1]).toBe(
      '08:00:03 ~ diagrams/home.livediagram.json  "Home" · Main · rev 1→2 · ~ diagrams/INDEX.md',
    );
    expect(io.fileMap.get(MIRROR)!.data).toContain('"label":"Play"');
    io.interrupt();
    expect(await done).toBe(0);
    expect(socketOf(io, 'd-home').closedWith).toBe(1000);
  });

  it('syncs a local change after it settles, ignores its own writes, and repeats no refusal', async () => {
    const { io } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const done = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 1);
    io.touch(MIRROR);
    io.touch('/work/diagrams/INDEX.md');
    await flush();
    await io.advance(SYNC_LOCAL_SETTLE_MS);
    expect(lines(io)).toHaveLength(1);
    io.fileMap.set(MIRROR, {
      data: io.fileMap.get(MIRROR)!.data.replace('box"', 'box!"'),
      mode: 0o644,
    });
    io.touch(MIRROR);
    await flush();
    await io.advance(SYNC_LOCAL_SETTLE_MS);
    await until(() => lines(io).length === 2);
    expect(lines(io)[1]).toBe(
      '08:00:03 ! diagrams/home.livediagram.json: changed here; send it: livediagram push diagrams/home.livediagram.json',
    );
    io.touch(MIRROR);
    await flush();
    await io.advance(SYNC_LOCAL_SETTLE_MS);
    await until(() => lines(io).length === 3);
    expect(lines(io)[2]).toBe('08:00:04 in step');
    io.fileMap.delete(MIRROR);
    io.touch(MIRROR);
    await flush();
    await io.advance(SYNC_LOCAL_SETTLE_MS);
    await until(() => lines(io).length === 4);
    expect(lines(io)[3]).toBe('08:00:06 + diagrams/home.livediagram.json  "Home" · 1 tab · rev 1');
    io.interrupt();
    expect(await done).toBe(0);
  });

  it('passes a document whose stream reconnects, is trashed, or is refused a ticket', async () => {
    const { io, host } = setup([
      hostDoc('d-home', 'Home', { folderId: 'games' }),
      hostDoc('d-menu', 'Menu', { folderId: 'games' }),
    ]);
    const done = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 2);
    socketOf(io, 'd-home').open();
    socketOf(io, 'd-home').drop(1006);
    await io.advance(1_000);
    await until(() => io.sockets.length === 3);
    host.edit('d-home');
    io.sockets.at(-1)!.open();
    await until(() => lines(io).length === 2);
    expect(lines(io)[1]).toContain('~ diagrams/home.livediagram.json  "Home" · Main · rev 1→2');
    host.doc('d-home').state = 'trashed';
    io.sockets.at(-1)!.drop(DOCUMENT_TRASHED_CLOSE);
    await until(() => lines(io).length === 3);
    expect(lines(io)[2]).toContain('- diagrams/home.livediagram.json  "Home" · in the Trash');
    host.doc('d-menu').state = 'purged';
    socketOf(io, 'd-menu').drop(1006);
    await io.advance(1_000);
    await until(() => lines(io).length === 4);
    expect(lines(io)[3]).toContain(
      '? diagrams/menu.livediagram.json: no document this account can open',
    );
    io.interrupt();
    expect(await done).toBe(0);
  });

  it('reads coverage again, streaming documents that entered and passing those that left', async () => {
    const { io, host } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const done = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 1);
    host.docs.push(hostDoc('d-new', 'New', { folderId: 'games' }));
    host.doc('d-home').folderId = 'other';
    await io.advance(SYNC_WATCH_COVERAGE_MS);
    await until(() => lines(io).length === 2);
    expect(lines(io)[1]).toBe(
      '08:01:00 - diagrams/home.livediagram.json  "Home" · outside the link · + diagrams/new.livediagram.json  "New" · 1 tab · rev 1 · ~ diagrams/INDEX.md',
    );
    expect(socketOf(io, 'd-home').closedWith).toBe(1000);
    expect(socketOf(io, 'd-new')).toBeDefined();
    await io.advance(SYNC_WATCH_COVERAGE_MS);
    await tick();
    expect(lines(io)).toHaveLength(2);
    io.interrupt();
    expect(await done).toBe(0);
  });

  it('carries on after a failed pass or coverage read, saying what failed', async () => {
    const { io, host } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const done = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 1);
    const route = host.route;
    let failing = true;
    io.fetch = async (request) => {
      const url = new URL(request.url);
      if (failing && url.pathname === '/api/documents')
        return Response.json({ error: 'busy' }, { status: 503 });
      if (failing && url.pathname.endsWith('/tabs/d-home-t1'))
        return Response.json({ error: 'nope' }, { status: 401 });
      return (await route(request, url)) ?? Response.json({}, { status: 404 });
    };
    await io.advance(SYNC_WATCH_COVERAGE_MS);
    await until(() => io.err().includes('failed (HTTP 503)'));
    host.edit('d-home');
    socketOf(io, 'd-home').send(changed('d-home-t1'));
    await io.advance(WAIT_SETTLE_MS);
    await until(() => io.err().includes('did not accept the credential'));
    failing = false;
    socketOf(io, 'd-home').send(changed('d-home-t1'));
    await io.advance(WAIT_SETTLE_MS);
    await until(() => lines(io).length === 2);
    io.interrupt();
    expect(await done).toBe(0);
  });

  it('ends after its first pass at none, and fails as its first pass fails', async () => {
    const none = setup([hostDoc('d-home', 'Home', { folderId: 'games' })], 'none');
    expect(await run(['sync', '--watch'], none.io)).toBe(0);
    expect(lines(none.io)).toEqual(['08:00:00 + "Home" · 1 tab · rev 1']);
    expect(none.io.sockets).toEqual([]);
    const refused = setup([]);
    const route = refused.host.route;
    refused.io.fetch = async (request) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/capabilities') return (await route(request, url))!;
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    };
    expect(await run(['sync', '--watch'], refused.io)).toBe(4);
  });
});

describe('sync --watch, stopping', () => {
  it('waits for the first pass when Ctrl-C comes during it, and cancels a pending settle', async () => {
    const early = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const done = run(['sync', '--watch'], early.io);
    await tick();
    early.io.interrupt();
    expect(await done).toBe(0);
    expect(lines(early.io)).toHaveLength(1);
    expect(early.io.sockets).toEqual([]);
    expect(early.io.fileMap.has('/home/agent/.cache/livediagram/links')).toBe(false);

    const { io } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
    const watching = run(['sync', '--watch'], io);
    await until(() => io.sockets.length === 1);
    socketOf(io, 'd-home').send(changed('d-home-t1'));
    io.touch('/work/diagrams/ghost.livediagram.json');
    await flush();
    await io.advance(SYNC_LOCAL_SETTLE_MS);
    await until(() => lines(io).length === 2);
    expect(lines(io)[1]).toBe('08:00:01 in step');
    io.interrupt();
    expect(await watching).toBe(0);
    await io.advance(WAIT_SETTLE_MS);
    expect(lines(io)).toHaveLength(2);
  });

  it('reads no coverage again once stopped', async () => {
    for (const failing of [false, true]) {
      const { io, host } = setup([hostDoc('d-home', 'Home', { folderId: 'games' })]);
      const done = run(['sync', '--watch'], io);
      await until(() => io.sockets.length === 1);
      if (failing) host.docs.length = 0;
      const route = host.route;
      io.fetch = async (request) => {
        const url = new URL(request.url);
        if (failing && url.pathname === '/api/folders') throw new TypeError('fetch failed');
        return (await route(request, url)) ?? Response.json({}, { status: 404 });
      };
      const advancing = io.advance(SYNC_WATCH_COVERAGE_MS);
      io.interrupt();
      await advancing;
      expect(await done).toBe(0);
      await flush();
      await io.advance(SYNC_WATCH_COVERAGE_MS * 2);
      expect(lines(io)).toHaveLength(1);
    }
  });
});
