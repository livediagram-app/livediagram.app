import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import type { Tab } from '@livedesign/document';
import { presentedSlideName, slideHeadline, SLIDE_HEADLINE_MAX } from './slide-headline';

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

  it('is nothing for a slide without text, or a missing tab', () => {
    expect(slideHeadline(slide([]), tab([]))).toBeNull();
    expect(slideHeadline(slide(['a']), undefined)).toBeNull();
  });

  it('cuts a long headline', () => {
    const long = 'word '.repeat(40);
    const h = slideHeadline(slide(['a']), tab([text('a', 0, long)]))!;
    expect(h.length).toBe(SLIDE_HEADLINE_MAX);
    expect(h.endsWith('…')).toBe(true);
  });
});

// presentation-mode.md "Jump to a slide": the deck's list and the HUD name a slide as the talk does.
describe('presentedSlideName', () => {
  const t = tab([text('a', 0, 'Quarterly results', { textSize: 'xl' })]);
  it("prefers the slide's own name", () => {
    expect(presentedSlideName({ ...slide(['a']), name: ' Intro ' }, t, 0)).toBe('Intro');
  });
  it('then the headline on it', () => {
    expect(presentedSlideName(slide(['a']), t, 0)).toBe('Quarterly results');
  });
  it('then the tab it comes from', () => {
    expect(presentedSlideName(slide([]), tab([]), 2)).toBe('T');
  });
  it('and only then its place', () => {
    expect(presentedSlideName(slide([]), undefined, 2)).toBe('Slide 3');
  });
  it('names a 100-slide deck on a 2,000-element tab well inside a frame', () => {
    const els = Array.from({ length: 2000 }, (_, i) => text(`e${i}`, i, `Label ${i}`));
    const big = tab(els);
    const slides = Array.from({ length: 100 }, (_, s) => ({
      id: `s${s}`,
      tabId: 't',
      elementIds: els.slice(s * 20, s * 20 + 20).map((e) => e.id),
    }));
    let names: string[] = [];
    const spent = cpuMsOf(() => {
      names = slides.map((sl, i) => presentedSlideName(sl, big, i));
    });
    expect(names[3]).toBe('Label 60');
    expect(spent).toBeLessThan(cpuBudgetMs(50));
  });
});
