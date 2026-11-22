import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Tab } from '@liveknowledge/document';
import { presentedSlideName, slideHeadline, SLIDE_HEADLINE_MAX } from './slide-headline';

// docs/specs/012-collaboration/presentation-mode.md "The HUD": a slide nobody named
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

  // presentation-mode.md "Jump to a slide": text a build brings in later never names the slide.
  it('reads only the text showing before any build', () => {
    const built = tab([
      text('b', 60, 'Surfaces the note beside the slide', {
        textSize: 'xl',
        build: { order: 1, effect: 'fade' },
      }),
      text('a', 0, 'What It Does', { textSize: 'md' }),
    ]);
    expect(slideHeadline(slide(['b', 'a']), built)).toBe('What It Does');
    // With every text built, the slide has no headline, and its name falls through to the tab.
    const allBuilt = tab([text('b', 0, 'Later', { build: { order: 2, effect: 'appear' } })]);
    expect(slideHeadline(slide(['b']), allBuilt)).toBeNull();
    expect(presentedSlideName(slide(['b']), allBuilt, 0)).toBe('T');
    // A slide without builds keeps its name: the weightiest text still wins.
    const plain = tab([
      text('b', 60, 'Surfaces the note beside the slide', { textSize: 'xl' }),
      text('a', 0, 'What It Does', { textSize: 'md' }),
    ]);
    expect(slideHeadline(slide(['b', 'a']), plain)).toBe('Surfaces the note beside the slide');
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
