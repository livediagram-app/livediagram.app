// The pure half of Publish to the Web (docs/specs/030-knowledgebase/blueprints/publishing.md P4 to P6, P11 to P16):
// addresses, the scope, and the pages as drawn.
import { describe, expect, it } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE, type KnowledgeStyle } from '@liveknowledge/document';
import {
  addressFrom,
  defaultSiteAddress,
  RESERVED_SITE_ADDRESSES,
  siteAddressRefusal,
  uniqueAddress,
} from './publish-address';
import { publishableScope, withoutEmptyPages, type ScopePage } from './publish-scope';
import { publishingOffered } from './publish-capability';
import { siteCss, siteLook } from './publish-site-css';
import {
  namesList,
  pagePath,
  renderSiteNotFound,
  renderSitePage,
  renderSiteSearch,
  siteDate,
  sitePath,
  type SitePage,
  type SiteView,
} from './publish-site';
import { renderSitemap } from './publish-sitemap';

describe('site addresses', () => {
  it('takes lowercase letters, numbers and single hyphens, 3 to 48 long', () => {
    expect(siteAddressRefusal('acme-help')).toBeNull();
    expect(siteAddressRefusal('a1b')).toBeNull();
    for (const bad of [
      'ab',
      'a'.repeat(49),
      'Acme',
      'acme--help',
      '-acme',
      'acme-',
      'acme help',
      'acmé',
    ])
      expect(siteAddressRefusal(bad)).toBe('invalid_address');
    expect(siteAddressRefusal('api')).toBe('address_reserved');
    expect(RESERVED_SITE_ADDRESSES.has('kb')).toBe(true);
  });

  it('makes a page address from a title', () => {
    expect(addressFrom('Release Process')).toBe('release-process');
    expect(addressFrom('  Café & Crème brûlée! ')).toBe('cafe-creme-brulee');
    expect(addressFrom('???')).toBe('page');
    expect(addressFrom('', 80, 'section')).toBe('section');
    // Cut at a hyphen near the end, never mid-word when one is near.
    expect(addressFrom('alpha beta gamma delta', 14)).toBe('alpha-beta');
    // No hyphen in the second half: cut where it reached.
    expect(addressFrom('abcdefghijklmnop', 6)).toBe('abcdef');
  });

  it('offers a site address from the name', () => {
    expect(defaultSiteAddress('Acme Help Centre')).toBe('acme-help-centre');
    expect(defaultSiteAddress('X')).toBe('x-kb');
    expect(defaultSiteAddress('')).toBe('knowledgebase');
    expect(defaultSiteAddress('Search')).toBe('search-kb');
  });

  it('numbers an address another holds', () => {
    expect(uniqueAddress('faq', new Set())).toBe('faq');
    expect(uniqueAddress('faq', new Set(['faq', 'faq-2']))).toBe('faq-3');
  });

  it('is offered to every knowledgebase for now', () => {
    expect(publishingOffered({ ownerId: 'u', teamId: null })).toBe(true);
  });
});

const pending = { approval: { state: 'pending', requestedBy: 'user_a', requestedAt: 1 } };
const rejected = { approval: { state: 'rejected', requestedBy: 'user_a', requestedAt: 1 } };
const tabs: ScopePage[] = [
  { id: 'start', name: 'Start Here' },
  { id: 'guides', name: 'Guides' },
  { id: 'setup', name: 'Setup', parent: 'guides' },
  { id: 'draft', name: 'Draft', parent: 'guides', knowledge: pending },
  { id: 'under-draft', name: 'Under Draft', parent: 'draft' },
  { id: 'no', name: 'Turned Down', knowledge: rejected },
  { id: 'linked', name: 'A Plan', connection: { app: 'liveplanner' } },
];

describe('the scope', () => {
  it('holds the whole knowledgebase without pending, rejected or connected rows', () => {
    const scope = publishableScope(tabs, null)!;
    expect(scope.pages).toEqual([
      { id: 'start', name: 'Start Here', parent: null },
      { id: 'guides', name: 'Guides', parent: null },
      { id: 'setup', name: 'Setup', parent: 'guides' },
      // Its pending parent stays private, and it hangs under the nearest published page.
      { id: 'under-draft', name: 'Under Draft', parent: 'guides' },
    ]);
    expect(scope.leftOut).toEqual([
      { id: 'draft', name: 'Draft', reason: 'pending' },
      { id: 'no', name: 'Turned Down', reason: 'rejected' },
    ]);
  });

  it('holds one section, its first page at the top', () => {
    const scope = publishableScope(tabs, 'guides')!;
    expect(scope.pages.map((p) => [p.id, p.parent])).toEqual([
      ['guides', null],
      ['setup', 'guides'],
      ['under-draft', 'guides'],
    ]);
    // A section whose first page is pending: its subpages sit at the top.
    const pendingRoot = publishableScope(tabs, 'draft')!;
    expect(pendingRoot.pages).toEqual([{ id: 'under-draft', name: 'Under Draft', parent: null }]);
  });

  it('refuses a page the knowledgebase does not have', () => {
    expect(publishableScope(tabs, 'nope')).toBeNull();
    expect(publishableScope(tabs, 'linked')).toBeNull();
  });

  it('leaves the empty pages out and moves their subpages up', () => {
    const scope = publishableScope(tabs, null)!;
    expect(withoutEmptyPages(scope, new Set())).toBe(scope);
    const without = withoutEmptyPages(scope, new Set(['guides']));
    expect(without.pages.map((p) => [p.id, p.parent])).toEqual([
      ['start', null],
      ['setup', null],
      ['under-draft', null],
    ]);
    expect(without.leftOut.at(-1)).toEqual({ id: 'guides', name: 'Guides', reason: 'empty' });
  });
});

const style = (over: Partial<KnowledgeStyle> = {}): KnowledgeStyle => ({
  ...DEFAULT_KNOWLEDGE_STYLE,
  ...over,
});

describe('the look', () => {
  it('holds the accent to 4.5:1 in both appearances and loads both faces', () => {
    const look = siteLook(style({ accent: '#d9f99d', headingFont: 'lora', bodyFont: 'inter' }));
    expect(look.accent).not.toBe('#d9f99d');
    expect(look.accentDark).toMatch(/^#[0-9a-f]{6}$/i);
    expect(look.fontsHref).toContain('family=Lora');
    expect(look.fontsHref).toContain('family=Inter');
    expect(look.headingFont).toContain('Lora');
  });

  it('takes the theme accent when none is picked, and one face once', () => {
    const look = siteLook(
      style({ textSize: 'large', lineSpacing: 'relaxed', headingStyle: 'ruled' }),
    );
    expect(look.fontsHref.match(/family=/g)).toHaveLength(1);
    expect(look).toMatchObject({ textPx: 19, lineHeight: 1.85, ruled: true });
    expect(siteCss(look)).toContain('border-bottom:1px solid var(--line)');
    expect(siteCss(siteLook(style()))).not.toContain('padding-bottom:.25em');
  });

  it('reads a font the catalogue lost as its first', () => {
    expect(siteLook(style({ bodyFont: 'gone' })).bodyFont).toContain('Inter');
  });
});

const view = (over: Partial<SiteView> = {}): SiteView => ({
  origin: 'https://www.liveknowledge.app',
  address: 'acme',
  name: 'Acme <Help>',
  noindex: false,
  look: siteLook(style()),
  tree: [
    { address: 'start-here', title: 'Start Here', icon: null, parent: null },
    { address: 'guides', title: 'Guides', icon: '📘', parent: null },
    { address: 'setup', title: '', icon: null, parent: 'guides' },
  ],
  ...over,
});

const page = (over: Partial<SitePage> = {}): SitePage => ({
  address: 'setup',
  title: '',
  icon: null,
  html: '<p>Hello</p>',
  description: 'Hello',
  savedAt: Date.UTC(2026, 10, 21, 23, 30),
  writers: [],
  ...over,
});

describe('a page', () => {
  it('words dates and names', () => {
    expect(siteDate(Date.UTC(2026, 0, 2))).toBe('2 January 2026');
    expect(namesList([])).toBe('');
    expect(namesList(['Ana'])).toBe('Ana');
    expect(namesList(['Ana', 'Ben'])).toBe('Ana and Ben');
    expect(namesList(['Ana', 'Ben', 'Cai'])).toBe('Ana, Ben and Cai');
    expect(sitePath('acme')).toBe('/kb/acme');
    expect(pagePath(view(), 'start-here')).toBe('/kb/acme');
    expect(pagePath(view(), 'guides')).toBe('/kb/acme/guides');
    expect(pagePath(view({ tree: [] }), 'guides')).toBe('/kb/acme/guides');
  });

  it('draws a subpage with its breadcrumb, tree, Previous and its SEO', () => {
    const html = renderSitePage(view(), page());
    expect(html).toContain('<title>Untitled Page · Acme &lt;Help&gt;</title>');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.liveknowledge.app/kb/acme/setup">',
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://www.liveknowledge.app/opengraph-image">',
    );
    expect(html).not.toContain('noindex');
    expect(html).toContain(
      '<ol class="crumbs" aria-label="Breadcrumb"><li><a href="/kb/acme/guides">Guides</a></li></ol>',
    );
    expect(html).toContain(
      '<details open><summary><a href="/kb/acme/guides">📘 Guides</a></summary>',
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('<span>Previous</span>Guides');
    expect(html).not.toContain('<span>Next</span>');
    expect(html).toContain('Updated 21 November 2026');
    expect(html).not.toContain('Written by');
    expect(html).not.toContain('<script');
    expect(html).toContain('<main id="main"><article class="column">');
  });

  it('opens the page with its cover band, as the snapshot drew it (P33)', () => {
    const cover = '<div class="cover"><img src="/kb/acme/media/pic" alt=""></div>';
    const html = renderSitePage(view(), page({ cover }));
    expect(html).toContain(`<main id="main">${cover}<article class="column">`);
    expect(renderSitePage(view(), page({ cover: '' }))).toContain(
      '<main id="main"><article class="column">',
    );
  });

  it('draws the front page with Next, its icon, writers and noindex', () => {
    const html = renderSitePage(
      view({ noindex: true, name: 'Start Here' }),
      page({
        address: 'start-here',
        title: 'Start Here',
        icon: '👋',
        writers: ['Ana', 'Ben'],
        description: '',
      }),
    );
    expect(html).toContain('<title>Start Here</title>');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<link rel="canonical" href="https://www.liveknowledge.app/kb/acme">');
    expect(html).toContain('<meta name="description" content="Start Here">');
    expect(html).toContain('<p class="icon" aria-hidden="true">👋</p>');
    expect(html).toContain('Written by Ana and Ben');
    expect(html).toContain('<span>Next</span>Guides');
    expect(html).not.toContain('class="crumbs"');
    expect(html).toContain('<details><summary>');
  });

  it('draws a page alone in its site, and one the tree does not hold', () => {
    const alone = renderSitePage(
      view({ tree: [{ address: 'only', title: 'Only', icon: null, parent: null }] }),
      page({ address: 'only', title: 'Only' }),
    );
    expect(alone).not.toContain('class="pager"');
    expect(alone).toContain('<title>Only · Acme &lt;Help&gt;</title>');
    expect(renderSitePage(view(), page({ address: 'missing' }))).not.toContain('class="pager"');
  });

  it('survives a tree that loops, and stops nesting deep trees', () => {
    const loop = view({
      tree: [
        { address: 'a', title: 'A', icon: null, parent: 'b' },
        { address: 'b', title: 'B', icon: null, parent: 'a' },
        { address: 'top', title: 'Top', icon: null, parent: null },
      ],
    });
    expect(renderSitePage(loop, page({ address: 'a', title: 'A' }))).toContain('<h1>A</h1>');
    const deep = Array.from({ length: 12 }, (_, i) => ({
      address: `p${i}`,
      title: `P${i}`,
      icon: null,
      parent: i === 0 ? null : `p${i - 1}`,
    }));
    const html = renderSitePage(view({ tree: deep }), page({ address: 'p11', title: 'P11' }));
    const nav = html.slice(html.indexOf('<nav class="side"'), html.indexOf('</nav>'));
    expect(nav).not.toContain('href="/kb/acme/p8"');
    expect(nav).toContain('href="/kb/acme/p7"');
  });
});

describe('search and the not found page', () => {
  it('asks for a word, says when nothing matches, and marks what does', () => {
    expect(renderSiteSearch(view(), '  ', [])).toContain('Type a word to search these pages.');
    expect(renderSiteSearch(view(), '  ', [])).toContain(
      '<title>Search · Acme &lt;Help&gt;</title>',
    );
    const none = renderSiteSearch(view(), '<b>x', []);
    expect(none).toContain('No page matches “&lt;b&gt;x”.');
    expect(none).toContain('value="&lt;b&gt;x"');
    const found = renderSiteSearch(view(), 'setup', [
      { address: 'setup', title: '', snippet: 'Run \u0002setup\u0003 <now>' },
      { address: 'start-here', title: 'Start Here', snippet: '' },
    ]);
    expect(found).toContain(
      '<a href="/kb/acme/setup">Untitled Page</a><p>Run <mark>setup</mark> &lt;now&gt;</p>',
    );
    expect(found).toContain('<a href="/kb/acme">Start Here</a></li>');
    expect(found).toContain('<title>Search: setup · Acme &lt;Help&gt;</title>');
  });

  it('draws an empty tree as an empty list', () => {
    expect(renderSiteSearch(view({ tree: [] }), '', [])).toContain(
      '<nav class="side" aria-label="Pages"><ul></ul></nav>',
    );
  });

  it('draws a not found page that names nothing', () => {
    const html = renderSiteNotFound();
    expect(html).toContain('Page Not Found');
    expect(html).toContain('noindex');
  });
});

describe('the sitemap', () => {
  it('lists every page with its last save, and none while hidden', () => {
    const saved = new Map([['guides', Date.UTC(2026, 10, 20)]]);
    const xml = renderSitemap(view(), saved);
    expect(xml).toContain('<url><loc>https://www.liveknowledge.app/kb/acme</loc></url>');
    expect(xml).toContain(
      '<url><loc>https://www.liveknowledge.app/kb/acme/guides</loc><lastmod>2026-11-20</lastmod></url>',
    );
    expect(renderSitemap(view({ noindex: true }), saved)).not.toContain('<url>');
  });
});
