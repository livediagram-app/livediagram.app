import { describe, expect, it } from 'vitest';
import { ALTERNATIVES, ALTERNATIVE_SLUGS, getAlternative } from './alternatives';

// `ALTERNATIVES` drives the dynamic `/alternatives/<slug>` route's
// `generateStaticParams`, every page's per-slug metadata, the
// /alternatives index list, and the sitemap entries. A drift in
// the data (a duplicated slug, an entry missing required copy, a
// slug with a space in it that would 404 in a static export) would
// break SEO + routing in ways that don't surface during normal
// page renders.
//
// The honesty rules in spec/21 (every claim maps to a shipped
// feature; every competitor gets a real "where they're the better
// pick" section; comparisons stay qualitative) are not enforceable
// from a test, but the structural invariants below pin the shape
// the rules depend on (themBest + usBest are non-empty; every row
// has both `us` and `them` values, etc.).

describe('ALTERNATIVES catalogue', () => {
  it('has at least one entry (the route, the sitemap, and the index page all assume non-empty)', () => {
    expect(ALTERNATIVES.length).toBeGreaterThan(0);
  });

  it('has unique slugs (a duplicate would PK-collide on the static-params build)', () => {
    const slugs = ALTERNATIVES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug is URL-safe (lowercase, alphanumeric + hyphens, no spaces or underscores)', () => {
    // The slug becomes a path segment under /alternatives/<slug>.
    // Spaces would 404 in a static export; uppercase would mismatch
    // the canonical case Google indexes; underscores would diverge
    // from the established kebab-case across the marketing site.
    for (const alt of ALTERNATIVES) {
      expect(alt.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every entry carries non-empty SEO + copy fields (title, description, h1, lede, name)', () => {
    // generateMetadata pulls title + description verbatim from the
    // entry; the page renders h1 + lede + the competitor name in
    // the table header and CTA. An entry with a missing field would
    // silently render an empty heading or an empty <title> in the
    // <head>.
    for (const alt of ALTERNATIVES) {
      expect(alt.slug.length, `slug for ${alt.name}`).toBeGreaterThan(0);
      expect(alt.name.length, `name for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.title.length, `title for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.description.length, `description for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.h1.length, `h1 for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.lede.length, `lede for ${alt.slug}`).toBeGreaterThan(0);
    }
  });

  it('every comparison row carries both `us` and `them` strings', () => {
    // The page renders rows as a 3-col table (label, us, them). A
    // missing cell would leave a visible blank gap and undermine
    // the side-by-side framing.
    for (const alt of ALTERNATIVES) {
      expect(alt.rows.length, `rows for ${alt.slug}`).toBeGreaterThan(0);
      for (const row of alt.rows) {
        expect(row.label.length, `row.label for ${alt.slug}`).toBeGreaterThan(0);
        expect(row.us.length, `row.us "${row.label}" for ${alt.slug}`).toBeGreaterThan(0);
        expect(row.them.length, `row.them "${row.label}" for ${alt.slug}`).toBeGreaterThan(0);
      }
    }
  });

  it('every entry has at least one usBest and one themBest point', () => {
    // spec/21 honesty rule: each comparison page MUST include real
    // reasons to pick the competitor (themBest) alongside the
    // livediagram differentiators (usBest). Both arrays are
    // rendered as bulleted lists; an empty themBest would leave a
    // visibly empty "Where <competitor> is the better pick" card,
    // which reads as either a bug or a refusal to acknowledge the
    // competitor's strengths.
    for (const alt of ALTERNATIVES) {
      expect(alt.usBest.length, `usBest for ${alt.slug}`).toBeGreaterThan(0);
      expect(alt.themBest.length, `themBest for ${alt.slug}`).toBeGreaterThan(0);
      for (const point of alt.usBest) expect(point.length).toBeGreaterThan(0);
      for (const point of alt.themBest) expect(point.length).toBeGreaterThan(0);
    }
  });

  it('ALTERNATIVE_SLUGS matches ALTERNATIVES.map(a => a.slug)', () => {
    // The dynamic-route generateStaticParams imports ALTERNATIVE_SLUGS
    // and the sitemap iterates the same constant. The two staying in
    // lockstep with the underlying catalogue is non-negotiable; this
    // pins the contract so a future hand-edit of one without the
    // other is caught here.
    expect(ALTERNATIVE_SLUGS).toEqual(ALTERNATIVES.map((a) => a.slug));
  });
});

describe('getAlternative', () => {
  it('returns the matching entry for a known slug', () => {
    const first = ALTERNATIVES[0]!;
    const found = getAlternative(first.slug);
    expect(found).toBe(first);
  });

  it('returns undefined for an unknown slug (not throw, not the first entry)', () => {
    // The page calls getAlternative(slug) at render time and
    // routes notFound() when undefined. A regression that returned
    // ALTERNATIVES[0] as a default would show a Miro page under
    // /alternatives/some-typo, which Google would index as a
    // duplicate of the real /alternatives/miro.
    expect(getAlternative('this-competitor-does-not-exist')).toBeUndefined();
    expect(getAlternative('')).toBeUndefined();
  });

  it('is case-sensitive (matches the URL-safe lowercase slug)', () => {
    // generateStaticParams emits the exact lowercase slug; a
    // case-insensitive lookup would let /alternatives/MIRO render
    // the Miro page as a non-canonical URL.
    const first = ALTERNATIVES[0]!;
    expect(getAlternative(first.slug.toUpperCase())).toBeUndefined();
  });
});
