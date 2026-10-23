import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { COMPETITOR_LOOK } from './competitor-look';
import {
  ALTERNATIVE_GROUPS,
  ALTERNATIVE_SLUGS,
  ALTERNATIVES,
  ALTERNATIVES_LAST_UPDATED,
  getAlternative,
} from './index';

// ALTERNATIVES drives the dynamic /alternatives/<slug> route's generateStaticParams, every page's
// metadata, the hub and the sitemap. A drift in the data (a duplicated slug, an entry missing
// required copy, a slug that would 404 in a static export) would break SEO and routing in ways a
// normal render doesn't show.
//
// The honesty rules in liveworkspace/docs/comparison-pages.md are not enforceable from a test, but
// these pin the shape they depend on: both sides of "Which to pick" are filled, every row has both
// cells, and so on. product-claims.test.ts keeps out claims found false.

describe('ALTERNATIVES catalogue', () => {
  it('has comparisons for the hub, the route and the sitemap', () => {
    expect(ALTERNATIVES.length).toBeGreaterThan(0);
  });

  it('has unique, URL-safe slugs', () => {
    expect(new Set(ALTERNATIVE_SLUGS).size).toBe(ALTERNATIVE_SLUGS.length);
    for (const slug of ALTERNATIVE_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(ALTERNATIVE_SLUGS).toEqual(ALTERNATIVES.map((a) => a.slug));
  });

  it('names at least one known app on every comparison', () => {
    const known = new Set(APP_SITES.map((s) => s.id));
    for (const alt of ALTERNATIVES) {
      expect(alt.apps.length, alt.slug).toBeGreaterThan(0);
      for (const app of alt.apps) expect(known.has(app), `${alt.slug}: ${app}`).toBe(true);
    }
  });

  it('dates every comparison, and the hub by the newest', () => {
    for (const alt of ALTERNATIVES) expect(Number.isNaN(alt.updated.getTime()), alt.slug).toBe(false);
    expect(ALTERNATIVES_LAST_UPDATED.getTime()).toBe(
      Math.max(...ALTERNATIVES.map((a) => a.updated.getTime())),
    );
  });

  it('lists every comparison in exactly one hub group', () => {
    expect(ALTERNATIVE_GROUPS.flatMap((g) => g.alternatives)).toEqual(ALTERNATIVES);
    for (const group of ALTERNATIVE_GROUPS) {
      for (const alt of group.alternatives) {
        if (group.app) expect(alt.apps, alt.slug).toEqual([group.app]);
        else expect(alt.apps.length, alt.slug).toBeGreaterThan(1);
      }
    }
  });

  it('fills every SEO and copy field', () => {
    for (const alt of ALTERNATIVES) {
      for (const field of ['name', 'title', 'description', 'h1', 'lede'] as const) {
        expect(alt[field].length, `${field} for ${alt.slug}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives a meta description that fits a search result', () => {
    // A result shows about 160 characters and cuts the rest; under about 50 is too thin to earn
    // the click.
    for (const alt of ALTERNATIVES) {
      expect(alt.description.length, alt.slug).toBeGreaterThanOrEqual(50);
      expect(alt.description.length, alt.slug).toBeLessThanOrEqual(160);
    }
  });

  it('fills both cells of every row', () => {
    for (const alt of ALTERNATIVES) {
      expect(alt.rows.length, `rows for ${alt.slug}`).toBeGreaterThan(0);
      for (const row of alt.rows) {
        expect(row.label.length, alt.slug).toBeGreaterThan(0);
        expect(row.us.length, `${alt.slug}: ${row.label}`).toBeGreaterThan(0);
        expect(row.them.length, `${alt.slug}: ${row.label}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives real reasons on both sides of "Which to pick"', () => {
    for (const alt of ALTERNATIVES) {
      expect(alt.usBest.length, `usBest for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.themBest.length, `themBest for ${alt.slug}`).toBeGreaterThan(0);
      for (const point of [...alt.usBest, ...alt.themBest]) expect(point.length).toBeGreaterThan(0);
    }
  });

  it('carries deep-dive sections with a heading and prose', () => {
    for (const alt of ALTERNATIVES) {
      expect(alt.sections.length, `sections for ${alt.slug}`).toBeGreaterThan(0);
      for (const section of alt.sections) {
        expect(section.heading.length, alt.slug).toBeGreaterThan(0);
        expect(section.paragraphs.length, `${alt.slug}: ${section.heading}`).toBeGreaterThan(0);
        for (const p of section.paragraphs) expect(p.length).toBeGreaterThan(0);
      }
    }
  });

  it('answers every FAQ, since each feeds the FAQPage JSON-LD', () => {
    for (const alt of ALTERNATIVES) {
      expect(alt.faqs.length, `faqs for ${alt.slug}`).toBeGreaterThan(0);
      for (const faq of alt.faqs) {
        expect(faq.q.length, alt.slug).toBeGreaterThan(0);
        expect(faq.a.length, `${alt.slug}: ${faq.q}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('getAlternative', () => {
  it('finds a known slug, exactly as written', () => {
    const first = ALTERNATIVES[0]!;
    expect(getAlternative(first.slug)).toBe(first);
    // A case-insensitive lookup would render a non-canonical URL.
    expect(getAlternative(first.slug.toUpperCase())).toBeUndefined();
  });

  it('finds nothing for an unknown slug, rather than a default page', () => {
    expect(getAlternative('this-competitor-does-not-exist')).toBeUndefined();
    expect(getAlternative('')).toBeUndefined();
  });
});

describe('COMPETITOR_LOOK', () => {
  it('draws every comparison, and nothing that is not one', () => {
    expect(Object.keys(COMPETITOR_LOOK).sort()).toEqual([...ALTERNATIVE_SLUGS].sort());
  });

  it('gives every competitor its own glyph and tone', () => {
    const looks = Object.values(COMPETITOR_LOOK);
    expect(new Set(looks.map((l) => l.panel)).size).toBe(looks.length);
  });

  it('keeps every highlight chip short enough for one line', () => {
    for (const look of Object.values(COMPETITOR_LOOK)) {
      for (const chip of look.highlights) expect(chip.length).toBeLessThanOrEqual(24);
    }
  });
});
