// Entering Pages mode never changes a template's board (docs/specs/007-editor/
// pages-mode.md "Into pages"; issue #491: a template's stickies were shrunk until
// their text was unreadable). Every template's content stays exactly as built.
import { describe, expect, it } from 'vitest';
import { withContentOnAPage } from '@livedocuments/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

describe('a template entering Pages mode', () => {
  it('never moves or resizes any template element', () => {
    for (const { kind } of TEMPLATES) {
      const elements = buildTemplate(kind, 0, 0);
      const out = withContentOnAPage({ elements });
      if (out) expect(out.elements, kind).toBe(elements);
    }
  });
});
