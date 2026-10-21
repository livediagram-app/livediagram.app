import { describe, expect, it } from 'vitest';
import type { ChangesetRequest } from '@livediagram/api-schema';
import { HELD_RETRY_INTERVAL_MS } from '@livediagram/agent-verbs';
import { run } from './main';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from './testing/fake-io';

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const TAB = `/api/documents/${DOC}/tabs/main`;
const tabV = (rev: number, labels: string[]) => ({
  tab: {
    id: 'main',
    name: 'Main',
    elements: labels.map((label, i) => ({
      id: `n${i + 1}`,
      type: 'shape',
      shape: 'square',
      x: i * 200,
      y: 0,
      width: 120,
      height: 60,
      label,
    })),
  },
  rev,
});

// A one-document host whose tab moves on with each write; `refuse` answers the next writes instead.
function host(options: { refuse?: () => Response | undefined } = {}) {
  const state = { current: tabV(5, ['A']), requests: [] as ChangesetRequest[] };
  const route: Route = async (request, url) => {
    if (url.pathname === '/api/documents')
      return Response.json({
        documents: [{ id: DOC, name: 'Auth flow', savedAt: NOW, ownerId: 'u' }],
      });
    if (url.pathname === '/api/teams') return Response.json({ teams: [] });
    if (url.pathname === `/api/documents/${DOC}`)
      return Response.json({
        document: {
          id: DOC,
          name: 'Auth flow',
          tabs: [{ id: 'main', name: 'Main', orderIndex: 0 }],
        },
      });
    if (url.pathname === TAB && url.searchParams.get('view'))
      return new Response(`tab main "Main" · rev ${state.current.rev}`, {
        headers: { ETag: `W/"${state.current.rev}"` },
      });
    if (url.pathname === TAB)
      return new Response(JSON.stringify({ tab: state.current.tab }), {
        headers: { ETag: `W/"${state.current.rev}"` },
      });
    if (url.pathname === `${TAB}/changesets`) {
      state.requests.push(JSON.parse(await request.text()) as ChangesetRequest);
      const refused = options.refuse?.();
      if (refused) return refused;
      const dryRun = url.searchParams.get('dryRun') === '1';
      const previousRev = state.current.rev;
      if (!dryRun)
        state.current = tabV(previousRev + 1, [
          ...state.current.tab.elements.map((e) => e.label),
          'B',
        ]);
      return Response.json({
        dryRun,
        changeset: dryRun
          ? null
          : { id: 'cs_1', tabId: 'main', rev: state.current.rev, previousRev, rebasedOver: 0 },
        results: [],
        text: dryRun
          ? 'dry run · rev 5 · lint clean · nothing written'
          : `+ n2  square "B"\nrev ${previousRev}→${state.current.rev} · cs_1 · lint clean · revert: livediagram changeset revert ${DOC} cs_1`,
        warnings: state.requests.at(-1)!.base ? [] : ['no_base'],
        lint: null,
      });
    }
    return undefined;
  };
  return { state, route };
}

const session = (route: Route, more: Parameters<typeof fakeIo>[0] = {}) =>
  fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [capabilities, route], ...more });

async function cli(io: ReturnType<typeof fakeIo>, argv: string[]) {
  const before = { out: io.out().length, err: io.err().length };
  const code = await run(argv, io);
  return { code, out: io.out().slice(before.out), err: io.err().slice(before.err) };
}

describe('writing from the CLI', () => {
  it("bases an edit on the tab it last viewed, prints the api's lines, and moves its copy on", async () => {
    const { state, route } = host();
    const io = session(route, { files: { '/work/ops.txt': 'add square label=B\n' } });
    await cli(io, ['tab', 'view', 'Auth flow']);
    const edit = await cli(io, ['edit', 'Auth flow', '-f', 'ops.txt', '--summary', 'Add B']);
    expect(edit).toEqual({
      code: 0,
      out: `+ n2  square "B"\nrev 5→6 · cs_1 · lint clean · revert: livediagram changeset revert ${DOC} cs_1\n`,
      err: '',
    });
    expect(state.requests[0]).toMatchObject({
      operations: 'add square label=B\n',
      summary: 'Add B',
      base: { rev: 5 },
    });
    await cli(io, ['element', 'connect', 'Auth flow', 'n1', 'n2', 'label=calls it']);
    expect(state.requests[1]).toMatchObject({
      operations: 'connect n1 -> n2 label="calls it"',
      base: { rev: 6 },
    });
    expect(Object.keys(state.requests[1]!.base!.elements!)).toEqual(['n1', 'n2']);
  });

  it('warns on stderr when nothing was read first, and prints a dry run', async () => {
    const { route } = host();
    const io = session(route, { stdin: 'rm n1' });
    expect(await cli(io, ['edit', 'Auth flow', '-f', '-', '--dry-run'])).toEqual({
      code: 0,
      out: 'dry run · rev 5 · lint clean · nothing written\n',
      err: 'warning: no_base\n',
    });
  });

  it('exits 5 on a conflict, naming the elements and the read to redo', async () => {
    const { route } = host({
      refuse: () =>
        Response.json(
          { error: 'changeset_conflict', rev: 7, conflicts: [{ id: 'n1', reason: 'changed' }] },
          { status: 409 },
        ),
    });
    const io = session(route);
    await cli(io, ['tab', 'view', 'Auth flow']);
    expect(await cli(io, ['element', 'set', 'Auth flow', 'n1', 'label=Z'])).toEqual({
      code: 5,
      out: '',
      err: 'error: 1 element changed since rev 5 (now 7):\n  n1 (changed)\nhint: re-read: livediagram tab view "Auth flow" --tab "Main"\n',
    });
  });

  it('retries held elements for --wait-held, then exits 5', async () => {
    const held = () =>
      Response.json(
        { error: 'elements_held', held: [{ id: 'n1', by: { name: 'Ada', color: '#f00' } }] },
        { status: 409 },
      );
    const { route } = host({ refuse: held });
    const io = session(route);
    const result = await cli(io, ['element', 'rm', 'Auth flow', 'n1', '--wait-held', '5']);
    expect(result.code).toBe(5);
    expect(result.err).toContain('1 element is selected by people:\n  n1 (Ada)');
    expect(io.slept).toEqual([HELD_RETRY_INTERVAL_MS, HELD_RETRY_INTERVAL_MS]);
  });

  it('refuses a file it cannot tell with exit 1, and a diff without a copy with exit 3', async () => {
    const { route } = host();
    const io = session(route, { files: { '/work/x.json': '{"name":"x"}' } });
    expect(await cli(io, ['edit', 'Auth flow', '-f', 'x.json'])).toMatchObject({
      code: 1,
      err: expect.stringContaining("can't tell what x.json holds"),
    });
    expect(await cli(io, ['tab', 'diff', 'Auth flow', '--since', '5'])).toMatchObject({
      code: 3,
      err: expect.stringContaining('no read copies of this tab'),
    });
  });

  it('diffs the tab against a revision it read', async () => {
    const { route } = host();
    const io = session(route);
    await cli(io, ['tab', 'view', 'Auth flow']);
    await cli(io, ['element', 'add', 'Auth flow', 'square', 'label=B']);
    const diff = await cli(io, ['tab', 'diff', 'Auth flow', '--since', '5']);
    expect(diff.code).toBe(0);
    expect(diff.out).toContain('"B"');
  });
});

describe('creating from the CLI', () => {
  it("creates a document from a file with a fresh id, as the CLI's", async () => {
    const posted: unknown[] = [];
    const create: Route = async (request, url) => {
      if (url.pathname !== '/api/documents' || request.method !== 'POST') return undefined;
      const body = JSON.parse(await request.text()) as {
        id: string;
        name: string;
        tabs: unknown[];
      };
      posted.push(body);
      return Response.json(
        { document: { id: body.id, name: body.name, tabs: body.tabs } },
        { status: 201 },
      );
    };
    const io = session(create, { files: { '/work/flow.mmd': 'flowchart LR\n  a --> b\n' } });
    const result = await cli(io, ['document', 'create', 'Shop', '-f', 'flow.mmd']);
    expect(result.code).toBe(0);
    const [body] = posted as {
      id: string;
      source: string;
      tabs: { id: string; mermaid: string }[];
    }[];
    expect(body!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body!.tabs[0]!.id).not.toBe(body!.id);
    expect(body).toMatchObject({
      source: 'cli',
      tabs: [{ name: 'Shop', mermaid: 'flowchart LR\n  a --> b\n' }],
    });
    expect(result.out).toBe(
      `+ document ${body!.id.slice(0, 8)} "Shop" · 1 tab · https://livediagram.app/document/${body!.id}\n`,
    );
  });
});
