// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/AppPageHeader', () => ({ AppPageHeader: () => null }));
vi.mock('@/components/SiteRail', () => ({ SiteRail: () => null }));

import { PLATFORM_SITE } from '@liveworkspace/sites';
import { CommunityFrame } from './CommunityFrame';

// The Community page is one static file for every address (site.md "The Community"): its served footer must link only
// pages that answer on a product's host, so no footer href is a bare path such as /compare.
describe('CommunityFrame server HTML', () => {
  it('links every footer page in full on liveworkspace.app, never by a bare path', () => {
    const html = renderToString(<CommunityFrame>page</CommunityFrame>);
    const footer = html.slice(html.indexOf('<footer'));
    const hrefs = [...footer.matchAll(/href="([^"]*)"/g)].map((m) => m[1] ?? '');
    const paths = hrefs.filter((href) => href.startsWith('/'));
    expect(paths).toEqual([]);
    expect(hrefs).toContain(`${PLATFORM_SITE.url}/compare`);
    expect(hrefs).toContain(`${PLATFORM_SITE.url}/licences`);
  });
});
