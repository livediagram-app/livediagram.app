import { describe, expect, it } from 'vitest';
import {
  edgeMask,
  pageScrollLeft,
  scrollEdges,
  scrollLeftToReveal,
  TAB_REVEAL_PAD,
} from './tab-strip-scroll';

describe('scrollLeftToReveal', () => {
  const strip = { left: 60, right: 995, scrollLeft: 0 };

  it('scrolls a tab past the right edge just into view', () => {
    // The thirteenth tab of a full strip sat at 1028 to 1089, under Search.
    expect(scrollLeftToReveal(strip, { left: 1028, right: 1089 })).toBe(142);
  });

  it('scrolls back to a tab past the left edge', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 300 }, { left: 20, right: 80 })).toBe(212);
  });

  it('leaves a tab that already shows where it is', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 40 }, { left: 200, right: 260 })).toBe(40);
  });

  it('stops clear of the 20px edge fade and its scroll button, so a revealed tab is never half hidden', () => {
    const left = scrollLeftToReveal(strip, { left: 1028, right: 1089 });
    // After the scroll the tab's right edge sits TAB_REVEAL_PAD inside the strip's.
    expect(strip.right - (1089 - left)).toBe(TAB_REVEAL_PAD);
    expect(TAB_REVEAL_PAD).toBeGreaterThanOrEqual(4 + 28 + 8);
  });

  it('brings a phone tab’s menu button clear of the fade, measured on livediagram at 390px', () => {
    // Tab 3 in an open folder after a tap on the chip scrolled the strip back: its ⋯ ran 212 to 236 under the
    // 222 edge. The whole tab, ⋯ included, comes TAB_REVEAL_PAD inside.
    const phone = { left: 12, right: 222, scrollLeft: 71 };
    const to = scrollLeftToReveal(phone, { left: 159, right: 240 });
    expect(to).toBe(137);
    expect(phone.right - (240 - (to - phone.scrollLeft))).toBe(TAB_REVEAL_PAD);
  });

  it('never scrolls before the start', () => {
    expect(scrollLeftToReveal({ ...strip, scrollLeft: 10 }, { left: 30, right: 90 })).toBe(0);
  });
});

describe('scrollEdges', () => {
  it('shows no button when every tab fits', () => {
    expect(scrollEdges({ scrollLeft: 0, clientWidth: 600, scrollWidth: 600 })).toEqual({
      left: false,
      right: false,
    });
  });

  it('shows the right button at the start of a long row, both in the middle, the left at the end', () => {
    expect(scrollEdges({ scrollLeft: 0, clientWidth: 600, scrollWidth: 2000 })).toEqual({
      left: false,
      right: true,
    });
    expect(scrollEdges({ scrollLeft: 500, clientWidth: 600, scrollWidth: 2000 })).toEqual({
      left: true,
      right: true,
    });
    expect(scrollEdges({ scrollLeft: 1400, clientWidth: 600, scrollWidth: 2000 })).toEqual({
      left: true,
      right: false,
    });
  });

  it('ignores a fractional pixel at either end', () => {
    expect(scrollEdges({ scrollLeft: 0.5, clientWidth: 600, scrollWidth: 600.6 })).toEqual({
      left: false,
      right: false,
    });
  });
});

describe('pageScrollLeft', () => {
  // A 600px strip at x 100 of 100px tabs, a hair apart: tab n runs n*104 to n*104+100 in the row.
  const tabs = (scrollLeft: number) =>
    Array.from({ length: 20 }, (_, n) => ({
      left: 100 + n * 104 - scrollLeft,
      right: 100 + n * 104 + 100 - scrollLeft,
    }));
  const strip = (scrollLeft: number) => ({
    left: 100,
    width: 600,
    scrollLeft,
    scrollWidth: 20 * 104,
  });

  it('pages right, stopping on the start of the tab the far edge would cut', () => {
    // A full page is 600 less both pads: its near line cuts tab 5 (520 to 620), which then starts a pad in.
    expect(pageScrollLeft('right', strip(0), tabs(0))).toBe(520 - TAB_REVEAL_PAD);
  });

  it('pages left, stopping on the end of the tab the near edge would cut', () => {
    // From 1000 a full page back's far line falls in tab 10 (1040 to 1140), which then ends a pad in.
    expect(pageScrollLeft('left', strip(1000), tabs(1000))).toBe(1140 + TAB_REVEAL_PAD - 600);
    // From 1100 it falls in tab 11 (1144 to 1244).
    expect(pageScrollLeft('left', strip(1100), tabs(1100))).toBe(1244 + TAB_REVEAL_PAD - 600);
    // A far line in the 4px gap after tab 10 (1140 to 1144) cuts nothing: the full page.
    const page = 600 - 2 * TAB_REVEAL_PAD;
    const from = 1142 + TAB_REVEAL_PAD - 600 + page;
    expect(pageScrollLeft('left', strip(from), tabs(from))).toBe(from - page);
  });

  it('never runs past either end', () => {
    expect(pageScrollLeft('left', strip(100), tabs(100))).toBe(0);
    expect(pageScrollLeft('right', strip(1400), tabs(1400))).toBe(20 * 104 - 600);
  });

  it('moves a whole page past a tab wider than the strip', () => {
    const wide = [{ left: 100, right: 100 + 2000 }];
    expect(
      pageScrollLeft('right', { left: 100, width: 600, scrollLeft: 0, scrollWidth: 2000 }, wide),
    ).toBe(600 - 2 * TAB_REVEAL_PAD);
  });

  it('pages at least half the strip on a phone, where the pads would eat most of it', () => {
    expect(
      pageScrollLeft('right', { left: 0, width: 120, scrollLeft: 0, scrollWidth: 2000 }, []),
    ).toBe(60);
  });
});

describe('edgeMask', () => {
  it('masks nothing while every tab fits', () => {
    expect(edgeMask({ left: false, right: false })).toBeUndefined();
  });

  it('fades only the edges with tabs beyond them, clear under their buttons', () => {
    expect(edgeMask({ left: false, right: true })).toBe(
      'linear-gradient(to right, #000 0, #000 calc(100% - 44px), transparent calc(100% - 24px))',
    );
    expect(edgeMask({ left: true, right: false })).toBe(
      'linear-gradient(to right, transparent 24px, #000 44px, #000 100%)',
    );
    expect(edgeMask({ left: true, right: true })).toContain('transparent 24px');
  });

  it('is fully opaque before a revealed tab stops', () => {
    expect(TAB_REVEAL_PAD).toBeGreaterThanOrEqual(44);
  });
});
