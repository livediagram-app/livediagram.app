import { describe, expect, it } from 'vitest';
import {
  animatedPatternStill,
  AURORA_GLOWS,
  RINGS_PER_ORIGIN,
  RIPPLE_ORIGINS,
} from './animated-pattern-still';
import { renderTabToSvg } from './export-tab';
import { lookPreviewSvg, lookPreviewTab } from './look-preview';
import { TAB_LOOKS } from './tab-looks';

const box = { x: -32, y: -32, w: 614, h: 164 };

describe('animatedPatternStill', () => {
  it('draws a glow per aurora motif, in the pattern colour, with scoped gradient ids', () => {
    const still = animatedPatternStill('aurora', '#5eead4', box, 'card-a')!;
    expect(still.match(/<circle /g)).toHaveLength(AURORA_GLOWS.length);
    expect(still).toContain('stop-color="#5eead4"');
    expect(still).toContain('id="card-a-aurora"');
    expect(still).toContain('fill="url(#card-a-aurora)"');
  });

  it('draws expanding rings around every ripple origin', () => {
    const still = animatedPatternStill('ripple', '#0ea5e9', box, 'card-r')!;
    expect(still.match(/<circle /g)).toHaveLength(RIPPLE_ORIGINS.length * RINGS_PER_ORIGIN);
    expect(still).toContain('stroke="#0ea5e9"');
  });

  it('scales the motifs with the pattern-size slider', () => {
    const radius = (s: string) => Number(/ r="([\d.]+)"/.exec(s)![1]);
    const small = animatedPatternStill('ripple', '#000', box, 'a', 1)!;
    const big = animatedPatternStill('ripple', '#000', box, 'a', 2)!;
    expect(radius(big)).toBeCloseTo(radius(small) * 2, 1);
  });

  it('has no still for a static pattern or an animated one no look uses', () => {
    for (const p of ['grid', 'blank', 'flow', 'drift', 'ribbons'] as const) {
      expect(animatedPatternStill(p, '#000', box, 'x')).toBeNull();
    }
  });
});

describe('lookPreviewSvg', () => {
  // docs/specs/011-theme/canvas-and-theme-dialog.md "Looks": a card shows what the tab will, motion backdrops included.
  it('shows the still of every look with an animated backdrop, over the paper and under the boxes', () => {
    const animated = TAB_LOOKS.filter((l) => l.pattern === 'aurora' || l.pattern === 'ripple');
    expect(animated.length).toBeGreaterThan(0);
    for (const look of animated) {
      const svg = lookPreviewSvg(look);
      const still = svg.indexOf('<circle ');
      expect(still, look.id).toBeGreaterThan(svg.indexOf('<rect '));
      // The first box: an element's group, carrying the look's font when it has one.
      expect(still, look.id).toBeLessThan(svg.search(/<g(?: font-family="[^"]*")?><rect /));
    }
  });

  it('keeps a static look exactly as the exporter draws it', () => {
    const look = TAB_LOOKS.find((l) => l.pattern === 'grid')!;
    const exported = renderTabToSvg(lookPreviewTab(look))
      .split('lvd-export-bg')
      .join(`lvd-look-${look.id}-bg`);
    expect(lookPreviewSvg(look)).toBe(exported);
  });
});
