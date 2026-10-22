import { describe, expect, it } from 'vitest';
import { pagesOf, offersPageKindChoice } from '@livedesign/document';
import { BLANK_PAGE_TEMPLATE_KINDS, blankPageTemplateOverrides } from './blank-page-templates';
import { buildTemplate } from './build-template';
import { templateCategory } from './template-categories';
import { isBlankTemplate, templateEditorMode } from './template-modes';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { untitledNameForTemplate } from './templates';

// docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind".
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
    expect(blankPageTemplateOverrides('blank-infographic')!.pages).toEqual([
      { id: 'page-1', orientation: 'portrait', kind: 'infographic' },
    ]);
    expect(blankPageTemplateOverrides('blank-logo')!.pages).toEqual([
      { id: 'page-1', orientation: 'portrait', size: 'logo', kind: 'logo' },
    ]);
  });

  it('are blanks: in no category, keeping the tab name rules of a blank', () => {
    for (const kind of KINDS) {
      expect(isBlankTemplate(kind)).toBe(true);
      expect(templateCategory(kind)).toBeNull();
    }
    expect(untitledNameForTemplate('blank-infographic')).toBe('Untitled Infographic');
    expect(untitledNameForTemplate('blank-logo')).toBe('Untitled Logo');
  });

  it('answers nothing for any other template', () => {
    expect(blankPageTemplateOverrides('blank-illustration')).toBeUndefined();
    expect(blankPageTemplateOverrides('logo-design')).toBeUndefined();
    expect(templateCanvasOverrides('blank-illustration').pages).toBeUndefined();
  });
});

describe('a blank infographic on its theme', () => {
  it("starts its page on the theme's default background; other templates keep theirs", async () => {
    const { buildTemplateTab } = await import('./template-tab');
    const { defaultPageBackground, getBuiltInTheme, pagesOf } =
      await import('@livedesign/document');
    const tab = buildTemplateTab('t', 'T', 'blank-infographic', 'ocean');
    expect(pagesOf(tab)[0]!.background).toEqual(defaultPageBackground(getBuiltInTheme('ocean')));
    const poster = buildTemplateTab('d', 'D', 'event-poster', 'ocean');
    expect(pagesOf(poster)[0]!.background).not.toEqual(
      defaultPageBackground(getBuiltInTheme('ocean')),
    );
  });
});
