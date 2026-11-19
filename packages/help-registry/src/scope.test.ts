import { describe, expect, it } from 'vitest';
import { appList, inAppOrder, isHelpScope, SCOPE_WORDS } from './apps';
import { HELP_REDIRECTS, redirectFor } from './catalogue/redirects';
import {
  appliesTo,
  articleHref,
  canonicalArticleUrl,
  canonicalScope,
  helpUrl,
  QUERY_MAX,
  switchHref,
  withQuery,
} from './hrefs';
import {
  allAppsCategories,
  articlesIn,
  inReadingOrder,
  mergeOrders,
  searchIndex,
  withCounts,
  wordedArticle,
  wordedCategory,
} from './scope';
import type { Article, Category } from './types';

// The scope views (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "The catalogue", "The app switch").

const article = (path: string, apps: Article['apps']): Article => {
  const at = path.lastIndexOf('/');
  const categorySlug = path.slice(0, at);
  return {
    slug: path.slice(at + 1),
    title: path,
    description: '',
    keywords: '',
    category: categorySlug,
    categorySlug,
    apps,
  };
};

const shared = article('tabs/using-tabs', ['livediagram', 'liveplanner']);
const diagramOnly = article('canvas/shapes', ['livediagram']);
const plannerOnly = article('plan/boards', ['liveplanner']);
const nested = article('tabs/using-tabs/tab-folders', ['livediagram', 'livedesign']);
const all = [shared, diagramOnly, plannerOnly, nested];

describe('apps', () => {
  it('keeps apps in registry order, each once', () => {
    expect(inAppOrder(['livehuddle', 'livediagram', 'livehuddle'])).toEqual([
      'livediagram',
      'livehuddle',
    ]);
  });
  it('names the work per scope, "file" for every app', () => {
    expect(SCOPE_WORDS.liveplanner.noun).toBe('plan');
    expect(SCOPE_WORDS.livehuddle.nouns).toBe('Spaces');
    expect(SCOPE_WORDS.all.noun).toBe('file');
  });
  it('reads a list of apps as prose', () => {
    expect(appList(['livedocuments', 'livedesign'])).toBe('livedocuments and livedesign');
    expect(appList(['livediagram', 'liveplanner', 'livedesign'])).toBe(
      'livediagram, liveplanner and livedesign',
    );
  });
  it('knows its scopes', () => {
    expect(isHelpScope('all')).toBe(true);
    expect(isHelpScope('liveworkspace')).toBe(false);
  });
});

describe('articlesIn', () => {
  it("keeps an app's articles, and every article under All Apps", () => {
    expect(articlesIn(all, 'liveplanner')).toEqual([shared, plannerOnly]);
    expect(articlesIn(all, 'all')).toEqual(all);
  });
});

describe('reading order', () => {
  it('merges orders, placing a later list after the path it follows', () => {
    expect(mergeOrders([['a', 'b', 'c'], ['a', 'x', 'c', 'y'], ['z']])).toEqual([
      'z',
      'a',
      'x',
      'b',
      'c',
      'y',
    ]);
  });
  it('sorts by the order, unlisted articles after the listed ones', () => {
    expect(inReadingOrder(all, ['plan/boards', 'tabs/using-tabs'])).toEqual([
      plannerOnly,
      shared,
      diagramOnly,
      nested,
    ]);
  });
});

describe('category counts', () => {
  const categories: Category[] = [
    { slug: 'tabs', title: 'Tabs', description: '', articleCount: 99 },
    { slug: 'canvas', title: 'Canvas', description: '', articleCount: 99 },
  ];
  it('counts the direct articles in the scope and the apps under the category', () => {
    const [tabs, canvas] = withCounts(categories, articlesIn(all, 'livedesign'), all);
    expect(tabs).toMatchObject({ articleCount: 0, apps: ['livediagram', 'liveplanner', 'livedesign'] });
    expect(canvas).toMatchObject({ articleCount: 0, apps: ['livediagram'] });
    const [diagramTabs] = withCounts(categories, articlesIn(all, 'livediagram'), all);
    expect(diagramTabs!.articleCount).toBe(1);
  });
  it("gives All Apps its own copy and order, every app's categories once", () => {
    const merged = allAppsCategories(
      [
        [{ slug: 'about', title: 'About livediagram', description: 'd', articleCount: 1 }],
        [
          { slug: 'plan', title: 'Plan', description: 'p', articleCount: 1, kind: 'feature' },
          { slug: 'about', title: 'About liveplanner', description: 'p', articleCount: 1 },
        ],
      ],
      [{ slug: 'about', title: 'About the Apps', description: 'every' }],
    );
    expect(merged.map((c) => [c.slug, c.title])).toEqual([
      ['about', 'About the Apps'],
      ['plan', 'Plan'],
    ]);
  });
});

describe('addresses', () => {
  it('builds a scope address, absolute', () => {
    expect(helpUrl('liveplanner')).toMatch(/\/help$/);
    expect(articleHref(shared)).toBe('/tabs/using-tabs/');
    expect(articleHref(shared, 'all')).toBe(`${helpUrl('all')}/tabs/using-tabs/`);
  });
  it('puts an article for one app on its address, for several on liveworkspace.app', () => {
    expect(canonicalScope(diagramOnly, 'all')).toBe('livediagram');
    expect(canonicalScope(shared, 'livediagram')).toBe('all');
    expect(canonicalScope({}, 'livedesign')).toBe('livedesign');
    expect(canonicalArticleUrl(diagramOnly)).toBe(`${helpUrl('livediagram')}/canvas/shapes/`);
  });
  it("switches to the same path where it applies, else the target's home", () => {
    expect(appliesTo(shared, 'liveplanner')).toBe(true);
    expect(appliesTo(shared, 'livedesign')).toBe(false);
    expect(switchHref('liveplanner', '/tabs/using-tabs/', shared.apps)).toBe(
      `${helpUrl('liveplanner')}/tabs/using-tabs/`,
    );
    expect(switchHref('livedesign', '/tabs/using-tabs/', shared.apps)).toBe(
      `${helpUrl('livedesign')}/`,
    );
    expect(switchHref('all', '/canvas/shapes/', diagramOnly.apps)).toBe(
      `${helpUrl('all')}/canvas/shapes/`,
    );
    expect(switchHref('livehuddle', '/contact/', undefined)).toBe(`${helpUrl('livehuddle')}/contact/`);
  });
  it('carries the search box, trimmed and capped, and nothing when it is empty', () => {
    expect(withQuery('https://x.test/help/', '  ')).toBe('https://x.test/help/');
    expect(withQuery('https://x.test/help/', ' share link ')).toBe(
      'https://x.test/help/?q=share%20link',
    );
    expect(withQuery('https://x.test/help/a/#b', 'x')).toBe('https://x.test/help/a/?q=x#b');
    const long = withQuery('/', 'a'.repeat(500));
    expect(long).toBe(`/?q=${'a'.repeat(QUERY_MAX)}`);
  });
});

describe('redirects', () => {
  it('holds an app-limited redirect only on its apps, prefixes after exact paths', () => {
    expect(redirectFor(HELP_REDIRECTS, 'canvas/links', 'livedocuments')?.to).toBe('canvas');
    expect(redirectFor(HELP_REDIRECTS, 'canvas/links', 'livediagram')).toBeUndefined();
    expect(redirectFor(HELP_REDIRECTS, 'self-hosting/docker', 'livedesign')?.to).toBe('');
    expect(redirectFor(HELP_REDIRECTS, 'explorer/timeline', 'livehuddle')?.to).toBe('explorer/home');
  });
  it('never sends a path to itself', () => {
    for (const r of HELP_REDIRECTS) expect(r.to, r.from).not.toBe(r.from);
  });
});

describe('per-app wording', () => {
  const worded: Article = {
    ...shared,
    title: 'Using Tabs',
    description: 'Shared copy.',
    group: 'Tabs',
    byApp: { liveplanner: { title: 'Plan Tabs', description: 'Planner copy.', group: 'Boards', category: 'Plan' } },
  };

  it("shows an app its own wording, every field it names", () => {
    expect(wordedArticle(worded, 'liveplanner')).toMatchObject({
      title: 'Plan Tabs',
      description: 'Planner copy.',
      group: 'Boards',
      category: 'Plan',
      byApp: worded.byApp,
    });
  });

  it('keeps the shared wording for All Apps and for an app with no entry (the same object)', () => {
    expect(wordedArticle(worded, 'all')).toBe(worded);
    expect(wordedArticle(worded, 'livediagram')).toBe(worded);
  });

  it('replaces only the fields an entry names', () => {
    const partial = { ...worded, byApp: { livediagram: { title: 'Canvas Tabs' } } };
    expect(wordedArticle(partial, 'livediagram')).toMatchObject({
      title: 'Canvas Tabs',
      description: 'Shared copy.',
      group: 'Tabs',
    });
  });

  it("words a category for its app only", () => {
    const category: Category = {
      slug: 'tabs',
      title: 'Tabs',
      description: 'Shared.',
      articleCount: 0,
      byApp: { livedesign: { description: 'Designer copy.' } },
    };
    expect(wordedCategory(category, 'livedesign')).toMatchObject({ title: 'Tabs', description: 'Designer copy.' });
    expect(wordedCategory(category, 'all')).toBe(category);
  });
});

describe('the search index', () => {
  it('keeps only the fields a result reads, in the scope wording', () => {
    const worded = { ...diagramOnly, parentSlug: 'x', group: 'G', byApp: { livediagram: { title: 'Shapes!' } } };
    const [entry] = searchIndex([worded], 'livediagram');
    expect(entry).toEqual({
      slug: 'shapes',
      title: 'Shapes!',
      description: '',
      keywords: '',
      category: 'canvas',
      categorySlug: 'canvas',
      apps: ['livediagram'],
    });
  });

  it("words a one-app article as its app under All Apps, a shared one as All Apps", () => {
    const one = { ...diagramOnly, byApp: { livediagram: { title: 'Diagram Shapes' } } };
    const two = { ...shared, byApp: { livediagram: { title: 'Diagram Tabs' } } };
    expect(searchIndex([one, two], 'all').map((e) => e.title)).toEqual(['Diagram Shapes', 'tabs/using-tabs']);
  });
});
