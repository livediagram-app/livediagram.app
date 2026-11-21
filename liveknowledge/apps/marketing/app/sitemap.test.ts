import { describe, expect, it } from 'vitest';

import { LANDING_SECTION_IDS } from '@/lib/landing-content';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.liveknowledge.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});

describe('sitemap: Build with AI', () => {
  it('lists /ai (docs/specs/019-marketing/build-with-ai.md "Metadata")', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.liveknowledge.app/ai');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.8 });
  });
});

describe('sitemap: Community', () => {
  it('lists the gallery, without a trailing slash (docs/specs/025-community/community.md)', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.liveknowledge.app/community');
    expect(entry).toMatchObject({ changeFrequency: 'daily', priority: 0.7 });
  });
});

describe('sitemap: feature pages', () => {
  it('lists one page per landing section (docs/specs/019-marketing/marketing-site.md "Feature pages")', () => {
    const urls = sitemap().map((e) => e.url);
    for (const id of LANDING_SECTION_IDS) {
      expect(urls).toContain(`https://www.liveknowledge.app/features/${id}`);
    }
    const entry = sitemap().find((e) => e.url === 'https://www.liveknowledge.app/features/trust');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.7 });
  });
});
