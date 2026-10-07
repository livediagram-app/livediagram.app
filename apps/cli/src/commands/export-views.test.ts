import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_ENVELOPE_KIND,
  type ArrowElement,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { run } from '../main';
import { pullFileText, type PullFile } from '../sync/pull-file';
import { fakeIo, NOW, TOKEN, type FakeIo, type Route } from '../testing/fake-io';
import { EXPORT_RATE_RETRY_MS } from './export';

// `export --all` (CLI29, E24) and a pull file read offline (CLI70), through the whole command.

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

type HostDoc = { name: string; tabs: (Tab & { folder?: string })[]; status?: number };

function host(docs: Record<string, HostDoc>, options: { limited?: number } = {}) {
  let limited = options.limited ?? 0;
  const route: Route = (_request, url) => {
    const path = url.pathname;
    if (path === '/api/capabilities')
      return Response.json({ apiBase: `${HOST}/api`, authEnabled: true, documentFormat: 2 });
    if (path === '/api/teams') return Response.json({ teams: [] });
    if (path === '/api/documents') {
      if (limited > 0) {
        limited -= 1;
        return Response.json({ error: 'rate_limited' }, { status: 429 });
      }
      return Response.json({
        documents: Object.entries(docs).map(([id, d]) => ({
          id,
          name: d.name,
          savedAt: NOW,
          ownerId: 'u',
        })),
      });
    }
    const m = /^\/api\/documents\/([^/]+)(?:\/tabs\/([^/]+)(\/render\.svg)?)?$/.exec(path);
    const doc = m ? docs[m[1]!] : undefined;
    if (!m || !doc) return undefined;
    if (doc.status) return Response.json({ error: 'forbidden' }, { status: doc.status });
    if (!m[2])
      return Response.json({
        document: {
          id: m[1],
          name: doc.name,
          presentation: null,
          tabs: doc.tabs.map((t, i) => ({
            id: t.id,
            name: t.name,
            orderIndex: i,
            ...(t.folder ? { folder: t.folder } : {}),
          })),
        },
      });
    const tab = doc.tabs.find((t) => t.id === m[2]);
    if (!tab) return undefined;
    if (m[3]) return new Response(`<svg data-tab="${tab.id}"/>`);
    const { folder: _f, ...plain } = tab;
    return new Response(JSON.stringify({ tab: plain }), { headers: { ETag: 'W/"5"' } });
  };
  return route;
}

async function cli(argv: string[], route: Route, io?: FakeIo) {
  const used = io ?? fakeIo({ env: { LIVEDIAGRAM_TOKEN: TOKEN }, routes: [route] });
  const [o, e] = [used.out().length, used.err().length];
  const code = await run(argv, used);
  return { code, io: used, out: used.out().slice(o), err: used.err().slice(e) };
}

const link: ArrowElement = {
  id: 'link',
  type: 'arrow',
  from: { kind: 'free', x: 120, y: 30 },
  to: { kind: 'free', x: 200, y: 30 },
};
const flow: Tab = {
  id: 'flow-0001',
  name: 'Flow',
  elements: [square('web', 'Web app'), square('api', 'API', 200), link],
};
const docs: Record<string, HostDoc> = {
  'aaaa0001-doc': {
    name: 'Shop',
    tabs: [
      { ...flow, folder: 'Core' },
      { id: 'flow-0002', name: 'Flow', elements: [] },
    ],
  },
  'bbbb0002-doc': { name: 'Shop', tabs: [] },
  'cccc0003-doc': { name: 'Notes', tabs: [{ id: 'n1', name: 'N', elements: [] }] },
};

describe('export --all', () => {
  it('writes every document as the editor’s envelope by default, telling apart documents of one name', async () => {
    const { code, out, io } = await cli(['export', '--all', '--to', 'backup'], host(docs));
    expect(code).toBe(0);
    expect(out.trim().split('\n')).toEqual([
      'backup/shop-aaaa0001.livediagram.json',
      'backup/shop-bbbb0002.livediagram.json',
      'backup/notes.livediagram.json',
      '3 documents · 3 files',
    ]);
    const envelope = JSON.parse(
      io.fileMap.get('backup/shop-aaaa0001.livediagram.json')!.data,
    ) as PullFile;
    expect(envelope.kind).toBe(DOCUMENT_ENVELOPE_KIND);
    expect(envelope.document.tabs[0]).toMatchObject({ id: 'flow-0001', folder: 'Core' });
    expect(envelope).not.toHaveProperty('livediagramSync');
  });

  it('writes each tab as SVG, Mermaid and Markdown, telling apart tabs of one name', async () => {
    const one = { 'aaaa0001-doc': docs['aaaa0001-doc']! };
    const { out, io } = await cli(
      ['export', '--all', '--to', 'out', '--format', 'svg, mermaid,md,svg'],
      host(one),
    );
    expect(out.trim().split('\n')).toEqual([
      'out/shop/flow-flow-0001.svg',
      'out/shop/flow-flow-0001.mmd',
      'out/shop/flow-flow-0001.md',
      'out/shop/flow-flow-0002.svg',
      'out/shop/flow-flow-0002.mmd',
      'out/shop/flow-flow-0002.md',
      '1 document · 6 files',
    ]);
    expect(io.fileMap.get('out/shop/flow-flow-0001.mmd')!.data).toContain('Web app');
    expect(io.fileMap.get('out/shop/flow-flow-0001.md')!.data).toContain('Web app');
  });

  it('waits out the rate limit, and gives up after three tries', async () => {
    const patient = await cli(
      ['export', '--all', '--to', 'b'],
      host({ 'cccc0003-doc': docs['cccc0003-doc']! }, { limited: 2 }),
    );
    expect(patient.code).toBe(0);
    expect(patient.io.slept).toEqual([EXPORT_RATE_RETRY_MS, EXPORT_RATE_RETRY_MS]);
    expect((await cli(['export', '--all', '--to', 'b'], host(docs, { limited: 4 }))).code).toBe(6);
  });

  it('reports a document it cannot read and exports the rest, exiting with the failure', async () => {
    const { code, out, err } = await cli(
      ['export', '--all', '--to', 'b'],
      host({
        ...docs,
        'dddd0004-doc': { name: 'Locked', tabs: [], status: 403 },
        'eeee0005-doc': { name: 'Also locked', tabs: [], status: 403 },
      }),
    );
    expect(code).toBe(4);
    expect(out).toContain('3 documents · 3 files');
    expect(err).toContain('"Locked":');
  });

  it('needs --all and a known format', async () => {
    const without = await cli(['export', '--to', 'b'], host(docs));
    expect([without.code, without.err]).toEqual([2, expect.stringContaining('add --all')]);
    const unknown = await cli(['export', '--all', '--to', 'b', '--format', 'json,gif'], host(docs));
    expect([unknown.code, unknown.err]).toEqual([2, expect.stringContaining('unknown format gif')]);
    expect((await cli(['export', '--all', '--to', 'b', '--format', ','], host(docs))).code).toBe(2);
  });
});

describe('a pull file read offline', () => {
  const file: PullFile = {
    kind: 'livediagram.document',
    schemaVersion: 1,
    exportedAt: NOW,
    document: {
      id: 'aaaa0001-doc',
      name: 'Shop',
      presentation: null,
      tabs: [flow, { id: 'other-01', name: 'Other', elements: [] }],
    },
    livediagramSync: {
      host: HOST,
      pulledAt: NOW,
      tabs: { 'flow-0001': { rev: 9, hash: 'h', settingsHash: 's' } },
    },
  };
  // No token and no host: nothing is read but the file.
  const offline = (argv: string[], text = pullFileText(file)) => {
    const io = fakeIo({ files: { 'shop.livediagram.json': text } });
    return cli(argv, () => undefined, io);
  };

  it('dates a mirror file without pulledAt by its newest tab (RL10)', async () => {
    const { pulledAt: _p, ...sync } = file.livediagramSync;
    const tabs = [
      { ...flow, updatedAt: Date.UTC(2026, 9, 3) },
      { id: 'other-01', name: 'Other', elements: [], updatedAt: Date.UTC(2026, 9, 4) },
    ];
    const mirror = { ...file, document: { ...file.document, tabs }, livediagramSync: sync };
    const overview = await offline(
      ['document', 'view', 'shop.livediagram.json'],
      JSON.stringify(mirror),
    );
    expect(overview.out).toContain('edited 1d ago');
    const bare = { ...file, document: { ...file.document, tabs: [] }, livediagramSync: sync };
    const old = await offline(['document', 'view', 'shop.livediagram.json'], JSON.stringify(bare));
    expect(old.out).toContain('edited 1970-01-01');
  });

  it('lists its tabs and prints its overview, with the pulled revisions', async () => {
    const ls = await offline(['tab', 'ls', 'shop.livediagram.json']);
    expect(ls.code).toBe(0);
    expect(ls.out).toContain('"Flow"');
    const overview = await offline(['document', 'view', 'shop.livediagram.json']);
    expect(overview.code).toBe(0);
    expect(overview.out).toContain('Shop');
    expect(overview.out).toContain('rev 9');
    expect(overview.io.requests).toEqual([]);
  });

  it('prints a tab’s views, its JSON and the plain tab, as the api would', async () => {
    const outline = await offline(['tab', 'view', 'shop.livediagram.json']);
    expect(outline.out).toContain('"Web app"');
    expect(outline.out).toContain('rev 9');
    const json = await offline([
      'tab',
      'view',
      'shop.livediagram.json',
      '--view',
      'layout',
      '--coarse',
      '--json',
    ]);
    expect(JSON.parse(json.out)).toHaveProperty('header');
    const raw = await offline(['tab', 'view', 'shop.livediagram.json', '--raw']);
    expect(JSON.parse(raw.out)).toMatchObject({ id: 'flow-0001' });
    const shown = await offline([
      'tab',
      'view',
      'shop.livediagram.json',
      '--view',
      'show',
      '--ref',
      'web',
      '--budget',
      '400',
      '--style',
      '--all',
    ]);
    expect(shown.code).toBe(0);
    const found = await offline([
      'tab',
      'view',
      'shop.livediagram.json',
      '--tab',
      'Other',
      '--view',
      'find',
      '--text',
      'x',
      '--only',
      'web',
    ]);
    expect(found.code).not.toBe(2);
  });

  it('refuses a ref the tab lacks as the api does, and every verb that does not read', async () => {
    const missing = await offline([
      'tab',
      'view',
      'shop.livediagram.json',
      '--view',
      'show',
      '--ref',
      'nope',
    ]);
    expect(missing.code).toBe(3);
    const bad = await offline(['tab', 'view', 'shop.livediagram.json', '--view', 'show']);
    expect([bad.code, bad.err]).toEqual([1, expect.stringContaining('view show needs ref')]);
    const find = await offline(['tab', 'view', 'shop.livediagram.json', '--view', 'find']);
    expect([find.code, find.err]).toEqual([1, expect.stringContaining('view find needs q')]);
    const arrow = await offline(['tab', 'view', 'shop.livediagram.json', '--only', 'link']);
    expect([arrow.code, arrow.err]).toEqual([
      1,
      expect.stringContaining('only takes an element, not an arrow'),
    ]);
    const write = await offline(['element', 'rm', 'shop.livediagram.json', 'web']);
    expect([write.code, write.err]).toEqual([
      2,
      expect.stringContaining('is a pull file: only document view, tab ls and tab view read it'),
    ]);
  });

  it('names a file that is not a pull file, and treats a missing one as a document name', async () => {
    const broken = await offline(['tab', 'ls', 'shop.livediagram.json'], '{');
    expect([broken.code, broken.err]).toEqual([
      1,
      expect.stringContaining('shop.livediagram.json: not JSON'),
    ]);
    // A path that names no file is a document name, looked up on the host.
    const absent = await offline(['tab', 'ls', 'gone.livediagram.json']);
    expect(absent.io.requests.length).toBeGreaterThan(0);
  });
});
