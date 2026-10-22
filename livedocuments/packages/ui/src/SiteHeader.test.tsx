import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from './SiteHeader';

// docs/specs/019-marketing/marketing-site.md "Header".
describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);

  it('makes Start Blank a plain link to the wizard, not a menu of blanks', () => {
    expect(html).not.toContain('aria-haspopup="menu"');
    const link = html.match(
      /<a [^>]*href="\/new\?start=blank&amp;via=Home\.HeaderBlank"[^>]*>(.*?)<\/a>/,
    );
    expect(link?.[1]).toContain('Start Blank');
    expect(link?.[0]).toContain('max-sm:hidden');
    expect([...html.matchAll(/href="(\/new[^"]*)"/g)].map((m) => m[1])).toEqual([
      '/new?start=blank&amp;via=Home.HeaderBlank',
      '/new?via=Home.Header',
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
