import { describe, expect, it } from 'vitest';
import { resolveArticleStyle } from './article-style';

// docs/specs/007-editor/article-pages.md "Article style": a look named alone (an agent's write) sets every field it
// has; a field the article sets itself wins.
describe('an article’s look', () => {
  it('is the base its fields resolve over', () => {
    expect(resolveArticleStyle({ look: 'report' })).toMatchObject({
      headingFont: 'poppins',
      accentHeadings: true,
      rules: 'headings',
    });
    expect(resolveArticleStyle({ look: 'bold', textSize: 'small' }).textSize).toBe('small');
    expect(resolveArticleStyle(undefined).headingFont).toBe('inter');
  });
});
