import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedesign.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});

describe('sitemap: Community', () => {
  it('lists the gallery (docs/specs/025-community/community.md "Where Community is linked from")', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedesign.app/community/');
    expect(entry).toMatchObject({ changeFrequency: 'daily', priority: 0.7 });
  });
});

describe('sitemap: Build with AI', () => {
  it('lists /ai (docs/specs/019-marketing/build-with-ai.md "Metadata")', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livedesign.app/ai');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.8 });
  });
});
