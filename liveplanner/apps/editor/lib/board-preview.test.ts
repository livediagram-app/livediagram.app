import { describe, expect, it } from 'vitest';
import { boardPreviewSvg } from './board-preview';
import { getTheme } from './themes';

// docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's profile": a plan's tab previews its
// finish and font on a small board, its columns in the theme's colours as a real board's are.
const fills = (svg: string) =>
  [...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]!.toLowerCase());

describe('boardPreviewSvg', () => {
  it('draws three columns of cards under their names, in the finish and font', () => {
    const svg = boardPreviewSvg('sketch', { background: '#ffffff', theme: 'office', font: 'lora' });
    for (const text of ['To do', 'Doing', 'Done', 'Plan work', 'Write brief', 'Ship it'])
      expect(svg).toContain(text);
    expect(svg).toContain('data-finish="sketch"');
    expect(svg).toMatch(/Lora/);
  });

  it("bars each column in the next of a multi-colour theme's colours, the cards alike", () => {
    const palette = getTheme('rainbow').palette!;
    const svg = boardPreviewSvg('professional', { background: '#ffffff', theme: 'rainbow' });
    const seen = fills(svg);
    for (const branch of palette.slice(0, 3)) expect(seen).toContain(branch.stroke.toLowerCase());
  });

  it('bars every column in one ink on a single-colour theme', () => {
    const svg = boardPreviewSvg('professional', { background: '#ffffff', theme: 'brand' });
    expect(fills(svg).filter((f) => f === '#64748b')).toHaveLength(3);
  });

  it('sets every label at the size new text takes', () => {
    const small = boardPreviewSvg('flexible', { background: '#ffffff', theme: 'office' });
    const large = boardPreviewSvg('flexible', {
      background: '#ffffff',
      theme: 'office',
      textSize: 'lg',
    });
    expect(large).not.toBe(small);
  });
});
