// Entering Pages mode never changes a template's board (docs/specs/007-editor/
// pages-mode.md "Into pages"; issue #491: a template's stickies were shrunk until
// their text was unreadable). Every template's content stays exactly as built.
import { describe, expect, it } from 'vitest';
import {
  elementAnchorPoint,
  elementIndexFor,
  layOutPages,
  pageAt,
  pagesOf,
  withContentOnAPage,
} from '@liveknowledge/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

describe('a template entering Pages mode', () => {
  it('never moves or resizes any template element, and its page sits over the content', () => {
    let paged = 0;
    for (const { kind } of TEMPLATES) {
      const elements = buildTemplate(kind, 0, 0);
      // A copy taken first: a move or a resize, in place or into a new array, shows against it.
      const built = structuredClone(elements);
      const out = withContentOnAPage({ elements });
      expect(elements, kind).toEqual(built);
      if (!out) continue;
      paged += 1;
      expect(out.elements, kind).toEqual(built);
      // The page is made where the content is: every element's anchor is on it.
      const laid = layOutPages(pagesOf(out));
      const index = elementIndexFor(out.elements);
      const off = out.elements.filter((el) => !pageAt(laid, elementAnchorPoint(el, index)));
      expect(
        off.map((el) => el.id),
        kind,
      ).toEqual([]);
    }
    // The templates bigger than the first page were infographics, no longer in the catalogue
    // (docs/specs/002-project-scope/not-in-liveknowledge.md "Unreachable, to delete"). The written templates with a
    // chart build it the width of the continuous page's 960 px column, wider than an A4 page, so built without their
    // page (as here) they are paged; with it, as every written template is applied, they stand in its column.
    expect(paged).toBe(3);
  });
});
