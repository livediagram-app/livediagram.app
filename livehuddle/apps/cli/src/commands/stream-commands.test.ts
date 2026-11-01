import { describe, expect, it } from 'vitest';
import { DOCUMENT_TRASHED_CLOSE, type DocumentCommentThread } from '@livediagram/api-schema';
import { run } from '../main';
import { capabilities, fakeIo, NOW, TOKEN, type FakeIo, type Route } from '../testing/fake-io';
import { DEFAULT_PROFILE } from '../config/profiles';
import { fileReadCopies } from '../sync/read-copies';
import { WAIT_SETTLE_MS } from './wait';

// `wait` and `watch` through the whole command (docs/specs/015-api/blueprints/cli.md "The room stream", CLI33, CLI80):
// a fake host, a fake room socket, and a clock the suite moves.

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const thread: DocumentCommentThread = {
  tabId: 'main',
  tabName: 'Main',
  elementId: 'payments',
  ref: 'payments',
  label: 'Payments',
  resolved: false,
  comments: [
    { id: 'c1', text: 'Idempotent?', createdAt: NOW, authorName: 'Sam', authorColor: '#000' },
  ],
};

function host(
  options: {
    rev?: number;
    threads?: DocumentCommentThread[];
    tabStatus?: number;
    etag?: false;
  } = {},
): Route {
  return (request, url) => {
    if (url.pathname === `/api/documents/${DOC}`)
      return Response.json({
        document: {
          id: DOC,
          name: 'Shop',
          tabs: [
            { id: 'main', name: 'Main', orderIndex: 0 },
            { id: 'other', name: 'Other', orderIndex: 1 },
          ],
        },
      });
    if (url.pathname === `/api/documents/${DOC}/room-ticket` && request.method === 'POST')
      return Response.json({ ticket: 'tk' });
    if (url.pathname === `/api/documents/${DOC}/comments`)
      return Response.json({ threads: options.threads ?? [thread] });
    if (url.pathname.startsWith(`/api/documents/${DOC}/tabs/`))
      return options.tabStatus
        ? Response.json({ error: 'gone' }, { status: options.tabStatus })
        : new Response(
            JSON.stringify({
              tab: { id: 'main', name: 'Main', elements: [{ id: 'payments' }, { id: 'pay-db' }] },
            }),
            options.etag === false ? {} : { headers: { ETag: `W/"${options.rev ?? 9}"` } },
          );
    return undefined;
  };
}

// Starts the command and waits for its socket to open.
async function start(
  argv: string[],
  route: Route = host(),
  before?: (io: FakeIo) => Promise<void>,
) {
  const io = fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [capabilities, route] });
  await before?.(io);
  const exit = run(argv, io);
  for (let i = 0; i < 20 && io.sockets.length === 0; i++) await tick();
  io.sockets[0]!.open();
  return { io, exit };
}

const op = (io: FakeIo, value: unknown) =>
  io.sockets.at(-1)!.send({ kind: 'op', from: 'p', op: value });
const changed = (tabId = 'main') => ({
  kind: 'el',
  tabId,
  op: { kind: 'update', element: { id: 'payments' } },
});
const commented = (tabId = 'main') => ({
  kind: 'el-delta',
  tabId,
  elementId: 'payments',
  delta: { kind: 'comment-add', comment: { id: 'c1', text: 'Idempotent?', authorName: 'Sam' } },
});

describe('wait --for comment', () => {
  it('prints the thread a new comment landed in, and exits 0', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'comment']);
    op(io, changed());
    op(io, commented());
    expect(await exit).toBe(0);
    expect(io.out()).toBe(
      'payments "Payments" · open · 1 · tab "Main"\n  Sam 2026-10-05: "Idempotent?"\n',
    );
    expect(io.sockets[0]!.closedWith).toBe(1000);
  });

  it('prints the comment alone when its thread is gone, and ignores other tabs with --tab', async () => {
    const { io, exit } = await start(
      ['wait', DOC, '--for', 'comment', '--tab', 'Main'],
      host({ threads: [] }),
    );
    op(io, commented('other'));
    op(io, commented());
    expect(await exit).toBe(0);
    expect(io.out()).toBe('comment on payments by Sam: "Idempotent?"\n');
  });
});

describe('wait --for change', () => {
  it('waits for a burst to settle, then names the revision', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'change'], host({ rev: 9 }));
    op(io, commented());
    op(io, changed());
    await io.advance(WAIT_SETTLE_MS - 1);
    op(io, changed());
    await io.advance(WAIT_SETTLE_MS - 1);
    expect(io.out()).toBe('');
    await io.advance(1);
    expect(await exit).toBe(0);
    expect(io.out()).toBe('tab "Main" changed · rev 9\n');
  });

  it('names the revisions and the diff since the last read, when there is one', async () => {
    const seed = (rev: number) => async (io: FakeIo) =>
      fileReadCopies(io, DEFAULT_PROFILE, () => {}).record(DOC, 'main', {
        rev,
        tab: { id: 'main', name: 'Main', elements: [] },
      });
    const behind = await start(['wait', DOC, '--for', 'change'], host({ rev: 9 }), seed(7));
    op(behind.io, changed());
    await behind.io.advance(WAIT_SETTLE_MS);
    expect(await behind.exit).toBe(0);
    expect(behind.io.out()).toBe(
      `tab "Main" changed · rev 7→9 · diff: livediagram tab diff "${DOC}" --tab "Main" --since 7\n`,
    );
    const level = await start(['wait', DOC, '--for', 'change'], host({ rev: 9 }), seed(9));
    op(level.io, changed());
    await level.io.advance(WAIT_SETTLE_MS);
    expect(await level.exit).toBe(0);
    expect(level.io.out()).toBe('tab "Main" changed · rev 9\n');
  });

  it('names a tab made after it started, and leaves the revision out when the api names none', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'change'], host({ etag: false }));
    op(io, { kind: 'tab', tabId: 'fresh' });
    await io.advance(WAIT_SETTLE_MS);
    expect(await exit).toBe(0);
    expect(io.out()).toBe('tab "fresh" changed\n');
  });

  it('names a change to the document itself', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'change']);
    op(io, { kind: 'document-meta', name: 'Shop v2', tabs: [] });
    await io.advance(WAIT_SETTLE_MS);
    expect(await exit).toBe(0);
    expect(io.out()).toBe('document "Shop v2" changed\n');
  });
});

describe('wait endings', () => {
  it('says nothing came when the timeout passes', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'comment', '--timeout', '30']);
    await io.advance(30_000);
    expect(await exit).toBe(0);
    expect(io.out()).toBe('nothing new in 30 s\n');
  });

  it('exits 1 on Ctrl-C, and 3 when the document goes to the Trash', async () => {
    const first = await start(['wait', DOC, '--for', 'comment']);
    first.io.interrupt();
    expect(await first.exit).toBe(1);
    expect(first.io.sockets[0]!.closedWith).toBe(1000);
    const second = await start(['wait', DOC, '--for', 'change']);
    op(second.io, changed());
    second.io.sockets[0]!.drop(DOCUMENT_TRASHED_CLOSE);
    expect(await second.exit).toBe(3);
    expect(second.io.err()).toContain('the document was moved to the Trash');
  });

  it('says how to see what was missed after a reconnect', async () => {
    const { io, exit } = await start(['wait', DOC, '--for', 'comment']);
    io.sockets[0]!.drop(1006);
    await io.advance(1_000);
    for (let i = 0; i < 5; i++) await tick();
    io.sockets[1]!.open();
    op(io, commented());
    expect(await exit).toBe(0);
    expect(io.err()).toContain(
      `reconnected; what changed meanwhile: livediagram tab diff "${DOC}"`,
    );
  });

  it('exits as the api refused the ticket', async () => {
    const io = fakeIo({
      env: { LIVEDIAGRAM_TOKEN: TOKEN },
      routes: [
        capabilities,
        (request, url) =>
          url.pathname.endsWith('/room-ticket')
            ? Response.json({ error: 'forbidden' }, { status: 403 })
            : host()(request, url),
      ],
    });
    expect(await run(['wait', DOC, '--for', 'comment'], io)).toBe(4);
  });
});

describe('watch', () => {
  it('prints a line for each event as it comes, in order, with the views’ refs', async () => {
    const { io, exit } = await start(['watch', DOC]);
    op(io, changed());
    op(io, commented());
    op(io, { kind: 'el', tabId: 'main', op: { kind: 'add', element: { id: 'queue' }, at: 2 } });
    op(io, { kind: 'el', tabId: 'main', op: { kind: 'remove', id: 'queue' } });
    op(io, {
      kind: 'changeset',
      tabId: 'main',
      id: 'cs_1',
      author: { name: 'Webber' },
      summary: 'add',
      counts: { added: 1, changed: 0, removed: 0 },
    });
    op(io, { kind: 'tab', tabId: 'other' });
    op(io, { kind: 'tab', tabId: 'fresh' });
    op(io, { kind: 'document-meta', name: 'Shop v2', tabs: [{ id: 'main', name: 'Main' }] });
    await tick();
    io.interrupt();
    expect(await exit).toBe(0);
    expect(io.out().split('\n')).toEqual([
      'element payments changed',
      'comment on payments by Sam: "Idempotent?"',
      'element queue added',
      'element queue removed',
      'changeset cs_1 by Webber: "add" (+1 ~0 -0)',
      'tab "Other" changed',
      'tab "fresh" changed',
      'document renamed "Shop v2"',
      'tab "Other" removed',
      '',
    ]);
  });

  it('streams JSON objects with --json, narrows to a tab, and names elements by id on an unreadable tab', async () => {
    const { io, exit } = await start(
      ['watch', DOC, '--tab', 'Main', '--json'],
      host({ tabStatus: 500 }),
    );
    op(io, changed('other'));
    op(io, changed());
    await tick();
    io.interrupt();
    expect(await exit).toBe(0);
    expect(io.out()).toBe(
      `${JSON.stringify({ kind: 'element', tabId: 'main', elementId: 'payments', change: 'changed' })}\n`,
    );
  });

  it('exits 3 when the document goes to the Trash, and as the api refused the ticket', async () => {
    const { io, exit } = await start(['watch', DOC]);
    io.sockets[0]!.drop(DOCUMENT_TRASHED_CLOSE);
    expect(await exit).toBe(3);
    const refused = fakeIo({
      env: { LIVEDIAGRAM_TOKEN: TOKEN },
      routes: [
        capabilities,
        (request, url) =>
          url.pathname.endsWith('/room-ticket')
            ? Response.json({ error: 'not_found' }, { status: 404 })
            : host()(request, url),
      ],
    });
    expect(await run(['watch', DOC], refused)).toBe(3);
  });

  it('says how to see what was missed after a reconnect', async () => {
    const { io, exit } = await start(['watch', DOC]);
    io.sockets[0]!.drop(1006);
    await io.advance(1_000);
    for (let i = 0; i < 5; i++) await tick();
    io.sockets[1]!.open();
    io.interrupt();
    expect(await exit).toBe(0);
    expect(io.err()).toContain(
      `reconnected; what changed meanwhile: livediagram tab diff "${DOC}"`,
    );
  });
});
