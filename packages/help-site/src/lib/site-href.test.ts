import { describe, expect, it } from 'vitest';
import { siteHref } from './site-href';

// Cross-site links stay in the page's deployment (liveworkspace/docs/specs/017-help/help-centre.md "Choosing an app").
describe('siteHref', () => {
  it("moves every site's live origin to its staging one on a staging host", () => {
    expect(siteHref('https://www.liveplanner.app/help/tabs/', 'staging.livediagram.app')).toBe(
      'https://staging.liveplanner.app/help/tabs/',
    );
    expect(siteHref('https://www.liveworkspace.app/help/?q=x', 'staging.livehuddle.app')).toBe(
      'https://staging.liveworkspace.app/help/?q=x',
    );
  });

  it('leaves links alone on a live host, before hydration and for other addresses', () => {
    expect(siteHref('https://www.liveplanner.app/help/', 'www.livediagram.app')).toBe(
      'https://www.liveplanner.app/help/',
    );
    expect(siteHref('https://www.liveplanner.app/help/', '')).toBe(
      'https://www.liveplanner.app/help/',
    );
    expect(siteHref('/help/canvas/', 'staging.livediagram.app')).toBe('/help/canvas/');
    expect(siteHref('https://example.com/', 'staging.livediagram.app')).toBe(
      'https://example.com/',
    );
  });
});
