// Entering Illustrate mode never changes a template's board (docs/specs/007-editor/
// illustrate-pages.md "Into pages"; issue #491: the Sailboat Retro's stickies were shrunk until
// their text was unreadable). Every template's content stays exactly as built, and any board that
// does not fit A4 gets a page made around it.
import { describe, expect, it } from 'vitest';
import {
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  withContentOnAPage,
} from '@livediagram/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

describe('a template entering Illustrate mode', () => {
  it('keeps the Sailboat Retro exactly as built, on one Fit to Content page', () => {
    const elements = buildTemplate('sailboat', 0, 0);
    const out = withContentOnAPage({ elements })!;
    expect(out.elements).toBe(elements);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0]!.size).toBe('fit');
    const laid = layOutIllustratePages(illustratePagesOf(out));
    expect(elementIdsOnPage(out.elements, laid, laid[0]!.id).size).toBe(elements.length);
  });

  it('never moves or resizes any template element', () => {
    for (const { kind } of TEMPLATES) {
      const elements = buildTemplate(kind, 0, 0);
      const out = withContentOnAPage({ elements });
      if (out) expect(out.elements, kind).toBe(elements);
    }
  });
});
