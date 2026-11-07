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
    expect(brand).toMatch(/<a href="\/" aria-label="livehuddle" class="[^"]*gap-3 text-2xl/);
    expect(brand).toContain('size-10');
  });

  it('links the security policy and third-party licences among the legal links', () => {
    expect(labels.slice(labels.indexOf('Terms of Use'))).toEqual([
      'Terms of Use',
      'Privacy Policy',
      'Report a Vulnerability',
      'Licences',
      'Contact',
      'GitHub',
    ]);
    expect(footerNav).toContain('href="/help/policies/report-a-vulnerability/"');
    expect(footerNav).toContain('href="/licences"');
  });

  it('draws every link as plain text, with no icon', () => {
    expect(footerNav).not.toContain('<svg');
  });

  it("puts the Explorer second under Product, opening this app's Explorer Home", () => {
    expect(labels.slice(0, 2)).toEqual(['New Space', 'Explorer']);
    expect(footerNav).toContain('<a href="/explorer/home" class="');
  });

  it('has no Build with AI link, since livehuddle has no MCP server', () => {
    expect(footerNav).not.toContain('href="/ai"');
    expect(labels).not.toContain('Build with AI');
  });
});

describe('SiteFooter credits', () => {
  it('credits each human contributor by an inlined avatar, never a GitHub-hosted image', () => {
    for (const login of ['tommcclean', 'webbertakken']) {
      expect(html).toContain(`href="https://github.com/${login}"`);
    }
    expect(html.match(/<img src="data:image\/jpeg;base64,/g)).toHaveLength(2);
    expect(html).not.toContain('githubusercontent');
  });
});

describe('SiteFooter columns', () => {
  it('groups the links under titled categories below the brand', () => {
    const titles = [...footerNav.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual(['Product', 'Resources', 'Legal', 'Connect']);
    expect(html.indexOf('Free Spaces')).toBeLessThan(html.indexOf('aria-label="Footer"'));
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
      expect(render()).toContain('© 2026 livehuddle. MIT licensed.');
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it('shows no year rather than a wrong one when the build gave none', () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_YEAR', '');
    try {
      expect(render()).toContain('© livehuddle. MIT licensed.');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
