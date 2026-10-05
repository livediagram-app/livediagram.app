import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

// docs/specs/007-editor/new-document-route.md "Start Blank"; docs/specs/019-marketing/marketing-site.md "Header".
describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);

  it('makes Start Blank a menu button, not a link', () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="menu"[^>]*>.*Start Blank/);
    expect(html).not.toMatch(/<a [^>]*>(<span[^>]*>)?Start Blank/);
  });

  it('offers one blank per editor mode, each with its own funnel slot', () => {
    expect(html).toContain('href="/new?blank=1&amp;via=Home.HeaderDraw"');
    expect(html).toContain('href="/new?template=whiteboard&amp;via=Home.HeaderWhiteboard"');
    expect(html).toContain(
      'href="/new?template=blank-illustration&amp;via=Home.HeaderIllustration"',
    );
    const rows = [...html.matchAll(/role="menuitem"[^>]*>.*?font-semibold[^>]*>([^<]+)</g)].map(
      (m) => m[1],
    );
    expect(rows).toEqual(['Blank Diagram', 'Blank Whiteboard', 'Blank Illustration']);
  });

  it('keeps Choose Template the primary beside it', () => {
    expect(html).toMatch(/href="\/new\?via=Home\.Header"[^>]*><span[^>]*>Choose Template</);
  });

  it('no longer says Just Draw anywhere', () => {
    expect(html).not.toMatch(/just draw/i);
  });
});
