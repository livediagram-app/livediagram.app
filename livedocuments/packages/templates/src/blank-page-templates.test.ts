import { describe, expect, it } from 'vitest';
import { pagesOf, offersPageKindChoice } from '@livedocuments/document';
import { BLANK_PAGE_TEMPLATE_KINDS, blankPageTemplateOverrides } from './blank-page-templates';
import { buildTemplate } from './build-template';
import { templateCategory } from './template-categories';
import { isBlankTemplate, templateEditorMode } from './template-modes';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { untitledNameForTemplate } from './templates';

// docs/specs/007-editor/start-diagramming.md "Recommended and groups".
const KINDS = Object.keys(BLANK_PAGE_TEMPLATE_KINDS) as (keyof typeof BLANK_PAGE_TEMPLATE_KINDS)[];

describe('blanks of a page kind', () => {
  it.each(KINDS)('%s opens in Pages on exactly one empty page of its kind', (kind) => {
    const o = templateCanvasOverrides(kind);
    expect(o.opensIn).toBe('pages');
    expect(templateEditorMode(kind)).toBe('pages');
    expect(buildTemplate(kind, 0, 0)).toEqual([]);
    const pages = pagesOf(o);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.kind).toBe(BLANK_PAGE_TEMPLATE_KINDS[kind]);
    // Its kind is chosen, so it never asks What Is This Page For?.
    expect(offersPageKindChoice(pages, pages[0]!.id, 0)).toBe(false);
  });

  it('makes each page the way the kind choice makes it', () => {
    expect(blankPageTemplateOverrides('blank-slide-deck')!.pages).toEqual([
      { id: 'page-1', orientation: 'landscape', size: 'slide', kind: 'slide' },
    ]);
    expect(blankPageTemplateOverrides('blank-infographic')!.pages).toEqual([
      { id: 'page-1', orientation: 'portrait', kind: 'infographic' },
    ]);
    const article = blankPageTemplateOverrides('blank-article')!;
    expect(article.pages).toEqual([
      { id: 'page-1', orientation: 'portrait', kind: 'article', flow: 'art-1' },
    ]);
    // Its writing: an empty Title and an empty paragraph.
    expect(article.articles?.['art-1']?.blocks).toEqual([
      expect.objectContaining({ type: 'paragraph', style: 'title', runs: [] }),
      expect.objectContaining({ type: 'paragraph', runs: [] }),
    ]);
  });

  it('carries no writing but the article', () => {
    for (const kind of KINDS.filter((k) => k !== 'blank-article'))
      expect(blankPageTemplateOverrides(kind)!.articles).toBeUndefined();
  });

  it('are blanks: in no category, keeping the tab name rules of a blank', () => {
    for (const kind of KINDS) {
      expect(isBlankTemplate(kind)).toBe(true);
      expect(templateCategory(kind)).toBeNull();
    }
    expect(untitledNameForTemplate('blank-slide-deck')).toBe('Untitled Slide Deck');
    expect(untitledNameForTemplate('blank-infographic')).toBe('Untitled Infographic');
  });

  it('answers nothing for any other template', () => {
    expect(blankPageTemplateOverrides('blank-illustration')).toBeUndefined();
    expect(blankPageTemplateOverrides('slide-deck')).toBeUndefined();
    expect(templateCanvasOverrides('blank-illustration').pages).toBeUndefined();
  });
});

describe('a blank infographic on its theme', () => {
  it("starts its page on the theme's default background, a blank deck's on Steel; other templates keep theirs", async () => {
    const { buildTemplateTab } = await import('./template-tab');
    const { defaultPageBackground, getBuiltInTheme, pagesOf } =
      await import('@livedocuments/document');
    const tab = buildTemplateTab('t', 'T', 'blank-infographic', 'ocean');
    expect(pagesOf(tab)[0]!.background).toEqual(defaultPageBackground(getBuiltInTheme('ocean')));
    const slides = buildTemplateTab('s', 'S', 'blank-slide-deck', 'ocean');
    expect(pagesOf(slides)[0]!.background).toEqual(
      defaultPageBackground(getBuiltInTheme('ocean'), 'slide'),
    );
    const deck = buildTemplateTab('d', 'D', 'slide-deck', 'ocean');
    expect(pagesOf(deck)[0]!.background).not.toEqual(
      defaultPageBackground(getBuiltInTheme('ocean'), 'slide'),
    );
  });
});
