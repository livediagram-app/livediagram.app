import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SiteFooter } from './SiteFooter';

const html = renderToStaticMarkup(<SiteFooter />);
const footerNav = html.slice(html.indexOf('aria-label="Footer"'), html.indexOf('</nav>'));

// Every link's label in nav order.
const labels = [...footerNav.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);

describe('SiteFooter', () => {
  it('opens with the large logo, linking home', () => {
    const brand = html.slice(0, html.indexOf('aria-label="Footer"'));
    expect(brand).toMatch(/<a href="\/" aria-label="liveplanner" class="[^"]*gap-3 text-2xl/);
    expect(brand).toContain('size-10');
  });

  it("links liveworkspace's terms and privacy policy, the security policy and third-party licences", () => {
    expect(labels.slice(labels.indexOf('Terms of Use'))).toEqual([
      'Terms of Use',
      'Privacy Policy',
      'Report a Vulnerability',
      'Licences',
      'Contact',
    ]);
    expect(footerNav).toContain('href="https://www.liveworkspace.app/terms"');
    expect(footerNav).toContain('href="https://www.liveworkspace.app/privacy"');
    expect(footerNav).toContain('href="/help/policies/report-a-vulnerability/"');
    expect(footerNav).toContain('href="/licences"');
  });

  it('draws every link as plain text, with no icon', () => {
    expect(footerNav).not.toContain('<svg');
  });

  it("puts the Explorer second under Product, opening this app's Explorer Home", () => {
    expect(labels.slice(0, 3)).toEqual(['New Plan', 'Explorer', 'Build with AI']);
    expect(footerNav).toContain('<a href="/explorer/home" class="');
  });

  it('links the Build with AI page', () => {
    expect(footerNav).toContain('href="/ai"');
    expect(labels).not.toContain('AI &amp; MCP');
  });

  // docs/specs/025-community/community.md "Where Community is linked from": under Product, until an answer says the
  // Community is off (it asks only once the footer nears the viewport).
  it("links this app's Community page under Product", () => {
    expect(labels.slice(0, labels.indexOf('FAQ') + 1)).toContain('Community');
    expect(footerNav).toContain('href="/community"');
  });
});

describe('SiteFooter source link', () => {
  it('links no source repository and makes no third-party image request', () => {
    expect(html).not.toContain('github.com');
    expect(html).not.toContain('<img');
  });
});

describe('SiteFooter legal strip, no credits', () => {
  // Each product's marketing-site.md "Footer": no Built by line; Part of liveworkspace sits on the right.
  it('credits no one and puts Part of liveworkspace after the copyright', () => {
    expect(html).not.toContain('Built by');
    expect(html).not.toContain('https://github.com/tommcclean');
    expect(html).not.toContain('data:image/jpeg;base64,');
    const strip = html.slice(html.indexOf('</nav>'));
    expect(strip.indexOf('MIT licensed.')).toBeLessThan(strip.indexOf('Part of'));
  });
});

describe('SiteFooter columns', () => {
  it('groups the links under titled categories below the brand', () => {
    const titles = [...footerNav.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual(['Product', 'Resources', 'Legal', 'Connect']);
    expect(html.indexOf('Free planning')).toBeLessThan(html.indexOf('aria-label="Footer"'));
  });
});

describe('SiteFooter legal strip', () => {
  it('names the platform the app is part of, with the liveworkspace logo linking to it', () => {
    const strip = html.slice(html.indexOf('</nav>'));
    expect(strip).toMatch(/Part of<a href="[^"]*" aria-label="liveworkspace"/);
    expect(strip).toContain('workspace</span>');
    expect(strip).toContain('<svg');
  });

  // WCAG 1.4.3: slate 400 is 2.6:1 on white; slate 500 is 4.8:1, the nav's own colour.
  it('sets its small print in a colour that meets AA on white', () => {
    const strip = /<div class="([^"]*text-xs[^"]*)">/
      .exec(html.slice(html.indexOf('</nav>')))![1]!
      .split(' ');
    expect(strip).toContain('text-slate-500');
    expect(strip).toContain('dark:text-slate-400');
    expect(strip).not.toContain('text-slate-400');
  });
});

// docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in the browser only": the year is the
// build's, inlined at build (NEXT_PUBLIC_BUILD_YEAR), so the prerender and the browser render the same text.
describe('SiteFooter year', () => {
  const render = () => renderToStaticMarkup(<SiteFooter />);

  it("shows the build's year, whatever the clock says", () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_YEAR', '2026');
    vi.useFakeTimers({ now: new Date('2031-01-01T00:00:00Z') });
    try {
      expect(render()).toContain('© 2026 liveplanner. MIT licensed.');
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('shows no year rather than a wrong one when the build gave none', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_YEAR', '');
    try {
      expect(render()).toContain('© liveplanner. MIT licensed.');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
