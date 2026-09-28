import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter';

const html = renderToStaticMarkup(<SiteFooter />);
const footerNav = html.slice(html.indexOf('aria-label="Footer"'), html.indexOf('</nav>'));

describe('SiteFooter', () => {
  it('links the third-party licences page among the legal links', () => {
    expect(footerNav).toMatch(
      /href="\/help\/policies\/privacy-policy\/"[^>]*>Privacy<\/a><a href="\/licences"[^>]*>Licences<\/a>/,
    );
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
