import { describe, expect, it } from 'vitest';
import { articlesOf, type ArticleFlow } from '@liveworkspace/article/article-flow';
import {
  ARTICLE_HEADER_BAND_PX,
  ARTICLE_TOP_MIN_PX,
  articleHeaderBandPx,
  articleTopMarginPx,
  withArticleStyleChanged,
} from './article-style';

// docs/specs/007-editor/article-pages.md "Headers and footers": the room a header takes (the band's own reading is
// tested in @liveworkspace/article).
describe('the header’s room', () => {
  it('raises the top margin by the band when there is a header', () => {
    expect(articleHeaderBandPx(undefined)).toBe(0);
    expect(articleHeaderBandPx({ header: { left: 'a' } })).toBe(ARTICLE_HEADER_BAND_PX);
    expect(articleTopMarginPx({ margins: 'narrow' })).toBe(ARTICLE_TOP_MIN_PX);
    expect(articleTopMarginPx({ margins: 'narrow', header: { left: 'a' } })).toBe(
      ARTICLE_TOP_MIN_PX + ARTICLE_HEADER_BAND_PX,
    );
    expect(articleTopMarginPx({ margins: 'wide', header: { left: 'a' } })).toBe(144);
  });

  it('is kept by a look, and a band set to what it is changes nothing', () => {
    const flow: ArticleFlow = {
      blocks: [{ id: 'b', type: 'paragraph', runs: [] }],
      style: { header: { left: 'H' }, footer: { right: 'F' }, differentFirstPage: true },
    };
    const tab = { elements: [], articles: { f: flow } };
    const looked = withArticleStyleChanged(tab, 'f', { look: 'report' });
    expect(articlesOf(looked).f!.style).toMatchObject({
      look: 'report',
      header: { left: 'H' },
      footer: { right: 'F' },
      differentFirstPage: true,
    });
    expect(withArticleStyleChanged(tab, 'f', { patch: { header: { left: 'H' } } })).toBe(tab);
    const plain = { elements: [], articles: { f: { blocks: flow.blocks } } };
    const style = articlesOf(withArticleStyleChanged(plain, 'f', { look: 'report' })).f!.style!;
    expect(Object.keys(style)).not.toEqual(expect.arrayContaining(['header']));
    expect('footer' in style || 'differentFirstPage' in style).toBe(false);
  });
});
