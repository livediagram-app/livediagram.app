import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExplorerLink } from '../ExplorerLink';
import { createSiteHeader } from './SiteHeader';
import { START_BLANK_HREF, StartBlankLink } from './StartBlankLink';

// A product's binding, as its SiteHeader.tsx makes one: the shared Start Blank and Explorer link, a stand-in logo
// and switcher (the one menu in the bar), and its funnel's `via` on the wizard link. A visitor's static HTML,
// or (`signedIn`) the bar once the hint cookie says someone is signed in.
const via = (href: string, source: string) =>
  `${href}${href.includes('?') ? '&' : '?'}via=${source}`;
const EXPLORER_HOME = '/explorer/home';

const makeSiteHeader = (signedIn: boolean) =>
  createSiteHeader<'Home' | 'Ai', 'product.example'>({
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
    ExplorerLink: (props) => <ExplorerLink href={EXPLORER_HOME} signedIn={signedIn} {...props} />,
    StartBlankLink: ({ ctaSurface }) => (
      <StartBlankLink
        href={ctaSurface ? via(START_BLANK_HREF, `${ctaSurface}.HeaderBlank`) : START_BLANK_HREF}
      />
    ),
    ShareRail: () => null,
    SiteAccount: () => <button type="button" aria-label="Guest, account menu" />,
  });
const SiteHeader = makeSiteHeader(false);

// The bar's right-hand links: everything after the logo (the switcher's stand-in has none).
const rightLinks = (html: string) =>
  [...html.slice(html.indexOf('</a>') + 4).matchAll(/<a [^>]*>.*?<\/a>/g)].map((m) => m[0]);
const nameOf = (a: string) => a.match(/aria-label="([^"]*)"/)?.[1] ?? a.replace(/<[^>]*>/g, '');

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
    // The bar's one way into the editor, so it shows at every width, a phone's included.
    expect(link?.[0]).not.toContain('hidden');
    expect([...html.matchAll(/href="(\/new[^"]*)"/g)].map((m) => m[1])).toEqual([
      '/new?start=blank&amp;via=Home.HeaderBlank',
    ]);
  });

  it('has no Choose Template (Work Tracker 1317): the Explorer link, then Start Blank last', () => {
    expect(html).not.toContain('Choose Template');
    expect(html).not.toContain('via=Home.Header"');
    const links = rightLinks(html);
    expect(links.map(nameOf)).toEqual(['Explorer', 'Start Blank']);
    // A visitor's Explorer link is the quiet one, the folder alone below sm.
    expect(links[0]).toContain('!text-slate-600');
    expect(links[0]).toContain('max-sm:px-3');
    expect(links[0]).toContain('<span class="text-optical-line max-sm:hidden">Explorer</span>'); // The mark alone below 375px, so Explorer and Start Blank fit a 360px phone beside the longest wordmark.
    expect(html).toContain('max-[374px]:hidden');
  });

  it("is the filled Open Explorer, in the Explorer link's place, for someone signed in", () => {
    const signedIn = renderToStaticMarkup(
      createElement(makeSiteHeader(true), { ctaSurface: 'Home', shareRail: false }),
    );
    const links = rightLinks(signedIn);
    expect(links.map(nameOf)).toEqual(['Open Explorer', 'Start Blank']);
    expect(links[0]).toContain(`href="${EXPLORER_HOME}"`);
    expect(links[0]).toContain('max-sm:px-3');
    expect(links[0]).toContain(
      '<span class="text-optical-line max-sm:hidden">Open Explorer</span>',
    );
    expect(links[0]).not.toContain('!text-slate-600');
    expect(signedIn).not.toContain('Choose Template');
  });

  it("keeps Start Blank beside a centre slot (help's search) in a wide bar", () => {
    const help = renderToStaticMarkup(
      <SiteHeader
        ctaSurface="Home"
        center={<input aria-label="Search" />}
        shareRail={false}
        wide
      />,
    );
    expect(help).toContain('max-w-7xl md:px-8');
    expect(help).toContain('aria-label="Search"');
    expect(rightLinks(help).map(nameOf)).toEqual(['Explorer', 'Start Blank']);
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

  it('is the logo, then Build with AI and Explorer, in that order, with no Choose Template', () => {
    expect(html.indexOf('href="/"')).toBeLessThan(html.indexOf('href="/ai"'));
    expect(hrefs).toEqual(['/ai', '/explorer/home']);
    expect(html).not.toContain('Choose Template');
    expect(html).not.toContain('href="/new');
  });

  it('has no Start Blank and no Open Explorer swap, signed in or not', () => {
    expect(html).not.toContain('Start Blank');
    expect(html).not.toContain('Open Explorer');
    const signedIn = renderToStaticMarkup(
      createElement(makeSiteHeader(true), {
        ctaSurface: 'Home',
        buildWithAi: 'link',
        shareRail: false,
      }),
    );
    expect(signedIn).not.toContain('Open Explorer');
    expect(signedIn).toContain('aria-label="Explorer"');
  });

  it('shortens as it narrows: Build with AI is a glyph below lg and leaves a phone, the mark alone below 480px', () => {
    const tag = (href: string) =>
      html.match(new RegExp(`<a [^>]*href="${href}"[^>]*>.*?</a>`))?.[0] ?? '';
    // Build with AI sits in a wrapper hidden below sm; Explorer is outside it.
    const quiet = html.match(/<span class="contents max-sm:hidden">(.*?)<\/span><a /)?.[1] ?? '';
    const ai = tag('/ai');
    expect(quiet).toBe(ai);
    expect(ai.match(/<a [^>]*>/)?.[0]).not.toContain('hidden');
    expect(ai).toContain('aria-label="Build with AI"');
    expect(ai).toContain('<span class="text-optical-line max-lg:hidden">Build with AI</span>');
    // Explorer is the bar's one filled button, its name shown at every width.
    const explorer = tag('/explorer/home');
    expect(quiet).not.toContain(explorer);
    expect(explorer).toContain('aria-label="Explorer"');
    expect(explorer).toMatch(/<span class="text-optical-line ?">Explorer<\/span>/);
    expect(explorer.match(/<a [^>]*>/)?.[0]).not.toContain('ghost');
    expect(html).toContain('max-[479px]:hidden');
    expect(html).not.toContain('max-[359px]:hidden');
  });

  it('marks Build with AI current on /ai itself', () => {
    const ai = renderToStaticMarkup(
      <SiteHeader ctaSurface="Ai" buildWithAi="current" shareRail={false} />,
    );
    expect(ai).toMatch(/<a [^>]*href="\/ai"[^>]*aria-current="page"/);
    expect(ai).not.toContain('href="/new');
    expect(html.match(/<a [^>]*href="\/ai"[^>]*>/)?.[0]).not.toContain('aria-current');
  });

  it('is Explorer alone for a product with no Build with AI page', () => {
    const bar = renderToStaticMarkup(
      <SiteHeader ctaSurface="Home" marketing account shareRail={false} />,
    );
    expect(bar).not.toContain('Build with AI');
    expect(bar).not.toContain('href="/ai"');
    expect(bar).not.toContain('Start Blank');
    expect(bar).not.toContain('Choose Template');
    expect(bar).not.toContain('contents max-sm:hidden');
    expect(rightLinks(bar).map((a) => a.match(/href="([^"]*)"/)?.[1])).toEqual([EXPLORER_HOME]);
    expect(bar).toContain('aria-label="Guest, account menu"');
    expect(bar).toContain('max-[479px]:hidden');
  });
});
