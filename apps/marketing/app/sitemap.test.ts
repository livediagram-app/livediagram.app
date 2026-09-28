import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://livediagram.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});
