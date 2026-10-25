import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { articleHref, categoryHref, topCategorySlug } from '@liveworkspace/help-registry';
import { CategoryArt } from './components/CategoryCard';
import { parentRouteHref } from './lib/article-route';
import { cardRoute, cardText, routeFromParams } from './lib/help-cards';
import { homeCategorySlugs, type HelpHomeLayout } from './lib/home';
import type { HelpSite } from './site';

// The help centre's catalogue checks (docs/specs/018-help in each product), written once and run by every help app
// over its own catalogue, art and home page (its lib/help-site.test.ts). Each one guards something nothing at
// runtime notices: a stale count, a card without a picture, a page missing from the home, a card the font can't draw.

export interface HelpSiteSuiteOptions {
  home: HelpHomeLayout;
  /** The product's social-card subtitle limit (CARD_SUBTITLE_MAX in its ui package). */
  cardSubtitleMax: number;
  /** The app's `app/` folder, where the route files say which category pages number their cards. */
  appDir: string;
}

/** A category with more cards than this is split into named groups (help-pages.md "Groups"). */
export const MAX_UNGROUPED = 12;

export function describeHelpSite(
  site: HelpSite,
  { home, cardSubtitleMax, appDir }: HelpSiteSuiteOptions,
) {
  const { articles, categories, getCategoryGroups } = site.catalogue;
  const featureSlugs = new Set(categories.filter((c) => c.kind === 'feature').map((c) => c.slug));

  // help-app.md: `articleCount` is hand-maintained, and a stale one only shows as a wrong number on a card.
  describe('category articleCount', () => {
    it('matches the articles registered under each category, sub-articles included', () => {
      const wrong = categories
        .map((c) => {
          const actual = articles.filter((a) => a.categorySlug === c.slug).length;
          return actual === c.articleCount
            ? null
            : `${c.slug}: says ${c.articleCount}, has ${actual}`;
        })
        .filter(Boolean);
      expect(wrong).toEqual([]);
    });

    it('every article sits in a category that exists', () => {
      const slugs = new Set(categories.map((c) => c.slug));
      const orphans = articles
        .filter((a) => !slugs.has(topCategorySlug(a.categorySlug)))
        .map((a) => `${a.slug} -> ${a.categorySlug}`);
      expect(orphans).toEqual([]);
    });

    it('every sub-article names a parent that exists', () => {
      // A parent is either another article or the category's own landing page.
      const known = new Set([...articles.map((a) => a.slug), ...categories.map((c) => c.slug)]);
      const dangling = articles
        .filter((a) => a.parentSlug && !known.has(a.parentSlug))
        .map((a) => `${a.slug} -> ${a.parentSlug}`);
      expect(dangling).toEqual([]);
    });
  });

  // help-pages.md "Groups": a category with more than a dozen cards is split into named groups, every card in it
  // belongs to one, and the category's `groups` names exactly the groups its cards use, in order.
  describe('category groups', () => {
    it.each(categories.map((c) => c.slug))('%s is grouped once it outgrows one grid', (slug) => {
      const groups = getCategoryGroups(slug);
      const cards = groups.reduce((n, g) => n + g.articles.length, 0);
      if (cards > MAX_UNGROUPED) expect(groups.every((g) => g.group !== '')).toBe(true);
    });

    it.each(categories.filter((c) => c.groups).map((c) => [c.slug, c.groups!] as const))(
      '%s lists its groups in the order they show',
      (slug, order) => {
        expect(getCategoryGroups(slug).map((g) => g.group)).toEqual(order);
      },
    );
  });

  // help-pages.md "Home page": every category appears on the home page exactly once, and every popular topic is a
  // real article.
  describe('home page sections', () => {
    it('shows every category exactly once', () => {
      const shown = homeCategorySlugs(home);
      expect([...shown].sort()).toEqual(categories.map((c) => c.slug).sort());
      expect(new Set(shown).size).toBe(shown.length);
    });

    it('puts only feature categories under Editor Guides', () => {
      const editor = home.sections.find((s) => s.id === 'editor-guides')!;
      expect([...editor.categories].sort()).toEqual([...featureSlugs].sort());
    });

    it('names a real article for every Start here step', () => {
      const { steps } = home.startHere;
      const paths = typeof steps === 'number' ? [] : steps;
      const missing = paths.filter((p) => !articles.some((a) => `${a.categorySlug}/${a.slug}` === p));
      expect(missing).toEqual([]);
    });

    it.each(home.popular.map((t) => [t.label, t.path]))(
      'popular topic %s names a real article',
      (_, path) => {
        expect(articles.some((a) => `${a.categorySlug}/${a.slug}` === path)).toBe(true);
      },
    );
  });

  // help-pages.md "Article pages": an article's previous and next are its neighbours in the order its listing page
  // shows, and every article page finds itself in the registry.
  describe('article neighbours', () => {
    it('finds every article by its title', () => {
      for (const a of articles) expect(site.articleByTitle(a.title)).toBe(a);
    });

    it('links each article to the next one and back again', () => {
      for (const a of articles) {
        const { prev, next } = site.articleNeighbours(a);
        if (next) expect(site.articleNeighbours(next).prev).toBe(a);
        if (prev) expect(site.articleNeighbours(prev).next).toBe(a);
      }
    });
  });

  // help-app.md "SEO": the breadcrumb's parent crumb links to the route one level up, so every article that names a
  // parent must sit directly under a real page.
  describe('sub-article parents', () => {
    const withParent = readdirSync(appDir, { recursive: true })
      .map((p) => String(p).replaceAll('\\', '/'))
      .filter((p) => p.endsWith('/page.mdx'))
      .map((p) => p.slice(0, -'/page.mdx'.length))
      .filter((dir) =>
        /parentArticle=\{/.test(readFileSync(join(appDir, dir, 'page.mdx'), 'utf8')),
      );

    it('finds the sub-articles (guard against this test going blind)', () => {
      expect(withParent.length).toBeGreaterThan(20);
    });

    it('every sub-article sits directly under a real page', () => {
      const orphaned = withParent.filter((dir) => {
        const parent = parentRouteHref(`/${dir}`).replace(/^\/|\/$/g, '');
        return !(
          existsSync(join(appDir, parent, 'page.mdx')) ||
          existsSync(join(appDir, parent, 'page.tsx'))
        );
      });
      expect(orphaned).toEqual([]);
    });
  });

  // help-app.md "SEO": every article and category landing has its own social card, drawable without a font fetch.
  describe('help social cards', () => {
    it('has a card for every article and every category landing', () => {
      for (const a of articles)
        expect(site.cards.has(cardRoute(articleHref(a))), a.slug).toBe(true);
      for (const c of categories)
        expect(site.cards.has(cardRoute(categoryHref(c.slug))), c.slug).toBe(true);
      expect(site.cards.size).toBe(articles.length + categories.length);
    });

    it('keeps every subtitle to two lines, ending on a whole word', () => {
      for (const [route, card] of site.cards) {
        expect(card.subtitle.length, route).toBeLessThanOrEqual(cardSubtitleMax);
        expect(card.subtitle, route).toMatch(/(?:[.!?)]|\w…|\w)$/);
      }
    });

    it('uses only characters the card font carries, so the build never fetches one', () => {
      // Printable Latin (to Latin Extended-B) plus the typographic punctuation the copy uses.
      const outside = /[^ -ɏ‘’“”…–—]/u;
      for (const [route, card] of site.cards) {
        for (const text of [card.kicker, card.title, card.subtitle]) {
          expect(outside.exec(text)?.[0], `${route}: ${text}`).toBeUndefined();
        }
      }
      expect(cardText('The Command Palette (⌘K)')).toBe('The Command Palette (Cmd+K)');
    });

    it('builds one PNG path per card and reads it back', () => {
      const params = site.cardParams();
      expect(params).toHaveLength(site.cards.size);
      for (const { card } of params) expect(site.cards.has(routeFromParams(card)!)).toBe(true);
    });
  });

  // help-pages.md "Category art": every category with a card has its own scene, and every scene is decorative art
  // on the help-art stage (so the dark appearance reaches it).
  describe('category art', () => {
    const withCards = categories.filter((c) => c.slug !== 'contact');
    const art = site.art.categoryArt;

    it('gives every category with a card its own scene, and none to a category that does not exist', () => {
      expect(Object.keys(art).sort()).toEqual(withCards.map((c) => c.slug).sort());
      expect(new Set(Object.values(art)).size).toBe(withCards.length);
    });

    it.each(withCards.map((c) => c.slug))(
      '%s draws on the stage, hidden from assistive tech',
      (slug) => {
        const html = renderToStaticMarkup(<CategoryArt site={site} slug={slug} />);
        expect(html).toMatch(/^<svg[^>]*class="help-art /);
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('viewBox="0 0 400 220"');
      },
    );

    it('renders nothing for a slug without a scene', () => {
      expect(renderToStaticMarkup(<CategoryArt site={site} slug="contact" />)).toBe('');
    });
  });

  // help-app.md: a support card's glyph is its own entry, then a feature glyph sharing its slug, then one generic
  // document glyph. Nothing at runtime tells "no icon yet" from "icon on purpose", so a card reaching the generic
  // glyph fails here. A numbered category's cards lead with a step badge instead, read off the route files so moving
  // the numbering moves the exemption with it.
  describe('support card icons', () => {
    const numbered = new Set(
      readdirSync(appDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .filter((e) => {
          try {
            return /<SupportCategoryPage[^>]*\snumbered\b/.test(
              readFileSync(join(appDir, e.name, 'page.tsx'), 'utf8'),
            );
          } catch {
            return false;
          }
        })
        .map((e) => e.name),
    );
    const supportCards = articles.filter((a) => {
      const top = topCategorySlug(a.categorySlug);
      return !featureSlugs.has(top) && !numbered.has(top);
    });
    const { supportIcons, featureIcons, supportFallback } = site.art;

    it('found the numbered category, so the exemption is real', () => {
      expect([...numbered]).toEqual(['getting-started']);
    });

    it('found support cards at all', () => {
      expect(supportCards.length).toBeGreaterThan(20);
    });

    it('gives every support card a glyph of its own, not the generic document', () => {
      const generic = supportCards
        .filter((a) => !supportIcons[a.slug] && !featureIcons[a.slug])
        .map((a) => `${a.categorySlug}/${a.slug}`);
      expect(generic).toEqual([]);
    });

    it('keeps the generic fallback around as the safety net', () => {
      expect(supportFallback).toBeTruthy();
    });

    it('defines no support icon for a slug that is not an article', () => {
      const slugs = new Set(articles.map((a) => a.slug));
      expect(Object.keys(supportIcons).filter((s) => !slugs.has(s))).toEqual([]);
    });
  });
}
