import { describe, expect, it, vi } from 'vitest';
import type { PageDeckControls } from '@/hooks/editor/usePagesMode';
import type { ContentsRow } from '@/lib/page-contents';
import { pageRowSlides } from './page-row-slides';

// docs/specs/007-editor/pages-mode.md "A page's place in the deck lives in Contents".
const row = (kind: ContentsRow['kind']): ContentsRow => ({
  id: 'p1',
  number: 1,
  name: 'Page 1',
  line: '',
  locked: false,
  aspect: 1,
  kind,
});
const deck = (slide?: { hidden: boolean }) =>
  ({
    slideOf: () => (slide ? { id: 's1', hidden: slide.hidden, noteCards: [] } : undefined),
    add: vi.fn(),
    toggleHidden: vi.fn(),
    setNoteCards: vi.fn(),
    flushNotes: vi.fn(),
    present: vi.fn(),
  }) satisfies PageDeckControls;
const labels = (actions: ReturnType<typeof pageRowSlides>) => actions.map((a) => a.label);

describe('pageRowSlides', () => {
  it('offers nothing without a deck to change (a Participant or Viewer)', () => {
    expect(pageRowSlides(row('slide'), undefined)).toEqual([]);
  });

  it('adds any kind of page the deck has none of', () => {
    for (const kind of ['slide', 'infographic', 'article'] as const) {
      const d = deck();
      const actions = pageRowSlides(row(kind), d);
      expect(labels(actions)).toEqual(['Add to Slides']);
      actions[0]!.run();
      expect(d.add).toHaveBeenCalledWith('p1');
    }
  });

  it('presents from a shown slide and hides it', () => {
    const shown = deck({ hidden: false });
    const actions = pageRowSlides(row('article'), shown);
    expect(labels(actions)).toEqual(['Present From Here', 'Hide in Slides']);
    actions[0]!.run();
    expect(shown.present).toHaveBeenCalledWith('s1');
    actions[1]!.run();
    expect(shown.toggleHidden).toHaveBeenCalledWith('s1');
  });

  it('shows a hidden slide again, with no Present From Here', () => {
    expect(labels(pageRowSlides(row('slide'), deck({ hidden: true })))).toEqual(['Show in Slides']);
  });
});
