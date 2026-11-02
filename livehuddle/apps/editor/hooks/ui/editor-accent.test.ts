import { describe, expect, it } from 'vitest';
import { editorAccentCss } from './editor-accent';

// A themed tab tints the chrome (docs/specs/011-theme/canvas-and-theme-dialog.md) on top of the dark
// palette's own `.dark` tokens (docs/specs/004-interface-design/color-scheme.md). Both are unlayered
// custom properties on <html>, so with equal specificity the winner would be whichever stylesheet
// loaded last. The tint is written one element-type step more specific, so it wins by selector.
describe('editorAccentCss', () => {
  const css = editorAccentCss('#15803d'); // Forest's stroke

  it('retargets the brand ramp above the dark palette, in both appearances', () => {
    expect(css).toMatch(/^html:root\{--color-brand-50:#[0-9a-f]{6};/);
    expect(css).toContain('--color-brand-600:#15803d;');
  });

  it('tints the dark surfaces above the dark palette', () => {
    expect(css).toMatch(
      /html\.dark\{--color-slate-600:#[0-9a-f]{6};.*--color-slate-950:#[0-9a-f]{6};\}$/,
    );
  });

  it('never tints the lighter slate stops that carry dark-mode text', () => {
    expect(css).not.toMatch(/--color-slate-(50|[1-5]00):/);
  });
});
