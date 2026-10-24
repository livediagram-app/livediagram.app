import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DialogCloseButton } from './dialog/DialogCloseButton';
import { SiteSwitcher } from './SiteSwitcher';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

// docs/specs/004-interface-design/touch-targets.md "The public sites": the shared header, footer,
// breadcrumbs and dialog close reach 44px tap areas on a touch screen, and keep their drawn size
// under a mouse (every rule sits behind `pointer: coarse`).

const classOf = (html: string, marker: RegExp): string => {
  const tag = html.match(marker)?.[0] ?? '';
  return tag.match(/class="([^"]*)"/)?.[1] ?? '';
};

describe('touch targets on the public sites', () => {
  it('pads the header brand and primary CTA vertically', () => {
    const html = renderToStaticMarkup(<SiteHeader ctaSurface="Home" shareRail={false} />);
    expect(classOf(html, /<a [^>]*href="\/"[^>]*>/)).toMatch(/\btouch-target-y\b/);
    expect(classOf(html, /<a [^>]*aria-label="Choose Template"[^>]*>/)).toMatch(
      /\btouch-target-y\b/,
    );
  });

  it('pads the site switcher trigger vertically', () => {
    const html = renderToStaticMarkup(
      <SiteSwitcher current="livedocuments.app">
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    expect(classOf(html, /<button [^>]*aria-haspopup[^>]*>/)).toMatch(/\btouch-target-y\b/);
  });

  it('turns every footer link into a 44px row with no gap on a touch screen', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    const links = [...html.matchAll(/<a [^>]*class="([^"]*)"[^>]*>/g)].map((m) => m[1]!);
    const columnLinks = links.filter((c) => c.includes('gap-2'));
    expect(columnLinks.length).toBeGreaterThan(10);
    for (const c of columnLinks) expect(c).toMatch(/\bpointer-coarse:py-3\b/);
    expect(html).toMatch(/class="mt-3 flex flex-col items-start gap-2[^"]*pointer-coarse:gap-0/);
  });
  it('gives both dialog close shapes a 44px tap area', () => {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(<DialogCloseButton onClick={() => {}} compact={compact} />);
      const c = classOf(html, /<button[^>]*>/);
      expect(c).toMatch(/\btouch-target\b/);
      expect(c).toMatch(/\brelative\b/);
    }
  });
});
