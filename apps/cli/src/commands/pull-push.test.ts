import { describe, expect, it } from 'vitest';
import type { ChangesetRequest } from '@livediagram/api-schema';
import type { ShapeElement } from '@livediagram/document';
import { run } from '../main';
import { mirrorFileText } from '../link/mirror-file';
import { parsePullFile, type PullFile } from '../sync/pull-file';
import { fakeIo, NOW, TOKEN, type FakeIo, type Route } from '../testing/fake-io';

// `pull` and `push` through the whole command (docs/specs/015-api/blueprints/cli.md "Pull and push", CLI27, CLI28,
// E18 to E20), on a fake host whose tabs move on with each write.

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const HOST = 'https://livediagram.app';
const square = (id: string, label: string, x = 0): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 120,
  height: 60,
  label,
});

type HostTab = { name: string; rev: number; elements: unknown[]; folder?: string; theme?: string };

function host(
  options: {
    format?: number;
    stale?: string[];
    fail?: string[];
    unchanged?: string[];
    noEtag?: string[];
  } = {},
) {
  const tabs = new Map<string, HostTab>([
    ['main', { name: 'Main', rev: 3, elements: [square('web', 'Web app')], folder: 'Core' }],
    ['flow', { name: 'Main', rev: 7, elements: [] }],
  ]);
  const requests: { tabId: string; body: ChangesetRequest; dryRun: boolean }[] = [];
  const route: Route = async (request, url) => {
    const path = url.pathname;
    if (path === '/api/capabilities')
      return Response.json({
        apiBase: `${HOST}/api`,
        authEnabled: true,
        documentFormat: options.format ?? 2,
      });
    if (path === '/api/share/CODE1234')
      return Response.json({ document: { id: DOC, name: 'Shop: Checkout' } });
    if (path === `/api/documents/${DOC}`)
      return Response.json({
        document: {
          id: DOC,
          name: 'Shop: Checkout',
          presentation: null,
          tabs: [...tabs].map(([id, t], i) => ({
            id,
            name: t.name,
            orderIndex: i,
            ...(t.folder ? { folder: t.folder } : {}),
          })),
        },
      });
    const tab = /^\/api\/documents\/[^/]+\/tabs\/([^/]+)(\/.*)?$/.exec(path);
    if (!tab) return undefined;
    const [, tabId, rest] = tab;
    const stored = tabs.get(tabId!);
    if (rest === '/render.svg') return new Response(`<svg data-tab="${tabId}"/>`);
    if (rest === '/changesets') {
      const body = JSON.parse(await request.text()) as ChangesetRequest;
      const dryRun = url.searchParams.get('dryRun') === '1';
      requests.push({ tabId: tabId!, body, dryRun });
      if (options.fail?.includes(tabId!))
        return Response.json({ error: 'forbidden' }, { status: 403 });
      if (options.stale?.includes(tabId!) || (stored && body.base && body.base.rev !== stored.rev))
        return Response.json({ error: 'stale_tab', rev: stored?.rev }, { status: 412 });
      if (options.unchanged?.includes(tabId!))
        return Response.json({
          dryRun,
          changeset: null,
          results: [],
          text: 'nothing changed',
          warnings: [],
          lint: null,
        });
      const rev = (stored?.rev ?? 0) + 1;
      if (!dryRun)
        tabs.set(tabId!, {
          name: stored?.name ?? body.replace!.name!,
          rev,
          elements: body.replace!.elements!,
        });
      return Response.json({
        dryRun,
        changeset: dryRun
          ? null
          : { id: `cs_${rev}`, tabId, rev, previousRev: rev - 1, rebasedOver: 0 },
        results: [],
        text: `~ replaced ${tabId}`,
        warnings: [],
        lint: null,
      });
    }
    if (!stored) return Response.json({ error: 'not_found' }, { status: 404 });
    return new Response(
      JSON.stringify({
        tab: {
          id: tabId,
          name: stored.name,
          elements: stored.elements,
          ...(stored.theme ? { theme: stored.theme } : {}),
        },
      }),
      options.noEtag?.includes(tabId!) ? {} : { headers: { ETag: `W/"${stored.rev}"` } },
    );
  };
  return { route, tabs, requests };
}

async function cli(argv: string[], route: Route, io?: FakeIo) {
  const used = io ?? fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [route] });
  // The fake io keeps every stream since it was made; a call reads only what it printed.
  const [outBefore, errBefore] = [used.out().length, used.err().length];
  const code = await run(argv, used);
  return { code, io: used, out: used.out().slice(outBefore), err: used.err().slice(errBefore) };
}

const pulledFile = (io: FakeIo, path = '/work/shop-checkout.livediagram.json'): PullFile => {
  const parsed = parsePullFile(io.fileMap.get(path)!.data);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.file;
};

const edit = (io: FakeIo, path: string, change: (file: PullFile) => void) => {
  const file = pulledFile(io, path);
  change(file);
  io.fileMap.set(path, { data: JSON.stringify(file), mode: 0o644 });
};

describe('pull', () => {
  it('writes the document with every tab, its folder and revision, and keeps read copies', async () => {
    const h = host();
    const { code, out, io } = await cli(['pull', DOC], h.route);
    expect(code).toBe(0);
    expect(out).toBe('/work/shop-checkout.livediagram.json\n');
    const file = pulledFile(io);
    expect(file.document.tabs.map((t) => [t.id, t.folder])).toEqual([
      ['main', 'Core'],
      ['flow', undefined],
    ]);
    expect(file.livediagramSync).toMatchObject({
      host: HOST,
      pulledAt: NOW,
      tabs: { main: { rev: 3 }, flow: { rev: 7 } },
    });
    expect([...io.fileMap.keys()].some((k) => k.includes('/copies/'))).toBe(true);
  });

  it('adds a drawing per tab with --svg, telling apart tabs of one name', async () => {
    const { out, io } = await cli(['pull', DOC, '--to', 'out/', '--svg'], host().route);
    expect(out.trim().split('\n')).toEqual([
      'out/shop-checkout.livediagram.json',
      'out/shop-checkout.main.svg',
      'out/shop-checkout.main-flow.svg',
    ]);
    expect(io.fileMap.get('out/shop-checkout.main.svg')!.data).toBe('<svg data-tab="main"/>');
  });

  it('keeps its own file on a repeat pull, and steps aside for another document’s', async () => {
    const h = host();
    const first = await cli(['pull', DOC], h.route);
    const again = await cli(['pull', DOC], h.route, first.io);
    expect(again.out).toContain('/work/shop-checkout.livediagram.json');
    const other = {
      ...pulledFile(first.io),
      document: { ...pulledFile(first.io).document, id: 'other-doc' },
    };
    first.io.fileMap.set('/work/shop-checkout.livediagram.json', {
      data: JSON.stringify(other),
      mode: 0o644,
    });
    const stepped = await cli(['pull', DOC], h.route, first.io);
    expect(stepped.out).toBe('/work/shop-checkout-aaaa1111.livediagram.json\n');
    // The file it stepped aside to is its own from then on: pulled again, and guarded as the plain one is.
    const own = '/work/shop-checkout-aaaa1111.livediagram.json';
    expect((await cli(['pull', DOC], h.route, first.io)).out).toBe(`${own}\n`);
    edit(first.io, own, (f) => f.document.tabs[0]!.elements.push(square('api', 'API', 200)));
    expect((await cli(['pull', DOC], h.route, first.io)).err).toContain(
      `error: ${own} changed here and is not pushed; not overwritten`,
    );
    // A file there that is not this document's pull file holds no edits of its own to keep.
    first.io.fileMap.set(own, { data: 'not a pull file', mode: 0o644 });
    expect((await cli(['pull', DOC], h.route, first.io)).code).toBe(0);
    expect(pulledFile(first.io, own).document.id).toBe(DOC);
  });

  it('refuses to overwrite changes not yet pushed, unless --force drops them', async () => {
    const h = host();
    const first = await cli(['pull', DOC], h.route);
    const path = '/work/shop-checkout.livediagram.json';
    edit(first.io, path, (f) => f.document.tabs[0]!.elements.push(square('api', 'API', 200)));
    const edited = first.io.fileMap.get(path)!.data;
    const refused = await cli(['pull', DOC], h.route, first.io);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain(`error: ${path} changed here and is not pushed; not overwritten`);
    expect(refused.err).toContain(
      `hint: send it: livediagram push ${path}, or drop it: livediagram pull "${DOC}" --force`,
    );
    expect(first.io.fileMap.get(path)!.data).toBe(edited);
    const forced = await cli(['pull', DOC, '--force'], h.route, first.io);
    expect(forced.code).toBe(0);
    expect(first.io.fileMap.get(path)!.data).not.toContain('"API"');
  });

  it('pulls through a share link, sending its code', async () => {
    const { code, io } = await cli(['pull', `${HOST}/document/shared?s=CODE1234`], host().route);
    expect(code).toBe(0);
    expect(
      io.requests
        .filter((r) => r.url.includes(`/documents/${DOC}`))
        .every((r) => r.headers.get('X-Share-Code') === 'CODE1234'),
    ).toBe(true);
  });

  it('fails when the host names no revision for a tab', async () => {
    const { code, err } = await cli(['pull', DOC], host({ noEtag: ['flow'] }).route);
    expect(code).toBe(7);
    expect(err).toContain('the host named no revision for tab "Main"');
  });

  it('refuses a host that stores a newer document format', async () => {
    const { code, err } = await cli(['pull', DOC], host({ format: 99 }).route);
    expect(code).toBe(1);
    expect(err).toContain('stores documents in format 99; this livediagram reads format 2');
    expect(err).toContain('npm install -g @livediagram/cli@latest, or npx @livediagram/cli@latest');
  });
});

describe('push', () => {
  async function pulled(options: Parameters<typeof host>[0] = {}) {
    const h = host(options);
    const { io } = await cli(['pull', DOC], h.route);
    return { h, io, path: '/work/shop-checkout.livediagram.json' };
  }

  it('says so when nothing changed', async () => {
    const { h, io, path } = await pulled();
    const { code, out, err } = await cli(['push', path], h.route, io);
    expect([code, out]).toEqual([0, 'nothing to push\n']);
    // A tab in a folder is hashed as written, its folder included: nothing to name as not pushed.
    expect(err).toBe('');
    expect(h.requests).toEqual([]);
  });

  it('keeps naming a rename it did not send, push after push', async () => {
    const { h, io, path } = await pulled();
    edit(io, path, (f) => {
      f.document.tabs[0]!.name = 'Renamed';
      f.document.tabs[0]!.elements = [];
    });
    const first = await cli(['push', path], h.route, io);
    expect(first.err).toContain('not pushed: the name, theme or background of tab "Renamed"');
    const again = await cli(['push', path], h.route, io);
    expect([again.out, again.err]).toEqual([
      'nothing to push\n',
      'not pushed: the name, theme or background of tab "Renamed"\n',
    ]);
  });

  it('sends a changed tab against its pulled revision, strictly, and records the new one', async () => {
    const { h, io, path } = await pulled();
    edit(io, path, (f) => f.document.tabs[0]!.elements.push(square('api', 'API', 200)));
    const { code, out } = await cli(['push', path, '--summary', 'add api'], h.route, io);
    expect(code).toBe(0);
    expect(out).toBe('tab "Main"\n~ replaced main\n');
    expect(h.requests).toEqual([
      {
        tabId: 'main',
        dryRun: false,
        body: expect.objectContaining({
          base: expect.objectContaining({ rev: 3 }),
          strict: true,
          summary: 'add api',
        }),
      },
    ]);
    expect(pulledFile(io, path).livediagramSync.tabs.main!.rev).toBe(4);
    expect((await cli(['push', path], h.route, io)).out).toBe('nothing to push\n');
  });

  it('creates a tab the document lacks, names what does not travel, and writes nothing on a dry run', async () => {
    const { h, io, path } = await pulled();
    const before = io.fileMap.get(path)!.data;
    edit(io, path, (f) => {
      f.document.tabs[1] = { ...f.document.tabs[1]!, name: 'Renamed' };
      f.document.tabs.push({ id: 'fresh', name: 'Fresh', elements: [] });
      f.document.tabs.shift();
    });
    const edited = io.fileMap.get(path)!.data;
    const { code, err } = await cli(['push', path, '--dry-run'], h.route, io);
    expect(code).toBe(0);
    expect(err).toContain('not pushed: the name, theme or background of tab "Renamed"');
    expect(err).toContain('not pushed: removing tab main');
    expect(h.requests).toEqual([
      { tabId: 'fresh', dryRun: true, body: { replace: { elements: [], name: 'Fresh' } } },
    ]);
    expect(io.fileMap.get(path)!.data).toBe(edited);
    expect(edited).not.toBe(before);
  });

  it('records a tab it created, so the next push leaves it alone', async () => {
    const { h, io, path } = await pulled();
    edit(io, path, (f) => f.document.tabs.push({ id: 'fresh', name: 'Fresh', elements: [] }));
    expect((await cli(['push', path], h.route, io)).code).toBe(0);
    expect(pulledFile(io, path).livediagramSync.tabs.fresh).toMatchObject({ rev: 1 });
    expect((await cli(['push', path], h.route, io)).out).toBe('nothing to push\n');
  });

  it('lands what it can: a stale tab is named, exit 5, and the file records only the tab that landed', async () => {
    const { h, io, path } = await pulled({ stale: ['flow'] });
    edit(io, path, (f) => {
      f.document.tabs[0]!.elements = [];
      f.document.tabs[1]!.elements = [square('x', 'X')];
    });
    const { code, out } = await cli(['push', path], h.route, io);
    expect(code).toBe(5);
    expect(out).toBe(
      'tab "Main"\n~ replaced main\n! stale tab "Main": changed on the host since the pull\n',
    );
    const file = pulledFile(io, path);
    expect([file.livediagramSync.tabs.main!.rev, file.livediagramSync.tabs.flow!.rev]).toEqual([
      4, 7,
    ]);
  });

  it('keeps the pulled revision when the host answers nothing changed, and passes --wait-held on', async () => {
    const { h, io, path } = await pulled({ unchanged: ['main'] });
    edit(io, path, (f) => (f.document.tabs[0]!.elements = []));
    const { code, out } = await cli(['push', path, '--wait-held', '5'], h.route, io);
    expect([code, out]).toEqual([0, 'tab "Main"\nnothing changed\n']);
    expect(pulledFile(io, path).livediagramSync.tabs.main!.rev).toBe(3);
    expect((await cli(['push', path], h.route, io)).out).toBe('nothing to push\n');
  });

  it('reports another refusal and carries on, exiting with it', async () => {
    const { h, io, path } = await pulled({ fail: ['main'] });
    edit(io, path, (f) => (f.document.tabs[0]!.elements = []));
    const { code, err } = await cli(['push', path], h.route, io);
    expect(code).toBe(4);
    expect(err).toContain('error:');
  });

  it('lets a stale tab decide the exit over another refusal', async () => {
    const { h, io, path } = await pulled({ stale: ['main'], fail: ['flow'] });
    edit(io, path, (f) => {
      f.document.tabs[0]!.elements = [];
      f.document.tabs[1]!.elements = [square('x', 'X')];
    });
    const { code, err } = await cli(['push', path], h.route, io);
    expect(code).toBe(5);
    expect(err).toContain('error:');
  });

  it('refuses another host’s file, a missing file, and a file that is not a pull file', async () => {
    const { h, io, path } = await pulled();
    edit(io, path, (f) => (f.livediagramSync.host = 'https://other.example'));
    const other = await cli(['push', path], h.route, io);
    expect(other.code).toBe(2);
    expect(other.err).toContain('was pulled from https://other.example');
    expect((await cli(['push', '/work/none.livediagram.json'], h.route, io)).code).toBe(2);
    io.fileMap.set('/work/bad.json', { data: '{', mode: 0o644 });
    const bad = await cli(['push', '/work/bad.json'], h.route, io);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('/work/bad.json: not JSON');
  });
});

describe('a mirror file', () => {
  it('pushes like a pull file, its pulledAt staying absent, and reads offline', async () => {
    const h = host();
    const { io } = await cli(['pull', DOC], h.route);
    const { exportedAt: _e, livediagramSync, ...rest } = pulledFile(io);
    const { pulledAt: _p, ...sync } = livediagramSync;
    const path = '/work/diagrams/shop-checkout.livediagram.json';
    const mirror = { ...rest, livediagramSync: sync };
    mirror.document.tabs[0]!.elements.push(square('api', 'API', 200));
    io.fileMap.set(path, { data: mirrorFileText(mirror), mode: 0o644 });
    const pushed = await cli(['push', path], h.route, io);
    expect(pushed.code).toBe(0);
    expect(h.requests.map((r) => r.tabId)).toEqual(['main']);
    const after = pulledFile(io, path);
    expect(after.livediagramSync.tabs.main!.rev).toBe(4);
    expect('pulledAt' in after.livediagramSync).toBe(false);
    // Rewritten in the mirror's canonical form, byte for byte what a sync would write (RL30, RL31).
    expect(io.fileMap.get(path)!.data).toBe(mirrorFileText(after));
    const view = await cli(['document', 'view', path], h.route, io);
    expect([view.code, view.out]).toEqual([0, expect.stringContaining('rev 4')]);
  });
});
