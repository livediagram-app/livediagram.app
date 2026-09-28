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
