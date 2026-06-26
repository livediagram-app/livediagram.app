import { describe, expect, it } from 'vitest';
import { subpageMetadata } from './subpage-metadata';

// subpageMetadata is the single factory every marketing subpage
// (FAQ, Terms, Privacy, /alternatives, /alternatives/<slug>) uses
// for its Next `metadata` block, so a regression here ripples
// across the whole non-landing surface. The tests below pin the
// shape Google + Twitter + sister-page canonical-checks all
// depend on: a value drift in `openGraph.type` from 'article' to
// 'website', or in `locale` from 'en_GB' to 'en-GB' (BCP 47 form
// rather than the OG-required underscore form), would break
// social cards on every subpage at once.

describe('subpageMetadata', () => {
  it('passes title + description through to the top-level fields', () => {
    const md = subpageMetadata({
      title: 'FAQ | livediagram',
      description: 'Questions and answers',
      path: '/faq',
    });
    expect(md.title).toBe('FAQ | livediagram');
    expect(md.description).toBe('Questions and answers');
  });

  it('uses the supplied path as the canonical', () => {
    // The metadataBase in app/layout.tsx resolves the relative
    // path against the production origin, so `/faq` becomes
    // `https://livediagram.app/faq` in the emitted <link>. The
    // factory's job is to surface the supplied path verbatim.
    const md = subpageMetadata({ title: 't', description: 'd', path: '/terms' });
    expect(md.alternates).toEqual({ canonical: '/terms' });
  });

  it('emits an `article`-type openGraph block with the marketing siteName + en_GB locale', () => {
    const md = subpageMetadata({
      title: 'Terms | livediagram',
      description: 'Legal terms',
      path: '/terms',
    });
    // OG locale uses the underscore form (en_GB), not BCP 47's
    // hyphen form (en-GB). They look interchangeable but they
    // mean different things to different parsers, and the
    // OG spec is strict on the underscore one.
    expect(md.openGraph).toMatchObject({
      type: 'article',
      url: '/terms',
      siteName: 'livediagram',
      title: 'Terms | livediagram',
      description: 'Legal terms',
      locale: 'en_GB',
    });
  });

  it('emits a `summary_large_image` twitter card with title + description mirrors', () => {
    const md = subpageMetadata({
      title: 'Alternatives | livediagram',
      description: 'How livediagram compares',
      path: '/alternatives',
    });
    expect(md.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Alternatives | livediagram',
      description: 'How livediagram compares',
    });
  });

  it('sets the OG + Twitter card image explicitly (the file-convention fallback is suppressed once openGraph is declared)', () => {
    // Next.js auto-promotes app/opengraph-image.tsx to og:image ONLY for
    // routes that don't declare their own openGraph. Every subpage here
    // sets an explicit openGraph object, which suppresses that fallback, so
    // without an explicit image the card goes missing (verified against the
    // built HTML). Pin that the factory references the generated assets so
    // subpage links keep their social / SERP card.
    const md = subpageMetadata({ title: 't', description: 'd', path: '/privacy' });
    const og = md.openGraph as Record<string, unknown> | undefined;
    expect(og?.images).toEqual([
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'livediagram: a real-time multiplayer canvas for diagrams and mindmaps',
      },
    ]);
    const tw = md.twitter as Record<string, unknown> | undefined;
    expect(tw?.images).toEqual(['/twitter-image']);
  });

  it('returns a fresh object on each call (call sites compose into Next metadata at module load)', () => {
    // Each page's `export const metadata` evaluates the factory
    // once at build time; a shared mutable reference would mean a
    // future revision that mutated the result (e.g. adding a
    // per-page image) leaked across pages. Asserting distinct
    // references rules out an accidental return-the-singleton
    // refactor.
    const a = subpageMetadata({ title: 'a', description: 'd', path: '/faq' });
    const b = subpageMetadata({ title: 'b', description: 'd', path: '/terms' });
    expect(a).not.toBe(b);
    expect(a.openGraph).not.toBe(b.openGraph);
  });

  it('omits openGraph.modifiedTime when no modifiedTime is supplied', () => {
    // FAQ + Terms + Privacy don't pass a date today. The factory
    // must NOT emit an empty / "Invalid Date" string into the
    // article:modified_time meta tag for them, which would surface
    // a parse warning in Google Search Console.
    const md = subpageMetadata({ title: 't', description: 'd', path: '/faq' });
    const og = md.openGraph as Record<string, unknown> | undefined;
    expect(og?.modifiedTime).toBeUndefined();
  });

  it('serialises modifiedTime to an ISO 8601 string for article:modified_time', () => {
    // Next.js's metadata API takes a string (or Date) here and
    // emits it as the `article:modified_time` OG meta. ISO 8601
    // is what Google + Open Graph parsers expect; assertions here
    // pin (a) the exact format, and (b) that the factory does the
    // toISOString() conversion itself (so callers can pass a
    // friendly Date and not worry about the wire format). See
    // spec/21 "Metadata".
    const date = new Date('2026-06-02T00:00:00.000Z');
    const md = subpageMetadata({
      title: 't',
      description: 'd',
      path: '/alternatives/miro',
      modifiedTime: date,
    });
    const og = md.openGraph as Record<string, unknown> | undefined;
    expect(og?.modifiedTime).toBe('2026-06-02T00:00:00.000Z');
  });
});
