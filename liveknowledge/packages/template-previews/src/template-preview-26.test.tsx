import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { templatePreviewGroup26 } from './template-preview-26';

// The flashcard stacks (docs/specs/007-editor/flashcards.md): Conference Talk, Wedding Toast, Product Pitch and
// School Presentation read apart at rest, each by a mark of its own on a tinted badge (Work Tracker #256).
const KINDS = [
  'talk-flashcards',
  'wedding-toast',
  'pitch-flashcards',
  'class-presentation',
] as const;

const svgOf = (kind: (typeof KINDS)[number]) => renderToStaticMarkup(templatePreviewGroup26(kind));

describe('flashcard previews at rest', () => {
  it('draws each stack’s mark on a badge that shows without a hover', () => {
    for (const kind of KINDS) {
      const svg = svgOf(kind);
      const badge = /<g class="pv-pulse"[^>]*>(.*?)<\/g>/.exec(svg);
      expect(badge, kind).not.toBeNull();
      // Visible at rest: the story swells it, it never has to bring it in.
      expect(badge![0], kind).not.toContain('opacity="0"');
      expect(badge![1], kind).toContain('<circle cx="57" cy="9.2" r="5"');
    }
  });

  it('gives the four stacks four different marks and tints', () => {
    const marks = KINDS.map((kind) => /<g class="pv-pulse"[^>]*>(.*?)<\/g>/.exec(svgOf(kind))![1]);
    expect(new Set(marks).size).toBe(4);
    const tints = marks.map((m) => /<circle[^>]*fill="([^"]+)"/.exec(m!)![1]);
    expect(new Set(tints).size).toBe(4);
  });

  it('keeps the hover story: the lines write themselves, then the badge swells', () => {
    for (const kind of KINDS) {
      const svg = svgOf(kind);
      expect(svg, kind).toContain('pv-grow-x');
      expect(svg, kind).toContain('--pv-at:1100ms');
    }
  });

  it('is none for any other kind', () => {
    expect(templatePreviewGroup26('blank')).toBeNull();
  });
});
