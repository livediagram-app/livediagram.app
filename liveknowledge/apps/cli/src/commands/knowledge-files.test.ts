import { mkdtempSync, mkdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  KNOWLEDGEBASE_FLOW,
  layOutPages,
  newKnowledgebasePageContent,
  pagesOf,
  type Tab,
} from '@liveknowledge/document';
import { run } from '../main';
import { fakeIo, TOKEN, type FakeIo, type Route } from '../testing/fake-io';
import { zipOf } from '../testing/zip';
import { IMPORT_BATCH_PAGES, pageMarkdownFor, planLines } from './knowledge-import';
import { pageFileMarkdown, pagePictures } from './knowledge-page-file';

// `export <knowledgebase> <dir>` and `import <folder|zip>` through the whole command
// (docs/specs/024-agents/knowledgebase-for-agents.md "CLI").

const HOST = 'https://www.liveknowledge.app';
const KB = 'aaaa1111-0000-4000-8000-000000000001';

const para = (id: string, runs: object[], style?: string) => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs,
});
// A knowledgebase page as the editor stores one: its one page of writing, holding these blocks.
const CONTENT = newKnowledgebasePageContent();
const PAGE_ID = CONTENT.pages[0]!.id;
const page = (id: string, name: string, blocks: object[], extra: object = {}): Tab =>
  ({
    id,
    name,
    elements: [],
    pages: CONTENT.pages,
    articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
    ...extra,
  }) as unknown as Tab;

const TABS: Record<string, Tab> = {
  deploys: page('deploys', 'Deploys', [
    para('b1', [{ text: 'When we deploy' }], 'h1'),
    para('b2', [
      { text: 'See ' },
      { text: 'Rollbacks', page: 'rollbacks' },
      { text: ' and ' },
      { text: 'Holidays', page: 'holidays' },
      { text: '.' },
    ]),
  ]),
  rollbacks: page(
    'rollbacks',
    'Rollbacks',
    [para('b1', [{ text: 'Back to ' }, { text: 'Deploys', page: 'deploys' }, { text: '.' }])],
    {
      elements: [
        {
          id: 'pic',
          type: 'image',
          imageId: 'img_1',
          alt: 'The release [channel]',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
        { id: 'pic2', type: 'image', imageId: 'img_gone', x: 0, y: 0, width: 10, height: 10 },
        {
          id: 'pic3',
          type: 'image',
          imageId: 'img_1',
          name: 'again.png',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      ],
    },
  ),
  // It shows a picture an earlier page showed: fetched once for the export.
  holidays: page('holidays', 'Holidays', [para('b1', [{ text: 'Last week of December.' }])], {
    elements: [{ id: 'pic', type: 'image', imageId: 'img_1', x: 0, y: 0, width: 10, height: 10 }],
  }),
};
const ROWS = [
  {
    tab: 'deploys',
    title: 'Deploys',
    depth: 1,
    subpages: 1,
    trust: { state: 'never-verified', stale: false },
  },
  {
    tab: 'rollbacks',
    title: 'Rollbacks',
    depth: 2,
    parent: 'deploys',
    subpages: 0,
    trust: { state: 'never-verified', stale: false },
  },
  {
    tab: 'holidays',
    title: 'Holidays',
    depth: 1,
    subpages: 0,
    trust: { state: 'never-verified', stale: false },
  },
];

type Posted = { path: string; body: Record<string, unknown> };

function host(
  options: {
    refuse?: (body: Record<string, unknown>) => Response | undefined;
    holidays?: Tab;
    rows?: typeof ROWS;
  } = {},
) {
  const tabs: Record<string, Tab> = {
    ...TABS,
    ...(options.holidays ? { holidays: options.holidays } : {}),
  };
  const posted: Posted[] = [];
  const reads: string[] = [];
  const route: Route = async (request, url) => {
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/capabilities')
      return Response.json({ apiBase: `${HOST}/api`, authEnabled: true, documentFormat: 2 });
    if (request.method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
      posted.push({ path, body });
      const refused = options.refuse?.(body);
      if (refused) return refused;
      return Response.json(
        path === '/documents'
          ? { document: { id: body.id, name: body.name, tabs: [] } }
          : { page: { tab: body.id, title: body.title, rev: 1 } },
        { status: 201 },
      );
    }
    reads.push(path);
    if (path === '/teams') return Response.json({ teams: [] });
    if (path === '/documents')
      return Response.json({ documents: [{ id: KB, name: 'Handbook', savedAt: 1, ownerId: 'u' }] });
    if (path === `/documents/${KB}`)
      return Response.json({ document: { id: KB, name: 'Handbook', tabs: [] } });
    if (path === `/documents/${KB}/pages`) return Response.json({ pages: options.rows ?? ROWS });
    if (path === '/images/img_1')
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
    if (path === '/images/img_gone') return Response.json({ error: 'not_found' }, { status: 404 });
    if (path === '/images/img_odd')
      return new Response('?', { headers: { 'Content-Type': 'text/plain' } });
    if (path === '/images/img_bare') return new Response(null, { status: 204 });
    if (path === '/images/img_down') throw new TypeError('fetch failed');
    if (path === '/share/AB12')
      return Response.json({ document: { id: KB, name: 'Handbook' }, role: 'view' });
    const tab = /^\/documents\/[^/]+\/tabs\/([^/]+)$/.exec(path);
    if (tab && tabs[tab[1]!]) return Response.json({ tab: tabs[tab[1]!] });
    return undefined;
  };
  return { route, posted, reads };
}

async function cli(argv: string[], route: Route, io?: FakeIo) {
  const used = io ?? fakeIo({ env: { LIVEKNOWLEDGE_TOKEN: TOKEN }, routes: [route] });
  const code = await run(argv, used);
  return { code, io: used, out: used.out(), err: used.err() };
}

describe('export <knowledgebase> <dir>', () => {
  it('writes a page a file, folders following the tree, links relative and pictures as files', async () => {
    const { route, reads } = host();
    const { code, out, io, err } = await cli(['export', 'Handbook', 'docs/kb/'], route);
    expect(code).toBe(0);
    expect(out.trim().split('\n')).toEqual([
      'docs/kb/deploys.md',
      'docs/kb/pictures/img_1.png',
      'docs/kb/deploys/rollbacks.md',
      'docs/kb/holidays.md',
      '1 knowledgebase · 4 files',
    ]);
    expect(await io.files.read('docs/kb/deploys.md')).toBe(
      '# When we deploy\n\nSee [Rollbacks](deploys/rollbacks.md) and [Holidays](holidays.md).\n',
    );
    // A picture's file is one level up from a subpage; one the api would not hand over is its address.
    expect(await io.files.read('docs/kb/deploys/rollbacks.md')).toBe(
      'Back to [Deploys](../deploys.md).\n\n' +
        '![The release  channel](../pictures/img_1.png)\n\n' +
        `![](${HOST}/api/images/img_gone)\n\n` +
        '![again.png](../pictures/img_1.png)\n',
    );
    expect(await io.files.read('docs/kb/holidays.md')).toBe(
      'Last week of December.\n\n![](pictures/img_1.png)\n',
    );
    expect([...(await io.files.readBytes('docs/kb/pictures/img_1.png'))!]).toEqual([1, 2, 3]);
    expect(err).toContain('picture img_gone could not be read (HTTP 404): its address is written');
    // One read of the tree, one a page, one a picture (fetched once though two elements show it).
    expect(
      reads.filter((p) => p.startsWith(`/documents/${KB}/`) || p.startsWith('/images')),
    ).toEqual([
      `/documents/${KB}/pages`,
      `/documents/${KB}/tabs/deploys`,
      `/documents/${KB}/tabs/rollbacks`,
      '/images/img_1',
      '/images/img_gone',
      `/documents/${KB}/tabs/holidays`,
    ]);
  });

  it('writes a picture’s address when its bytes are no picture or cannot be fetched, and reads a share link', async () => {
    const { route } = host({
      holidays: page('holidays', 'Holidays', [para('b1', [{ text: 'December.' }])], {
        elements: ['img_odd', 'img_bare', 'img_down'].map((imageId, i) => ({
          id: `e${i}`,
          type: 'image',
          imageId,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        })),
      }),
    });
    const { code, io, err } = await cli(['export', `${HOST}/document/shared?s=AB12`, 'out'], route);
    expect(code).toBe(0);
    const text = (await io.files.read('out/holidays.md'))!;
    for (const id of ['img_odd', 'img_bare', 'img_down'])
      expect(text).toContain(`![](${HOST}/api/images/${id})`);
    expect(err).toContain('picture img_down could not be read (TypeError: fetch failed)');
    expect(io.requests.some((r) => r.headers.get('X-Share-Code') === 'AB12')).toBe(true);
    TABS.holidays = page('holidays', 'Holidays', [
      para('b1', [{ text: 'Last week of December.' }]),
    ]);
  });

  it('needs a knowledgebase and a folder, or --all with --to', async () => {
    const { route } = host();
    const none = await cli(['export', 'Handbook'], route);
    expect(none).toMatchObject({ code: 2 });
    expect(none.err).toContain('export needs a knowledgebase and a folder, or --all --to <dir>');
    expect((await cli(['export', '--all'], route)).err).toContain('--to <dir>');
  });
});

describe('a page as its file', () => {
  it('puts a picture where its zone sits, drops an empty zone, and keeps a link with no file as text', () => {
    const blocks = [
      para('b1', [{ text: 'Before.' }]),
      // A zone standing at its page's top left corner, and one never laid out.
      {
        id: 'z1',
        type: 'zone',
        zone: 'object',
        width: 500,
        height: 500,
        at: { page: PAGE_ID, x: 0, y: 0 },
      },
      { id: 'z2', type: 'zone', zone: 'object', width: 100, height: 100 },
      para('b2', [{ text: 'To ' }, { text: 'Gone', page: 'gone' }, { text: '.' }]),
    ];
    const { rect } = layOutPages(pagesOf(page('p', 'P', blocks)))[0]!;
    const tab = page('p', 'P', blocks, {
      elements: [
        {
          id: 'in',
          type: 'image',
          imageId: 'a',
          alt: 'In the zone',
          x: rect.x + 10,
          y: rect.y + 10,
          width: 20,
          height: 20,
        },
        {
          id: 'ext',
          type: 'image',
          imageId: 'b',
          x: rect.x + 5000,
          y: rect.y + 5000,
          width: 20,
          height: 20,
        },
        { id: 'box', type: 'shape', shape: 'square', x: rect.x, y: rect.y, width: 5, height: 5 },
        { id: 'noid', type: 'image', x: rect.x, y: rect.y, width: 5, height: 5 },
      ],
    });
    expect(pagePictures(tab)).toEqual(['a', 'b']);
    const out = pageFileMarkdown(tab, 'guides/p.md', new Map(), (id) =>
      id === 'a' ? 'pictures/a.png' : 'https://cdn.test/b.png',
    );
    expect(out).toBe(
      'Before.\n\n![In the zone](../pictures/a.png)\n\nTo Gone.\n\n![](https://cdn.test/b.png)\n',
    );
  });

  it('reads the first article of a tab whose pages show none', () => {
    const tab = {
      id: 't',
      name: 'T',
      elements: [],
      articles: { 'art-1': { blocks: [para('b1', [{ text: 'Only writing.' }])] } },
    } as unknown as Tab;
    expect(pageFileMarkdown(tab, 't.md', new Map(), () => '')).toBe('Only writing.\n');
  });

  it('writes a page with no writing as its pictures alone, or an empty file', () => {
    const bare = { id: 'e', name: 'E', elements: [] } as unknown as Tab;
    expect(pageFileMarkdown(bare, 'e.md', new Map(), () => '')).toBe('\n');
    const pictured = {
      ...bare,
      elements: [{ id: 'i', type: 'image', imageId: 'a', x: 0, y: 0, width: 1, height: 1 }],
    } as unknown as Tab;
    expect(pageFileMarkdown(pictured, 'e.md', new Map(), () => 'pictures/a.png')).toBe(
      '![](pictures/a.png)\n',
    );
  });
});

const temp = mkdtempSync(join(tmpdir(), 'lk-import-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function folder(name: string, files: Record<string, string>): string {
  const root = join(temp, name);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const DOCS = {
  'deploys.md': '# Deploys\n\nSee [rollbacks](deploys/rollbacks.md).\n\n![The channel](shot.png)\n',
  'deploys/rollbacks.md': '# Rollbacks\n\nBack to [deploys](../deploys.md).\n',
  'holidays.md': '# Holidays\n\nLast week of December.\n',
  'shot.png': 'png',
};

describe('import <folder|zip>', () => {
  it('prints the plan and writes nothing on a dry run', async () => {
    const { route, posted } = host();
    const { code, out } = await cli(['import', folder('dry', DOCS), '--dry-run'], route);
    expect(code).toBe(0);
    expect(out).toContain('3 pages · 1 picture left as captions');
    expect(out).toContain('  Deploys\n    Rollbacks\n  Holidays');
    expect(out).toContain('dry run: nothing was written');
    expect(posted).toEqual([]);
  });

  it('makes a new knowledgebase and its pages, parents first, links between them kept', async () => {
    const { route, posted } = host();
    const { code, out, err } = await cli(
      ['import', folder('Handbook', DOCS), '--name', 'Team Handbook'],
      route,
    );
    expect(code).toBe(0);
    expect(posted[0]).toMatchObject({
      path: '/documents',
      body: { name: 'Team Handbook', tabs: [], source: 'cli' },
    });
    const kb = posted[0]!.body.id as string;
    const pages = posted.slice(1);
    expect(pages.map((p) => [p.path, p.body.title])).toEqual([
      [`/documents/${kb}/pages`, 'Deploys'],
      [`/documents/${kb}/pages`, 'Rollbacks'],
      [`/documents/${kb}/pages`, 'Holidays'],
    ]);
    const [deploys, rollbacks] = pages.map((p) => p.body);
    expect(rollbacks!.parent).toBe(deploys!.id);
    expect(deploys).not.toHaveProperty('parent');
    expect(deploys!.markdown).toContain('See [[Rollbacks]].');
    // A picture is left as its caption.
    expect(deploys!.markdown).toContain('*The channel*');
    expect(rollbacks!.markdown).toContain('Back to [[Deploys]].');
    expect(deploys!.pageIds).toMatchObject({ Rollbacks: rollbacks!.id, Deploys: deploys!.id });
    expect(out).toContain('+ knowledgebase "Team Handbook"');
    expect(out).toContain('3 pages imported, none verified');
    expect(err).toContain('pages 1 to 3 of 3');
    expect(IMPORT_BATCH_PAGES).toBe(20);
  });

  it('imports a zip into an existing knowledgebase, under a page', async () => {
    const zip = join(temp, 'export.zip');
    writeFileSync(zip, zipOf({ 'notes.md': '# Notes\n\nHello.\n' }, { deflate: true }));
    const { route, posted } = host();
    const { code, out } = await cli(
      ['import', zip, '--to', 'Handbook', '--into', 'deploys'],
      route,
    );
    expect(code).toBe(0);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      path: `/documents/${KB}/pages`,
      body: { title: 'Notes', parent: 'deploys' },
    });
    expect(out).toContain('1 page imported, none verified');
    expect(out).not.toContain('+ knowledgebase');
  });

  it('leaves out a page the api refuses, and the pages under it, and goes on', async () => {
    const { route } = host({
      refuse: (body) =>
        body.title === 'Deploys'
          ? Response.json({ error: 'tab_too_large' }, { status: 413 })
          : undefined,
    });
    const { code, out } = await cli(['import', folder('part', DOCS), '--to', 'Handbook'], route);
    expect(code).toBe(1);
    expect(out).toContain('not imported: Deploys: tab_too_large');
    expect(out).toContain('not imported: Rollbacks: its parent was not imported');
    expect(out).toContain('1 page imported, none verified · 2 not imported');
  });

  it('names a new knowledgebase after the file, and reads a Notion export', async () => {
    const zip = join(temp, 'Team Notes.zip');
    writeFileSync(zip, zipOf({ 'notes.md': '# Notes\n\nHello.\n' }));
    const { route, posted } = host();
    expect((await cli(['import', zip], route)).code).toBe(0);
    expect(posted[0]!.body.name).toBe('Team Notes');
    const notion = await cli(['import', zip, '--source', 'notion', '--dry-run'], route);
    expect(notion.code).toBe(0);
    expect(notion.out).toContain('1 page ·');
  });

  it('says why nothing can be imported, and writes nothing', async () => {
    const huge = join(temp, 'huge.zip');
    writeFileSync(huge, '');
    truncateSync(huge, 201 * 1024 * 1024);
    const { route, posted } = host();
    const { code, out } = await cli(['import', huge], route);
    expect(code).toBe(1);
    expect(out).toContain('nothing can be imported: the archive is larger than 200 MB');
    expect(posted).toEqual([]);
  });

  it('imports into a knowledgebase named by its link, and names a refusal with no code by its status', async () => {
    const { route, posted } = host({
      refuse: (body) =>
        body.title === 'Holidays' ? new Response('nope', { status: 409 }) : undefined,
    });
    const { code, out } = await cli(
      ['import', folder('link', DOCS), '--to', `${HOST}/document/shared?s=AB12`],
      route,
    );
    expect(code).toBe(1);
    expect(posted[0]!.path).toBe(`/documents/${KB}/pages`);
    expect(out).toContain('not imported: Holidays: HTTP 409');
  });

  it('stops when the credential may not write', async () => {
    const { route } = host({
      refuse: () =>
        Response.json(
          { error: 'scope_needed', message: 'This connection holds the read scope alone here.' },
          { status: 403 },
        ),
    });
    const { code, err } = await cli(['import', folder('scope', DOCS), '--to', 'Handbook'], route);
    expect(code).toBe(4);
    expect(err).toContain('This connection holds the read scope alone here.');
  });

  it('refuses a Confluence export by pointing at the app, and what it cannot read', async () => {
    const { route, posted } = host();
    const confluence = await cli(['import', folder('c', DOCS), '--source', 'confluence'], route);
    expect(confluence.code).toBe(2);
    expect(confluence.err).toContain(
      'a Confluence export is HTML, which this command does not read',
    );
    expect(confluence.err).toContain('import it in the app');
    expect((await cli(['import', join(temp, 'nowhere')], route)).code).toBe(3);
    const text = join(temp, 'notes.txt');
    writeFileSync(text, 'x');
    expect((await cli(['import', text], route)).err).toContain('neither a folder nor a .zip');
    const broken = join(temp, 'broken.zip');
    writeFileSync(broken, 'not a zip, only text that is long enough to look for an end record in');
    const bad = await cli(['import', broken], route);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('could not be read: not a zip file');
    expect((await cli(['import', folder('i', DOCS), '--into', 'Deploys'], route)).err).toContain(
      'add --to <knowledgebase>',
    );
    expect(
      (await cli(['import', folder('n', DOCS), '--to', 'Handbook', '--name', 'X'], route)).err,
    ).toContain('leave it out with --to');
    const twice = host({ rows: [...ROWS, { ...ROWS[2]!, tab: 'h2' }] });
    const several = await cli(
      ['import', folder('t', DOCS), '--to', 'Handbook', '--into', 'Holidays'],
      twice.route,
    );
    expect(several.code).toBe(3);
    expect(several.err).toContain('2 pages are titled "Holidays": name one by its id');
    const unknown = await cli(
      ['import', folder('u', DOCS), '--to', 'Handbook', '--into', 'Nope'],
      route,
    );
    expect(unknown.code).toBe(3);
    expect(unknown.err).toContain('no page "Nope" in that knowledgebase');
    const empty = await cli(['import', folder('e', { 'readme.txt': 'x' })], route);
    expect(empty.code).toBe(1);
    expect(empty.out).toContain('nothing to import: no page was found');
    expect(posted).toEqual([]);
  });
});

describe('the plan in words', () => {
  const planned = (key: string, title: string, parentKey: string | null, markdown = '') => ({
    key,
    title,
    parentKey,
    markdown,
    links: [],
    pictures: [],
    attachments: [],
    warnings: key === 'p2' ? [{ kind: 'flattened' as const, detail: 'x' }] : [],
  });
  const summary = {
    source: 'markdown-folder' as const,
    pages: 2,
    pictures: 0,
    attachments: 1,
    skipped: [
      {
        path: 'big.md',
        reason: 'page-too-large' as const,
        detail: 'It is larger than a page holds.',
      },
    ],
    ignoredFiles: 2,
    blocked: null,
  };

  it('lists the pages by depth, what is skipped and how many warnings', () => {
    const plan = { pages: [planned('p1', 'A', null), planned('p2', 'B', 'p1')], summary };
    expect(planLines(plan)).toEqual([
      '2 pages · 0 pictures left as captions · 1 attachment named · 2 files ignored',
      '  A',
      '    B',
      'skipped big.md: It is larger than a page holds.',
      '1 warning on pages (a missing picture, a flattened level, a link left as text)',
    ]);
  });

  it('says why nothing can be imported', () => {
    expect(
      planLines({
        pages: [],
        summary: { ...summary, blocked: { reason: 'archive-too-large', limitBytes: 209_715_200 } },
      }),
    ).toEqual(['nothing can be imported: the archive is larger than 200 MB']);
    expect(
      planLines({
        pages: [],
        summary: { ...summary, blocked: { reason: 'too-many-pages', found: 600, room: 1 } },
      }),
    ).toEqual(['nothing can be imported: 600 pages found, and there is room for 1']);
  });

  it('writes a link to a planned page by its title, and one to no page as its text', () => {
    const page = planned(
      'p1',
      'A',
      null,
      'See [the guide](knowledgebase-page:p2), [lost](knowledgebase-page:p9) and ![](knowledgebase-picture:0).',
    );
    expect(pageMarkdownFor(page, (key) => (key === 'p2' ? 'Guide' : undefined))).toBe(
      'See [[Guide]], lost and .',
    );
  });
});
