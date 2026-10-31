import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StillNeedHelp } from './ArticlePager';

// docs/specs/018-help/help-pages.md "Article pages": the foot's Still Need Help sits inside the article, in the page's
// main landmark, so it must not be a landmark of its own (axe landmark-complementary-is-top-level).
describe('StillNeedHelp', () => {
  it('is no complementary landmark', () => {
    const html = renderToStaticMarkup(
      <StillNeedHelp contactFormUrl="https://example.com/contact" />,
    );
    expect(html).toContain('Still need help?');
    expect(html).not.toMatch(/<aside|role="complementary"/);
  });
});
