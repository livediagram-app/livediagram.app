import { describe, expect, it } from 'vitest';
import { communityPostFixture } from '@livepages/api-schema/testing';
import {
  escapeHtml,
  jsonLdScript,
  META_DESCRIPTION_MAX,
  metaDescription,
  postHead,
  sitemapXml,
} from './post-head';

describe('metaDescription', () => {
  it('keeps a description that fits', () => {
    expect(metaDescription({ title: 'T', description: '  How it  works. ' })).toBe('How it works.');
  });

  it('cuts a long one at a whole word, within a search result', () => {
    const long = `${'word '.repeat(60)}end`;
    const cut = metaDescription({ title: 'T', description: long });
    expect(cut.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(cut).toMatch(/word…$/);
  });

  it('falls back to a sentence naming the post when there is none', () => {
    expect(metaDescription({ title: 'Roadmap', description: '' })).toBe(
      'Roadmap, shared to the livepages Community. Open it, explore it, and make your own copy.',
    );
  });
});

describe('postHead', () => {
  it('names the post, its canonical address and its structured data', () => {
    const head = postHead(
      communityPostFixture({
        id: 'p 1',
        tags: ['aws', 'payments'],
        publishedAt: Date.UTC(2026, 0, 2),
        updatedAt: Date.UTC(2026, 1, 3),
      }),
    );
    expect(head.title).toBe('Payments Platform | livepages Community');
    expect(head.canonical).toBe('https://livepages.app/community/post/?id=p%201');
    const [work, crumbs] = (head.jsonLd as { '@graph': Record<string, unknown>[] })['@graph'];
    expect(work).toMatchObject({
      '@type': 'CreativeWork',
      url: head.canonical,
      name: 'Payments Platform',
      genre: 'Architecture',
      keywords: 'aws, payments',
      datePublished: '2026-01-02T00:00:00.000Z',
      dateModified: '2026-02-03T00:00:00.000Z',
      author: { '@type': 'Person', name: 'Ada' },
    });
    expect(crumbs).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Community', item: 'https://livepages.app/community/' },
        { position: 2, name: 'Payments Platform', item: head.canonical },
      ],
    });
  });

  it('names no author on an anonymous post, and no keywords without tags', () => {
    const work = (
      postHead(communityPostFixture({ anonymous: true })).jsonLd as { '@graph': object[] }
    )['@graph'][0];
    expect(work).not.toHaveProperty('author');
    expect(work).not.toHaveProperty('keywords');
  });
});

describe('markup helpers', () => {
  it('escapes attribute values', () => {
    expect(escapeHtml('a "b" <c> & d')).toBe('a &quot;b&quot; &lt;c&gt; &amp; d');
  });

  it('never lets JSON-LD close its script tag', () => {
    const script = jsonLdScript({ name: '</script><script>alert(1)</script>' });
    expect(script.match(/<\/script>/g)).toHaveLength(1);
    expect(script).toContain('\\u003c/script>');
  });
});

describe('sitemapXml', () => {
  it('lists each post at its canonical address with when it last changed', () => {
    const xml = sitemapXml([{ id: 'a&b', updatedAt: Date.UTC(2026, 9, 1) }]);
    expect(xml).toContain(
      '<url><loc>https://livepages.app/community/post/?id=a%26b</loc><lastmod>2026-10-01T00:00:00.000Z</lastmod></url>',
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('is a valid empty urlset with no posts', () => {
    expect(sitemapXml([])).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    );
  });
});
