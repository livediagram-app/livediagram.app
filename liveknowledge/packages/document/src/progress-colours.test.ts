import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  MIN_TEXT_CONTRAST,
  type CanvasSurface,
} from './colors';
import { createShape } from './shape-factory';
import { svgProgressBar } from './svg-render-data';
import { svgBoxed } from './svg-render';
import { PROGRESS_TRACK_DEFAULT, progressLabelInks, progressTrackColour } from './progress-colours';
import type { ShapeElement } from './index';

// docs/specs/009-elements/progress.md "The percentage stays legible".

const SURFACES: CanvasSurface[] = ['light', 'dark'];
const bar = (o: Partial<ShapeElement> = {}) =>
  ({ ...createShape('progress-bar', 0, 0), id: 'pb', progress: 50, ...o }) as ShapeElement & {
    type: 'shape';
  };

// The `fill` of every <text> in an SVG fragment.
const textFills = (svg: string) =>
  [...svg.matchAll(/<text\b[^>]*\bfill="([^"]+)"/g)].map((m) => m[1]!);

describe('progressTrackColour', () => {
  it('follows the paper when the element has no fill of its own', () => {
    expect(progressTrackColour(bar(), 'light')).toBe(PROGRESS_TRACK_DEFAULT);
    expect(progressTrackColour(bar(), 'dark')).toBe(defaultFillColor(bar(), 'dark'));
  });

  it('keeps the element own fill on any paper', () => {
    expect(progressTrackColour(bar({ fillColor: '#fde68a' }), 'dark')).toBe('#fde68a');
  });
});

describe('progressLabelInks', () => {
  it.each(SURFACES)('reads at AA over both parts of an unstyled bar on %s paper', (surface) => {
    const el = bar();
    const accent = defaultStrokeColor(el, surface);
    const track = progressTrackColour(el, surface);
    const inks = progressLabelInks(defaultTextColor(el, surface), accent, track);
    expect(contrastRatio(inks.onFill, accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(inks.onTrack, track)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('reads at AA on a dark page whose bar keeps a pale track and a deep fill', () => {
    const inks = progressLabelInks('#ffffff', '#1d4ed8', '#e2e8f0');
    expect(inks.onFill).toBe('#ffffff');
    expect(contrastRatio(inks.onTrack, '#e2e8f0')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});

describe('svgProgressBar label', () => {
  it('writes one label when both parts take the same ink', () => {
    const svg = svgProgressBar(bar(), '#1d4ed8', '#141b26', '#ffffff');
    expect(textFills(svg)).toEqual(['#ffffff']);
    expect(svg).not.toContain('overflow="hidden"');
  });

  it('splits the label at the fill edge when the parts need different inks', () => {
    const el = bar({ width: 200, height: 40, progress: 50 });
    const svg = svgProgressBar(el, '#1d4ed8', '#e2e8f0', '#ffffff');
    const fills = textFills(svg);
    expect(fills).toHaveLength(2);
    expect(contrastRatio(fills[0]!, '#1d4ed8')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(fills[1]!, '#e2e8f0')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // Two clipping viewports, meeting at the fill's edge (x = 100).
    expect(svg).toContain('<svg x="0" y="0" width="100" height="40" overflow="hidden">');
    expect(svg).toContain('<svg x="100" y="0" width="100" height="40" overflow="hidden">');
    // Each copy sits at the bar's centre in its viewport's own coordinates.
    expect(svg).toContain('<text x="100"');
    expect(svg).toContain('<text x="0"');
  });

  it('writes one label in the track ink at 0% and in the fill ink at 100%', () => {
    expect(
      textFills(svgProgressBar(bar({ progress: 0 }), '#1d4ed8', '#e2e8f0', '#ffffff')),
    ).toEqual([progressLabelInks('#ffffff', '#1d4ed8', '#e2e8f0').onTrack]);
    expect(
      textFills(svgProgressBar(bar({ progress: 100 }), '#1d4ed8', '#e2e8f0', '#ffffff')),
    ).toEqual(['#ffffff']);
  });

  it.each(SURFACES)('exports an unstyled bar with a legible label on %s paper', (surface) => {
    const el = bar();
    const svg = svgBoxed(el, { surface });
    const track = progressTrackColour(el, surface);
    const accent = el.strokeColor ?? defaultStrokeColor(el, surface);
    const inks = progressLabelInks(defaultTextColor(el, surface), accent, track);
    expect(svg).toContain(`fill="${track}"`);
    expect(textFills(svg)).toEqual(
      inks.onFill === inks.onTrack ? [inks.onFill] : [inks.onFill, inks.onTrack],
    );
    expect(contrastRatio(inks.onFill, accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(inks.onTrack, track)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
