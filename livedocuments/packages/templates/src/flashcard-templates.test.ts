import { describe, expect, it } from 'vitest';
import { flashcardWordCount, pagesOf, tabPageKind } from '@livedocuments/document';
import { flashcardTemplateOverrides, isFlashcardTemplate } from './flashcard-templates';
import { templateCanvasOverrides } from './template-canvas-overrides';

const KINDS = [
  'talk-flashcards',
  'wedding-toast',
  'pitch-flashcards',
  'class-presentation',
] as const;

describe('flashcard templates', () => {
  it('open as stacks of cards, each its own writing, short enough for a card', () => {
    const counts: number[] = [];
    for (const kind of KINDS) {
      const out = flashcardTemplateOverrides(kind);
      const pages = pagesOf(out);
      expect(tabPageKind(pages)).toBe('flashcard');
      counts.push(pages.length);
      const flows = pages.map((p) => p.flow!);
      expect(new Set(flows).size).toBe(flows.length);
      for (const flow of flows) {
        const doc = out.articles![flow]!;
        expect(doc.style).toEqual({ margins: 'narrow' });
        expect(doc.blocks[0]).toMatchObject({ type: 'paragraph', style: 'title' });
        expect(flashcardWordCount(doc)).toBeLessThanOrEqual(110);
        const ids = doc.blocks.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
      expect(templateCanvasOverrides(kind).pages).toEqual(out.pages);
    }
    expect(counts).toEqual([6, 5, 5, 5]);
  });

  it('names only the flashcard stacks', () => {
    expect(isFlashcardTemplate('wedding-toast')).toBe(true);
    expect(isFlashcardTemplate('article')).toBe(false);
  });
});
