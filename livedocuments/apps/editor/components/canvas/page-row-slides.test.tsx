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
  }) satisfies PageDeckControls;
const labels = (actions: ReturnType<typeof pageRowSlides>) => actions.map((a) => a.label);

describe('pageRowSlides', () => {
  it('offers nothing without a deck to change', () => {
    expect(pageRowSlides(row('slide'), undefined)).toEqual([]);
  });

  it('adds a slide page the deck has none of, and nothing for another kind', () => {
    const d = deck();
    const [add] = pageRowSlides(row('slide'), d);
    expect(add?.label).toBe('Add to Slides');
    add!.run();
    expect(d.add).toHaveBeenCalledWith('p1');
    expect(pageRowSlides(row('infographic'), d)).toEqual([]);
  });

  it('hides or shows the slide of any page in the deck', () => {
    const shown = deck({ hidden: false });
    expect(labels(pageRowSlides(row('article'), shown))).toEqual(['Hide in Slides']);
    pageRowSlides(row('article'), shown)[0]!.run();
    expect(shown.toggleHidden).toHaveBeenCalledWith('s1');
    expect(labels(pageRowSlides(row('slide'), deck({ hidden: true })))).toEqual(['Show in Slides']);
  });
});
