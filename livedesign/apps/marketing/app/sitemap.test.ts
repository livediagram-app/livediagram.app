import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://livepages.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});

describe('sitemap: Build with AI', () => {
  it('lists /ai (docs/specs/019-marketing/build-with-ai.md "Metadata")', () => {
    const entry = sitemap().find((e) => e.url === 'https://livepages.app/ai');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.8 });
  });
});
