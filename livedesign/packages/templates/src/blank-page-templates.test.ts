import { describe, expect, it } from 'vitest';
import { pagesOf, offersPageKindChoice } from '@livedesign/document';
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
    expect(blankPageTemplateOverrides('blank-logo')!.pages).toEqual([
      { id: 'page-1', orientation: 'portrait', size: 'logo', kind: 'logo' },
    ]);
  });

  it('are blanks: in no category, keeping the tab name rules of a blank', () => {
    // Photo Edit starts on one page of its kind the same way, but is a template of the Photos category.
    for (const kind of KINDS.filter((k) => k !== 'photo-edit')) {
      expect(isBlankTemplate(kind)).toBe(true);
      expect(templateCategory(kind)).toBeNull();
    }
    expect(isBlankTemplate('photo-edit')).toBe(false);
    expect(templateCategory('photo-edit')).toBe('photos');
    expect(untitledNameForTemplate('blank-logo')).toBe('Untitled Logo');
  });

  it('answers nothing for any other template', () => {
    expect(blankPageTemplateOverrides('blank-illustration')).toBeUndefined();
    expect(blankPageTemplateOverrides('logo-design')).toBeUndefined();
    expect(templateCanvasOverrides('blank-illustration').pages).toBeUndefined();
  });
});
