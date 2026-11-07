import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedocuments.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});

describe('sitemap: Build with AI', () => {
  it('lists /ai (docs/specs/019-marketing/build-with-ai.md "Metadata")', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedocuments.app/ai');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.8 });
  });
});

describe('sitemap: Community', () => {
  it('lists the gallery, without a trailing slash (docs/specs/025-community/community.md)', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedocuments.app/community');
    expect(entry).toMatchObject({ changeFrequency: 'daily', priority: 0.7 });
  });
});
