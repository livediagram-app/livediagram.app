import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGEBASE_FLOW,
  layOutPages,
  newKnowledgebasePageContent,
  pageByTitleIn,
  pageFileMarkdown,
  pageFilePictures,
  pageFilePaths,
  pageFrontMatter,
  pageOfAddress,
  pagePictures,
  pagesOf,
  withPageAddressesAsLinks,
  type Tab,
} from './index';

// A page as its file in a Markdown export of a knowledgebase (docs/specs/020-import-export/knowledgebase-export.md
// "What the zip holds").

const para = (id: string, runs: object[], style?: string) => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs,
});
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
const HEAD = (title: string) => `---\ntitle: ${JSON.stringify(title)}\n---\n\n# ${title}`;

describe('the front matter', () => {
  it('says the title, then each fact that is known, every value quoted', () => {
    expect(
      pageFrontMatter('Deploys: "the how"', {
        subtitle: 'Twice a week',
        owner: 'Ana Lopes',
        updated: Date.UTC(2026, 10, 20, 9, 14),
        verified: Date.UTC(2026, 10, 2),
        labels: ['Engineering', 'Run#book'],
        cover: 'pictures/c.png',
      }),
    ).toBe(
      [
        '---',
        'title: "Deploys: \\"the how\\""',
        'subtitle: "Twice a week"',
        'owner: "Ana Lopes"',
        'updated: "2026-11-20T09:14:00.000Z"',
        'verified: "2026-11-02T00:00:00.000Z"',
        'labels: ["Engineering", "Run#book"]',
        'cover: "pictures/c.png"',
        '---',
      ].join('\n'),
    );
  });

  it('leaves out what is unknown, an empty label list and a time that is no number', () => {
    expect(pageFrontMatter('T', { labels: [], updated: Number.NaN })).toBe('---\ntitle: "T"\n---');
  });
});

describe('a page as its file', () => {
  it('opens with its title, from the tree, the Title block, the stored name, or Untitled Page', () => {
    const titled = page('p', 'Stored', [para('t', [{ text: 'From  the\nTitle' }], 'title')]);
    expect(pageFileMarkdown(titled, 'p.md', new Map(), () => null)).toBe(
      `${HEAD('From the Title')}\n`,
    );
    expect(pageFileMarkdown(titled, 'p.md', new Map(), () => null, { title: 'Tree' })).toBe(
      `${HEAD('Tree')}\n`,
    );
    expect(pageFileMarkdown(page('p', 'Stored', []), 'p.md', new Map(), () => null)).toBe(
      `${HEAD('Stored')}\n`,
    );
    expect(pageFileMarkdown(page('p', ' ', []), 'p.md', new Map(), () => null)).toBe(
      `${HEAD('Untitled Page')}\n`,
    );
  });

  it('says the subtitle, the facts and the cover in the front matter, never in the writing', () => {
    const tab = page(
      'p',
      'P',
      [
        para('t', [{ text: 'Release' }], 'title'),
        para('s', [{ text: 'How we ship' }], 'subtitle'),
        para('b', [{ text: 'Body.' }]),
      ],
      { cover: { imageId: 'cov' } },
    );
    expect(pageFilePictures(tab)).toEqual(['cov']);
    const out = pageFileMarkdown(tab, 'guides/p.md', new Map(), () => 'pictures/cov.png', {
      facts: { owner: 'Ana', labels: ['Ops'] },
    });
    expect(out).toBe(
      [
        '---',
        'title: "Release"',
        'subtitle: "How we ship"',
        'owner: "Ana"',
        'labels: ["Ops"]',
        'cover: "../pictures/cov.png"',
        '---',
        '',
        '# Release',
        '',
        'Body.',
        '',
      ].join('\n'),
    );
    // A cover that could not be read is not named.
    expect(pageFileMarkdown(tab, 'p.md', new Map(), () => null)).not.toContain('cover:');
  });

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
          alt: 'In the [zone]',
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
      `${HEAD('P')}\n\nBefore.\n\n![In the  zone](../pictures/a.png)\n\nTo Gone.\n\n![](https://cdn.test/b.png)\n`,
    );
  });

  it('writes a picture that could not be read as its description, and one with none as nothing', () => {
    const tab = page('p', 'P', [para('b', [{ text: 'Body.' }])], {
      elements: [
        {
          id: 'a',
          type: 'image',
          imageId: 'a',
          name: 'chart.png',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        { id: 'b', type: 'image', imageId: 'b', x: 0, y: 0, width: 1, height: 1 },
      ],
    });
    expect(pageFileMarkdown(tab, 'p.md', new Map(), () => null)).toBe(
      `${HEAD('P')}\n\nBody.\n\n_chart.png_\n`,
    );
  });

  it('keeps a code block that reads like a zone line as code', () => {
    const blocks = [
      { id: 'c1', type: 'code', text: 'Before.\n[zone abc]\n\nAfter.' },
      { id: 'z1', type: 'zone', zone: 'object', width: 100, height: 100 },
      { id: 'c2', type: 'code', text: '[zone z1]' },
    ];
    expect(pageFileMarkdown(page('p', 'P', blocks), 'p.md', new Map(), () => null)).toBe(
      `${HEAD('P')}\n\n\`\`\`\nBefore.\n[zone abc]\n\nAfter.\n\`\`\`\n\n\`\`\`\n[zone z1]\n\`\`\`\n`,
    );
  });

  it('reads the first article of a tab whose pages show none', () => {
    const tab = {
      id: 't',
      name: 'T',
      elements: [],
      articles: { 'art-1': { blocks: [para('b1', [{ text: 'Only writing.' }])] } },
    } as unknown as Tab;
    expect(pageFileMarkdown(tab, 't.md', new Map(), () => null)).toBe(
      `${HEAD('T')}\n\nOnly writing.\n`,
    );
  });

  it('writes a page with no writing as its title and pictures alone', () => {
    const bare = { id: 'e', name: 'E', elements: [] } as unknown as Tab;
    expect(pageFileMarkdown(bare, 'e.md', new Map(), () => null)).toBe(`${HEAD('E')}\n`);
    const pictured = {
      ...bare,
      elements: [{ id: 'i', type: 'image', imageId: 'a', x: 0, y: 0, width: 1, height: 1 }],
    } as unknown as Tab;
    expect(pageFileMarkdown(pictured, 'e.md', new Map(), () => 'pictures/a.png')).toBe(
      `${HEAD('E')}\n\n![](pictures/a.png)\n`,
    );
  });
});

describe('links between pages', () => {
  const PAGES = [
    { id: 'deploys', name: 'Deploys' },
    { id: 'rollbacks', name: 'Rollbacks', parent: 'deploys' },
    { id: 'holidays', name: 'Holidays' },
  ];
  const files = pageFilePaths(PAGES);
  const titles = new Map(PAGES.map((p) => [p.id, p.name]));
  const KB = 'kb-1';

  it('makes a page link, a [[Title]] and a page address relative links, in the page’s current title', () => {
    const tab = page('rollbacks', 'Rollbacks', [
      para('b1', [
        { text: 'Old name', page: 'deploys' },
        { text: ', [[holidays]], [[Nowhere]], ' },
        { text: 'copied', href: `https://www.liveknowledge.app/document/${KB}?s=AB#t=holidays` },
        { text: ', ' },
        { text: 'again', href: `https://www.liveknowledge.app/document/${KB}#t=deploys` },
        { text: ', ' },
        { text: 'other kb', href: 'https://www.liveknowledge.app/document/kb-2#t=deploys' },
        { text: ', ' },
        { text: 'web', href: 'https://example.com/#t=deploys' },
        { text: ', ' },
        { text: 'trashed', page: 'trashed' },
        { text: ', ' },
        { text: '[[Deploys]]', code: true },
      ]),
    ]);
    const out = pageFileMarkdown(tab, files.get('rollbacks')!, files, () => null, {
      pageByTitle: pageByTitleIn(PAGES),
      pageOfHref: pageOfAddress(KB),
      titleOf: (id) => titles.get(id),
    });
    expect(out.split('\n').at(-2)).toBe(
      '[Deploys](../deploys.md), [Holidays](../holidays.md), \\[\\[Nowhere\\]\\], ' +
        '[Holidays](../holidays.md), [Deploys](../deploys.md), ' +
        '[other kb](https://www.liveknowledge.app/document/kb-2#t=deploys), ' +
        '[web](https://example.com/#t=deploys), trashed, `[[Deploys]]`',
    );
  });

  it('reads a page’s address only when it names this knowledgebase and a page', () => {
    const of = pageOfAddress(KB);
    expect(of('#t=a&view=ask')).toBe('a');
    expect(of(`https://x.test/document/${KB}#t=b`)).toBe('b');
    expect(of(`/document/${KB}#t=b`)).toBeUndefined();
    expect(of(`https://x.test/document/${KB}`)).toBeUndefined();
    expect(of(`https://x.test/document/${KB}#t=`)).toBeUndefined();
    expect(of('https://x.test/document/other#t=b')).toBeUndefined();
  });

  it('leaves a link in code, a footnote and an existing page link alone', () => {
    const flow = {
      blocks: [
        para('b', [
          { text: 'c', href: '#t=a', code: true },
          { text: 'f', href: '#t=a', fn: 'note' },
          { text: 'p', page: 'x', href: '#t=a' },
          { text: 'plain' },
        ]),
      ],
    };
    expect(withPageAddressesAsLinks(flow as never, pageOfAddress(KB))).toEqual(flow);
  });
});
