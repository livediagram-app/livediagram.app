import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

// docs/specs/007-editor/new-document-route.md "Start Blank"; docs/specs/019-marketing/marketing-site.md "Header".
describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);

  it('offers Start Blank straight to a blank canvas, counted as the header draw slot', () => {
    expect(html).toMatch(
      /<a href="\/new\?blank=1&amp;via=Home\.HeaderDraw"[^>]*><span[^>]*>Start Blank<\/span><\/a>/,
    );
  });

  it('keeps Choose Template the primary beside it', () => {
    expect(html).toMatch(/href="\/new\?via=Home\.Header"[^>]*><span[^>]*>Choose Template</);
  });

  it('no longer says Just Draw anywhere', () => {
    expect(html).not.toMatch(/just draw/i);
  });
});
