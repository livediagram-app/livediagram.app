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
    expect(html).toContain('href="/new?template=blank-plan&amp;via=Home.HeaderPlan"');
    expect(html).toContain('href="/new?template=blank-session&amp;via=Home.HeaderSession"');
    expect(rows).toEqual([
      'Blank Diagram',
      'Blank Whiteboard',
      'Blank Session',
      'Blank Illustration',
      'Blank Plan',
    ]);
  });

  it('keeps Choose Template the primary beside it', () => {
    const primary = html.match(/<a [^>]*href="\/new\?via=Home\.Header"[^>]*>(.*?)<\/a>/);
    expect(primary?.[0]).toContain('aria-label="Choose Template"');
    // The static HTML is for a visitor: Choose Template shows, and Open Explorer only holds its width
    // (invisible, aria-hidden) for a signed-in swap after hydration.
    expect(primary?.[1]).toMatch(
      /<span class="text-optical-line \[grid-area:1\/1\] ">.*Choose .*Template<\/span>/,
    );
    expect(primary?.[1]).toMatch(
      /<span aria-hidden="true" class="text-optical-line \[grid-area:1\/1\] invisible">/,
    );
  });

  it('drops "Choose" only below 380px, so the bar fits a 360px and a 320px phone', () => {
    expect(html).toMatch(/<span class="max-\[379px\]:hidden">Choose <\/span>Template/);
  });

  it('no longer says Just Draw anywhere', () => {
    expect(html).not.toMatch(/just draw/i);
  });
});

// docs/specs/019-marketing/build-with-ai.md "Entry points".
describe('SiteHeader: Build with AI', () => {
  it('shows no Build with AI link unless the surface asks for it', () => {
    const plain = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);
    expect(plain).not.toContain('Build with AI');
  });

  it('puts the link to /ai left of Start Blank, desktop only', () => {
    const html = renderToStaticMarkup(
      <SiteHeader ctaSurface="Home" buildWithAi="link" shareRail={false} />,
    );
    const link = html.match(/<a [^>]*href="\/ai"[^>]*>/)?.[0];
    expect(link).toContain('max-lg:hidden');
    expect(link).not.toContain('aria-current');
    expect(html.indexOf('href="/ai"')).toBeLessThan(html.indexOf('Start Blank'));
  });

  it('marks it current on /ai itself', () => {
    const html = renderToStaticMarkup(
      <SiteHeader ctaSurface="Ai" buildWithAi="current" shareRail={false} />,
    );
    expect(html).toMatch(/<a [^>]*href="\/ai"[^>]*aria-current="page"/);
    expect(html).toContain('href="/new?via=Ai.Header"');
  });
});
