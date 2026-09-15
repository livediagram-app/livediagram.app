import { describe, expect, it } from 'vitest';
import { labelTypographyClass } from './label-style';

// Zero layout shift on entering text-edit (the design rule, and spec/139's
// capture loop: double-click means "type", not "watch the text jump").
// The display label and the inline editor must agree on typography, or the
// glyphs move — and on a multi-line element they can even re-wrap — the
// instant the editor mounts. One rule, consumed by both, is what keeps them
// honest; this pins the rule itself.
describe('labelTypographyClass', () => {
  it('gives single-line labels the tight, medium treatment', () => {
    expect(labelTypographyClass(false)).toContain('leading-tight');
    expect(labelTypographyClass(false)).toContain('font-medium');
  });

  it('leaves multi-line labels on the normal leading (stickies, pages)', () => {
    // A sticky's display label runs at the element's own line-height; the
    // editor must not tighten it, which is exactly the bug this pins.
    expect(labelTypographyClass(true)).not.toContain('leading-tight');
    expect(labelTypographyClass(true)).not.toContain('font-medium');
  });
});
