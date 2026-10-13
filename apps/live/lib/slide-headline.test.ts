import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { slideHeadline, SLIDE_HEADLINE_MAX } from './slide-headline';

// docs/specs/012-collaboration/presentation-mode.md "The Slide Deck panel": a slide nobody named
// is called by its largest text.
const text = (id: string, y: number, label: string, extra = {}) => ({
  id,
  type: 'text',
  x: 0,
  y,
  width: 200,
  height: 40,
  label,
  ...extra,
});
const tab = (elements: unknown[]) => ({ id: 't', name: 'T', elements }) as unknown as Tab;
const slide = (ids: string[]) => ({ id: 's', tabId: 't', elementIds: ids });

describe('slideHeadline', () => {
  it('picks the weightiest text, the topmost on a tie, on one line', () => {
    const t = tab([
      text('a', 10, 'Small print', { textSize: 'sm' }),
      text('b', 50, 'The  next\nten years', { textSize: 'lg', textScale: 3 }),
      text('c', 5, 'A heading', { textSize: 'lg', textScale: 2 }),
    ]);
    expect(slideHeadline(slide(['a', 'b', 'c']), t)).toBe('The next ten years');
    // A heading outweighs a huge short figure.
    const stats = tab([
      text('h', 0, 'The year in three numbers', { textSize: 'lg', textScale: 2 }),
      text('f', 60, '86k', { textSize: 'lg', textScale: 5 }),
    ]);
    expect(slideHeadline(slide(['h', 'f']), stats)).toBe('The year in three numbers');
    const tie = tab([text('a', 30, 'Lower'), text('b', 10, 'Upper')]);
    expect(slideHeadline(slide(['a', 'b']), tie)).toBe('Upper');
  });

  it('is nothing for a slide without text, a card slide, or a missing tab', () => {
    expect(slideHeadline(slide([]), tab([]))).toBeNull();
    expect(slideHeadline({ ...slide(['a']), itemId: 'i' }, tab([text('a', 0, 'X')]))).toBeNull();
    expect(slideHeadline(slide(['a']), undefined)).toBeNull();
  });

  it('cuts a long headline', () => {
    const long = 'word '.repeat(40);
    const h = slideHeadline(slide(['a']), tab([text('a', 0, long)]))!;
    expect(h.length).toBe(SLIDE_HEADLINE_MAX);
    expect(h.endsWith('…')).toBe(true);
  });
});
