import { describe, expect, it } from 'vitest';
import { boxedNeedsSvgRaster, renderElementsToSvg, svgBoxed } from './svg-render';
import { createShape } from './factories';
import { SHAPE_KINDS } from './validate';
import { LABEL_FONT_PX, NOTE_FONT_PX } from './label-font';
import { fontSizeFor } from './svg-render-primitives';
import type { ShapeKind, Tab } from './index';

// The exporters against the canvas.
//
// Every bug this file guards was the same shape: the canvas drew one thing and
// an export drew another, and nothing noticed because each renderer was
// self-consistent. Labels came out two thirds the size they were drawn at, a
// pie chart exported as an empty rectangle with the word "pie-chart" in it,
// and a PNG of the same tab disagreed with its own SVG.
//
// So these do not assert pixels. They assert the three ways the two sides are
// wired together: one font table, a body for every kind that has one, and one
// list of which kinds the PNG path has to rasterise.

const ALL = [...SHAPE_KINDS] as ShapeKind[];
const tabOf = (elements: unknown[]) => ({ id: 't', name: 'Tab', elements }) as unknown as Tab;

describe('label sizes come from one table', () => {
  it('the exporter reads the canvas scale, not its own', () => {
    // The old exporter table was 12 / 14 / 20 / 18. If anyone reintroduces a
    // second set of numbers, this is where it shows up.
    for (const size of ['sm', 'md', 'lg', 'scale'] as const) {
      expect(fontSizeFor(size)).toBe(LABEL_FONT_PX[size]);
      expect(fontSizeFor(size, true)).toBe(NOTE_FONT_PX[size]);
    }
  });

  it('defaults to the md preset, which is what an unset textSize renders as', () => {
    expect(fontSizeFor(undefined)).toBe(LABEL_FONT_PX.md);
  });

  it('gives a note its smaller scale at every preset', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(NOTE_FONT_PX[size]).toBeLessThan(LABEL_FONT_PX[size]);
    }
  });
});

describe('every kind with a body draws one', () => {
  // The kinds whose content IS their data or their face. Each of these
  // exported as a rounded rectangle with its own name centred in it, which is
  // not a degraded render, it is a blank.
  const WITH_BODY: ShapeKind[] = [
    'pie-chart',
    'bar-chart',
    'line-chart',
    'progress-bar',
    'progress-ring',
    'rating',
    'timeline-rail',
    'entity',
    'page',
    'lane',
    'browser',
    'chair',
    'portal',
    'reveal',
    'picker',
    'mode-button',
    'session-button',
    'reaction-pad',
    'comment-pin',
    'action-card',
    'estimate',
    'temperature',
    'idea-box',
    'agenda',
    'decision',
    'roll-call',
    'done-check',
  ];

  // A plain export is the box and its label. Anything with a body of its own
  // emits at least two DRAWN marks (a portal is two ellipses and nothing
  // else), so that is the floor.
  const markCount = (kind: ShapeKind) => {
    const el = { ...createShape(kind, 0, 0), label: 'Label', width: 220, height: 160 };
    return (svgBoxed(el).match(/<(rect|circle|path|polygon|text|ellipse|polyline|svg)\b/g) ?? [])
      .length;
  };

  it('draws more than a box and a label for each of them', () => {
    const bare = WITH_BODY.filter((k) => markCount(k) < 2);
    expect(bare).toEqual([]);
  });

  it('does not print the kind name over a face that writes its own', () => {
    // "pie-chart" centred in the middle of a pie chart was the tell.
    const el = {
      ...createShape('pie-chart', 0, 0),
      label: 'Quarterly split',
      width: 220,
      height: 160,
    };
    expect(svgBoxed(el)).not.toContain('Quarterly split');
  });
});

describe('the two image exports agree', () => {
  // The PNG / PDF path paints with canvas 2D drawers that can only manage a
  // box and its text; anything richer has to rasterise the SVG markup. A kind
  // that draws a body but is missing from that list exports as a chart in the
  // SVG and a plain box in the PNG.
  it('rasterises every kind whose body the SVG emitter draws', () => {
    const missing = ALL.filter((kind) => {
      const el = { ...createShape(kind, 0, 0), label: 'Label', width: 220, height: 160 };
      const marks = (
        svgBoxed(el).match(/<(rect|circle|path|polygon|ellipse|polyline|svg)\b/g) ?? []
      ).length;
      // More than one drawn mark means more than the plain box.
      return marks > 1 && !boxedNeedsSvgRaster(el);
    });
    expect(missing).toEqual([]);
  });
});

describe('a self-painting element gets no box drawn round it', () => {
  // The element's own rect: the one the canvas does not draw for a chart and
  // does draw for a record. Matched by its size, since the legend's swatches
  // are rects too.
  const elementRect = /<rect[^>]*width="200"[^>]*height="160"/;

  it('leaves a chart unframed, the way the canvas does', () => {
    const svg = renderElementsToSvg(
      tabOf([{ ...createShape('pie-chart', 0, 0), width: 200, height: 160 }]),
    );
    expect(elementRect.test(svg)).toBe(false);
  });

  it('still frames a record, which is a real box with rows in it', () => {
    const svg = renderElementsToSvg(
      tabOf([{ ...createShape('entity', 0, 0), width: 200, height: 160 }]),
    );
    expect(elementRect.test(svg)).toBe(true);
  });
});

describe('a face paints in the element typeface', () => {
  it('wraps a card in the font its label would use (spec/28)', () => {
    const el = { ...createShape('agenda', 0, 0), label: 'Standup', font: 'caveat' };
    // The group carries the face, so every text mark inside inherits it: a
    // card exported in a different typeface to the board is the same bug this
    // file is about, in smaller type.
    expect(svgBoxed(el)).toMatch(/<g font-family="[^"]*[Cc]aveat/);
  });
});
