import { describe, expect, it } from 'vitest';
import { framePreviewSvg } from './frame-preview';

// docs/specs/011-theme/canvas-and-theme-dialog.md "Previews": the sample frame on the background new pages start on.
describe('framePreviewSvg', () => {
  const base = { theme: 'brand', finish: 'flexible' as const };

  it('draws the frame’s title, card and button, on the paper without a background', () => {
    const svg = framePreviewSvg({ ...base, background: undefined });
    for (const text of ['Welcome back', 'Get started']) expect(svg).toContain(text);
    expect(svg).toContain('<svg');
  });

  it('wears the background, in the finish, font and size it is given', () => {
    const svg = framePreviewSvg({
      ...base,
      background: { fill: { kind: 'solid', color: '#0f172a' }, pattern: 'dots' },
      finish: 'sketch',
      font: 'lora',
      textSize: 'lg',
    });
    expect(svg.toLowerCase()).toContain('#0f172a');
    expect(svg).toContain('data-finish="sketch"');
    expect(svg).toContain('Lora');
  });

  it('treats an empty background as the paper', () => {
    expect(framePreviewSvg({ ...base, background: {} })).toBe(
      framePreviewSvg({ ...base, background: undefined }),
    );
  });
});
