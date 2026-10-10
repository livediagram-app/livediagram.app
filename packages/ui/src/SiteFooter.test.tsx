import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

const html = renderToStaticMarkup(<SiteFooter />);
const footerNav = html.slice(html.indexOf('aria-label="Footer"'), html.indexOf('</nav>'));

// Every link's label in nav order, ignoring the icon markup inside each anchor.
const labels = [...footerNav.matchAll(/<a [^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)].map(
  (m) => m[1],
);

describe('SiteFooter', () => {
  it('links the security policy and third-party licences among the legal links', () => {
    expect(labels.slice(labels.indexOf('Terms'))).toEqual([
      'Terms',
      'Privacy Policy',
      'Data &amp; Security',
      'Report a Vulnerability',
      'Licences',
      'Contact',
      'GitHub',
    ]);
    expect(footerNav).toContain('href="/help/policies/report-a-vulnerability/"');
    expect(footerNav).toContain('href="/licences"');
  });

  it('gives an icon to the key links only', () => {
    const withIcon = [...footerNav.matchAll(/<a [^>]*><svg[\s\S]*?<\/svg>([^<]+)<\/a>/g)].map(
      (m) => m[1],
    );
    expect(withIcon).toEqual(['New Document', 'AI &amp; MCP', 'Help Centre', 'GitHub']);
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
    expect(html.indexOf('Free diagrams')).toBeLessThan(html.indexOf('aria-label="Footer"'));
  });
});

describe('SiteFooter legal strip', () => {
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
