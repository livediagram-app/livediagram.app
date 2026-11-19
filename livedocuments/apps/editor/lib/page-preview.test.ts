import { describe, expect, it } from 'vitest';
import { pagePreviewSvg } from './page-preview';

// docs/specs/011-theme/canvas-and-theme-dialog.md "Previews": a sample page of the kind the dialog styles.
describe('pagePreviewSvg', () => {
  const base = { theme: 'brand', finish: 'flexible' as const };

  it('draws a slide and an infographic page with a title, a step and a decision', () => {
    for (const kind of ['slide', 'infographic'] as const) {
      const svg = pagePreviewSvg({ ...base, kind, background: undefined });
      for (const text of ['Quarterly review', 'Plan the work', 'Ready?'])
        expect(svg, kind).toContain(text);
    }
  });

  it('draws an article and a card from their writing', () => {
    for (const kind of ['article', 'flashcard'] as const)
      expect(pagePreviewSvg({ ...base, kind, background: undefined }), kind).toContain(
        'Quarterly review',
      );
  });

  it('wears the background in the finish, font and size it is given, re-inked for a dark page', () => {
    const svg = pagePreviewSvg({
      ...base,
      kind: 'slide',
      background: { fill: { kind: 'solid', color: '#0f172a' }, pattern: 'dots' },
      finish: 'sketch',
      font: 'lora',
      textSize: 'lg',
    });
    expect(svg.toLowerCase()).toContain('#0f172a');
    expect(svg).toContain('data-finish="sketch"');
    expect(pagePreviewSvg({ ...base, kind: 'slide', background: {} })).toBe(
      pagePreviewSvg({ ...base, kind: 'slide', background: undefined }),
    );
  });
});
