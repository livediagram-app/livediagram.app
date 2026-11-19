import { describe, expect, it } from 'vitest';
import { APP_ORDER, inAppOrder } from './apps';
import {
  allArticles,
  APP_CATALOGUES,
  articlesFor,
  catalogueFor,
  categoriesFor,
  guideCounts,
  HELP_REDIRECTS,
  searchIndexFor,
} from './catalogue';
import { sharedArticles } from './catalogue/shared';
import { topCategorySlug } from './types';
import { articlePath } from './telemetry';

// The one catalogue's rules (liveworkspace/docs/specs/016-help/blueprints/help-centre.md "Tests").

describe('the one catalogue', () => {
  it('names at least one app for every article, in registry order', () => {
    for (const a of allArticles) {
      expect(a.apps.length, articlePath(a)).toBeGreaterThan(0);
      expect([...a.apps], articlePath(a)).toEqual(inAppOrder(a.apps));
    }
  });

  it('holds each path once', () => {
    const paths = allArticles.map(articlePath);
    expect(paths.length).toBe(new Set(paths).size);
  });

  it("keeps an app's own file to articles for that app alone, and shared ones to two or more apps", () => {
    for (const app of APP_ORDER)
      for (const a of APP_CATALOGUES[app].articles)
        expect([...a.apps], articlePath(a)).toEqual([app]);
    for (const a of sharedArticles) expect(a.apps.length, articlePath(a)).toBeGreaterThan(1);
  });

  it("files every article under one of its apps' categories", () => {
    for (const app of APP_ORDER) {
      const slugs = new Set(APP_CATALOGUES[app].categories.map((c) => c.slug));
      for (const a of articlesFor(app))
        expect(slugs.has(topCategorySlug(a.categorySlug)), `${app}: ${articlePath(a)}`).toBe(true);
    }
  });

  it("gives every category its articles' apps and its direct count in the scope", () => {
    for (const scope of [...APP_ORDER, 'all'] as const) {
      const scoped = articlesFor(scope);
      for (const c of categoriesFor(scope)) {
        const under = allArticles.filter((a) => topCategorySlug(a.categorySlug) === c.slug);
        expect(c.apps, `${scope}: ${c.slug}`).toEqual(inAppOrder(under.flatMap((a) => a.apps)));
        expect(c.articleCount).toBe(scoped.filter((a) => a.categorySlug === c.slug).length);
      }
    }
  });

  it('counts each scope', () => {
    const counts = guideCounts();
    expect(counts.all).toBe(allArticles.length);
    for (const app of APP_ORDER) expect(counts[app]).toBe(catalogueFor(app).articles.length);
  });

  it('redirects only to paths that exist', () => {
    const paths = new Set(allArticles.map(articlePath));
    const categories = new Set(categoriesFor('all').map((c) => c.slug));
    for (const r of HELP_REDIRECTS) {
      if (r.to === '' || r.to.startsWith('https://')) continue;
      const to = r.to.split('#')[0]!;
      expect(paths.has(to) || categories.has(to), `${r.from} -> ${r.to}`).toBe(true);
    }
  });
});

describe('per-app wording in the catalogue', () => {
  it('names only apps an article applies to, and words each app scope with them', () => {
    for (const a of allArticles) {
      for (const app of Object.keys(a.byApp ?? {}))
        expect(a.apps, `${articlePath(a)} byApp.${app}`).toContain(app);
    }
    for (const app of APP_ORDER) {
      const byPath = new Map(articlesFor(app).map((a) => [articlePath(a), a]));
      for (const a of allArticles) {
        const own = a.byApp?.[app];
        if (!own || !a.apps.includes(app)) continue;
        const shown = byPath.get(articlePath(a))!;
        if (own.title) expect(shown.title).toBe(own.title);
        if (own.description) expect(shown.description).toBe(own.description);
      }
    }
  });

  it('searches an app in its own wording', () => {
    for (const app of APP_ORDER) {
      const titles = new Set(searchIndexFor(app).map((e) => e.title));
      for (const a of articlesFor(app)) expect(titles.has(a.title), articlePath(a)).toBe(true);
    }
  });
});
