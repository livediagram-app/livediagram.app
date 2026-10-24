// Entering Pages mode never changes a template's board (docs/specs/007-editor/
// pages-mode.md "Into pages"; issue #491: a template's stickies were shrunk until
// their text was unreadable). Every template's content stays exactly as built.
import { describe, expect, it } from 'vitest';
import { pageKindOf, tabPageKind, withContentOnAPage } from '@livedesign/design';
import { buildTemplate } from './build-template';
import { templateCanvasOverrides } from './template-canvas-overrides';
import { TEMPLATES } from './templates';

describe('a template entering Pages mode', () => {
  it('never moves or resizes any template element', () => {
    for (const { kind } of TEMPLATES) {
      const elements = buildTemplate(kind, 0, 0);
      const out = withContentOnAPage({ elements });
      if (out) expect(out.elements, kind).toBe(elements);
    }
  });

  // docs/specs/007-editor/pages-mode.md "One kind a tab": a template sets the tab's kind, so
  // every page it opens on is of its first page's kind.
  it('opens on pages of one kind', () => {
    for (const { kind } of TEMPLATES) {
      const pages = templateCanvasOverrides(kind).pages ?? [];
      const first = tabPageKind(pages);
      for (const page of pages) expect(pageKindOf(page), kind).toBe(first);
    }
  });
});
