import { describe, expect, it } from 'vitest';
import { layOutPages, pagesOf } from '@livedocuments/document';
import { buildTemplateTab, type TemplateKind } from '@livedocuments/templates';
import { mcpCreateDocument } from '../verbs/mcp-tools';
import { FIRST_PAGES, firstPagesBrief } from './first-page';

describe('first pages', () => {
  it.each(FIRST_PAGES)('$template starts with its first page where the brief says', (page) => {
    const tab = buildTemplateTab('t', 'T', page.template as TemplateKind);
    const rect = layOutPages(pagesOf(tab))[0]?.rect;
    expect(rect).toEqual({ x: page.x, y: page.y, width: page.width, height: page.height });
  });

  it('create_document names every starting template and its page', () => {
    expect(mcpCreateDocument.description).toContain(firstPagesBrief());
    expect(
      firstPagesBrief([{ template: 'blank-x', what: 'a page', x: -1, y: -2, width: 2, height: 4 }]),
    ).toBe(
      `A new tab's first page is centred on (0, 0): "blank-x" a page 2 x 4 from (-1, -2); a page's elements go inside its rectangle.`,
    );
  });
});
