import { describe, expect, it } from 'vitest';

import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the licences page as a low-priority transparency page', () => {
    const entry = sitemap().find((e) => e.url === 'https://www.livehuddle.app/licences');
    expect(entry).toMatchObject({ changeFrequency: 'monthly', priority: 0.2 });
  });
});

describe('sitemap: no Build with AI', () => {
  it('leaves /ai out, since livehuddle has no MCP server (docs/specs/002-project-scope/not-in-livehuddle.md)', () => {
    expect(sitemap().some((e) => e.url.endsWith('/ai'))).toBe(false);
  });
});
