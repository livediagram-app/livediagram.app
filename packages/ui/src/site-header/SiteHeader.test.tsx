import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExplorerLink } from '../ExplorerLink';
import { HeaderPrimaryCta } from './HeaderPrimaryCta';
import { createSiteHeader } from './SiteHeader';
import { START_BLANK_HREF, StartBlankLink } from './StartBlankLink';

// A product's binding, as its SiteHeader.tsx makes one: the shared CTA links and Explorer link, a stand-in logo
// and switcher (the one menu in the bar), and its funnel's `via` on the wizard links. A visitor's static HTML.
const via = (href: string, source: string) =>
  `${href}${href.includes('?') ? '&' : '?'}via=${source}`;
const EXPLORER_HOME = '/explorer/home';

const SiteHeader = createSiteHeader<'Home' | 'Ai', 'product.example'>({
  siteId: 'product.example',
  SiteSwitcher: ({ children }) => (
    <div>
      <button type="button" aria-haspopup="menu" aria-label="Switch site" />
      {children}
    </div>
  ),
  Brand: ({ href, className, wordmarkClassName }) => (
    <a href={href} className={className}>
      <span className={wordmarkClassName}>product</span>
    </a>
  ),
  ExplorerLink: (props) => <ExplorerLink href={EXPLORER_HOME} signedIn={false} {...props} />,
  HeaderPrimaryCta: ({ ctaSurface, ...props }) => (
    <HeaderPrimaryCta
      newHref={ctaSurface ? via('/new', `${ctaSurface}.Header`) : '/new'}
      explorerHref={EXPLORER_HOME}
      signedIn={false}
      {...props}
    />
  ),
  StartBlankLink: ({ ctaSurface, className }) => (
    <StartBlankLink
      href={ctaSurface ? via(START_BLANK_HREF, `${ctaSurface}.HeaderBlank`) : START_BLANK_HREF}
      className={className}
    />
  ),
  ShareRail: () => null,
  SiteAccount: () => <button type="button" aria-label="Guest, account menu" />,
});

// docs/specs/019-marketing/marketing-site.md "Header".
describe('SiteHeader', () => {
  const html = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);

  it('makes Start Blank a plain link to the wizard, not a menu of blanks', () => {
    // The one menu in the bar is the logo's site switcher.
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Switch site"');
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

  it('drops "Choose" only below 430px, so the bar fits every phone up to a 430px one', () => {
    expect(html).toMatch(/<span class="max-\[429px\]:hidden">Choose <\/span>Template/);
  });

  it('no longer says Just Draw anywhere', () => {
    expect(html).not.toMatch(/just draw/i);
  });
});

// docs/specs/019-marketing/marketing-site.md "Header" and build-with-ai.md "Entry points": a marketing page's bar.
describe('SiteHeader: the marketing bar', () => {
  const html = renderToStaticMarkup(
    <SiteHeader ctaSurface="Home" buildWithAi="link" account shareRail={false} />,
  );
  // The bar's right-hand links: everything from Build with AI on (the logo's site switcher links come before).
  const right = html.slice(html.lastIndexOf('<a ', html.indexOf('href="/ai"')));
  const hrefs = [...right.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);

  it('shows no Build with AI link unless the surface asks for it', () => {
    const plain = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);
    expect(plain).not.toContain('Build with AI');
  });

  it('is the logo, then Build with AI, Choose Template and Explorer, in that order', () => {
    expect(html.indexOf('href="/"')).toBeLessThan(html.indexOf('href="/ai"'));
    expect(hrefs).toEqual(['/ai', '/new?via=Home.Header', '/explorer/home']);
  });

  it('has no Start Blank and no Open Explorer swap', () => {
    expect(html).not.toContain('Start Blank');
    expect(html).not.toContain('Open Explorer');
  });

  it('keeps every link on a phone, shorter: the quiet links are glyphs below lg, the mark alone below 480px', () => {
    const tag = (href: string) =>
      html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>.*?</a>`))?.[0] ?? '';
    for (const [href, name] of [
      ['/ai', 'Build with AI'],
      ['/new\\?via=Home\\.Header', 'Choose Template'],
    ] as const) {
      const link = tag(href);
      expect(link.match(/<a [^>]*>/)?.[0]).not.toContain('hidden');
      expect(link).toContain(`aria-label="${name}"`);
      expect(link).toContain(`<span class="text-optical-line max-lg:hidden">${name}</span>`);
    }
    // Explorer is the bar's one filled button, its name shown at every width.
    const explorer = tag('/explorer/home');
    expect(explorer).toContain('aria-label="Explorer"');
    expect(explorer).toContain('<span class="text-optical-line">Explorer</span>');
    expect(explorer.match(/<a [^>]*>/)?.[0]).not.toContain('ghost');
    expect(html).toContain('max-[479px]:hidden');
    expect(html).not.toContain('max-[359px]:hidden');
  });

  it('marks Build with AI current on /ai itself', () => {
    const ai = renderToStaticMarkup(
      <SiteHeader ctaSurface="Ai" buildWithAi="current" shareRail={false} />,
    );
    expect(ai).toMatch(/<a [^>]*href="\/ai"[^>]*aria-current="page"/);
    expect(ai).toContain('href="/new?via=Ai.Header"');
    expect(html.match(/<a [^>]*href="\/ai"[^>]*>/)?.[0]).not.toContain('aria-current');
  });
});
