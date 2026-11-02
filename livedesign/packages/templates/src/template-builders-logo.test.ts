import { describe, expect, it } from 'vitest';
import type { TextElement } from '@livedesign/design';
import { buildLogoDesign } from './template-builders-logo';

// docs/specs/007-editor/logo-pages.md "Export": the Logo Design template marks the words it wrote about each lockup
// page as its notes (left out of the Logo Kit), never the lockup's own words.
describe('buildLogoDesign', () => {
  const texts = buildLogoDesign(0, 0).filter((e): e is TextElement => e.type === 'text');
  const noted = texts.filter((t) => t.templateNote).map((t) => t.label);

  it("marks each lockup page's number and name, brand line and use, and the how-to", () => {
    expect(noted).toContain('01 · Horizontal');
    expect(noted).toContain('Sunny Side Roasters');
    expect(noted).toContain('Use it on stamps, receipts and engraving.');
    expect(noted).toContain(
      'Pick the lockup that fits, delete the other pages, then swap in your own mark and name.',
    );
    // Six lockup pages, three notes each, and the how-to on the first.
    expect(noted).toHaveLength(6 * 3 + 1);
  });

  it("never marks the lockup's wordmark or tagline", () => {
    const words = texts.filter((t) => !t.templateNote).map((t) => t.label);
    expect(words).toContain('Sunny Side');
    expect(words).toContain('Small-batch, roasted at dawn');
    expect(noted).not.toContain('Sunny Side');
  });
});
