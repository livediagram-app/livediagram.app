import { describe, expect, it } from 'vitest';
import { panelSizeClass } from './item-panel-size';

// docs/specs/026-plan/plan-board.md "Maximised": the window less 1 rem on every side from sm up, the usual size
// otherwise, a phone's sheet either way, easing between them unless motion is reduced.
describe('panelSizeClass', () => {
  it('fills the window less a margin from sm up when maximised', () => {
    const c = panelSizeClass(true);
    expect(c).toContain('sm:w-[calc(100vw-2rem)]');
    expect(c).toContain('sm:h-[calc(100dvh-2rem)]');
    expect(c).toContain('sm:max-w-none');
    expect(c).toContain('max-sm:h-[85dvh]');
  });

  it('keeps the usual size otherwise', () => {
    const c = panelSizeClass(false);
    expect(c).toContain('h-[min(46rem,calc(100dvh-2rem))]');
    expect(c).not.toContain('sm:w-[calc(100vw-2rem)]');
  });

  it('eases between them, at once under reduced motion', () => {
    for (const c of [panelSizeClass(true), panelSizeClass(false)]) {
      expect(c).toContain('transition-[width,height,max-width]');
      expect(c).toContain('motion-reduce:transition-none');
      expect(c).toContain('overflow-hidden');
    }
  });
});
