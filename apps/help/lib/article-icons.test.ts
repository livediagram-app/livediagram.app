import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { articles, categories } from './articles';
import { SUPPORT_ARTICLE_FALLBACK, SUPPORT_ARTICLE_ICONS } from './articleIcons';
import { FEATURE_ICONS } from './featureIcons';

// The support half of the card catalogue (spec/55), the sibling of
// feature-icons.test.ts.
//
// `ArticleCard` resolves a glyph in three steps: the article's own entry in
// SUPPORT_ARTICLE_ICONS, then any FEATURE_ICONS entry sharing its slug, then one
// generic document glyph. That last step is why this needs a test — 13 of the 40
// icon-showing support cards sat on it, a third of the grid drawing the same
// picture, and nothing at runtime can tell the difference between "no icon yet"
// and "icon on purpose". A card added tomorrow lands there silently.

const APP = join(__dirname, '..', 'app');

const FEATURE_CATEGORIES = new Set(
  categories.filter((c) => c.kind === 'feature').map((c) => c.slug),
);

// Which category pages number their cards? A numbered card leads with a step
// badge INSTEAD of an icon, so its articles are exempt — but the exemption is
// read off the pages rather than hardcoded here, so moving the numbering to
// another category (or dropping it) forces this file to be revisited instead of
// quietly exempting the wrong set.
function numberedCategories(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => {
      const page = join(APP, e.name, 'page.tsx');
      try {
        return /<ArticleCard[^>]*\snumber=/.test(readFileSync(page, 'utf8'));
      } catch {
        return false;
      }
    })
    .map((e) => e.name);
}

const numbered = new Set(numberedCategories());

// Support cards are everything outside the ten feature categories; those render
// through FeatureArticleCard and are covered by feature-icons.test.ts.
const supportCards = articles.filter((a) => {
  const top = a.categorySlug.split('/')[0]!;
  return !FEATURE_CATEGORIES.has(top) && !numbered.has(top);
});

describe('support card icons', () => {
  it('found the numbered category, so the exemption below is real', () => {
    // Getting Started is the one numbered browse page today. If this changes,
    // the exemption changes with it rather than silently covering the wrong set.
    expect(numbered.size).toBeGreaterThan(0);
    expect([...numbered]).toEqual(['getting-started']);
  });

  it('found support cards at all', () => {
    expect(supportCards.length).toBeGreaterThan(20);
  });

  it('gives every support card a glyph of its own, not the generic document', () => {
    // Either map satisfies this, because either one satisfies ArticleCard: a
    // handful of slugs exist in both halves of the help centre and the feature
    // glyph is the right drawing for them.
    const generic = supportCards
      .filter((a) => !SUPPORT_ARTICLE_ICONS[a.slug] && !FEATURE_ICONS[a.slug])
      .map((a) => `${a.categorySlug}/${a.slug}`);
    expect(generic).toEqual([]);
  });

  it('keeps the generic fallback around as the safety net', () => {
    // The point is that nothing REACHES it, not that it is gone: a card added
    // without a glyph must still render while CI tells you to draw one.
    expect(SUPPORT_ARTICLE_FALLBACK).toBeTruthy();
  });

  it('defines no support icon for a slug that is not an article', () => {
    // A dead entry is a glyph drawn for a card that was renamed or removed —
    // harmless to render, misleading to read.
    const slugs = new Set(articles.map((a) => a.slug));
    expect(Object.keys(SUPPORT_ARTICLE_ICONS).filter((s) => !slugs.has(s))).toEqual([]);
  });
});
