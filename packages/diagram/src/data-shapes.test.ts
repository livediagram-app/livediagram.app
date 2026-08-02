import { describe, expect, it } from 'vitest';
import type { ShapeKind } from './shape-kind';
import { SHAPE_KINDS } from './validate';
import {
  isBarShape,
  isChartShape,
  isChecklistShape,
  isCodeBlockShape,
  isLineShape,
  isPieShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
} from './data-shapes';

// The self-drawing shape family decides real behaviour: BoxedElementView picks
// a renderer off it, elementSupportsText uses isSelfDrawingShape to decide
// whether an element has an editable label at all, and the context menu hides
// markers, alignment and morphing for members. Nothing called any of these
// guards from a test.
//
// Asserting each one in isolation ("isRatingShape('rating') is true") would
// mostly restate the implementation. The properties worth holding are about
// the family as a whole, checked against the real vocabulary rather than a
// list repeated here:
//
//   exhaustive — isSelfDrawingShape claims every kind its members claim, so a
//     new data shape wired into one sub-guard but not the aggregate cannot
//     slip through as an ordinary box with an editable label;
//   disjoint  — no kind belongs to two families, so a renderer branch order
//     can never decide which of two it draws as.

const ALL = [...SHAPE_KINDS] as ShapeKind[];

const FAMILIES: { name: string; guard: (k: ShapeKind) => boolean }[] = [
  { name: 'progress', guard: isProgressShape },
  { name: 'rail', guard: isRailShape },
  { name: 'rating', guard: isRatingShape },
  { name: 'chart', guard: isChartShape },
  { name: 'code block', guard: isCodeBlockShape },
  { name: 'checklist', guard: isChecklistShape },
];

const kindsMatching = (guard: (k: ShapeKind) => boolean) => ALL.filter(guard).sort();

describe('the self-drawing shape family', () => {
  it('reads the real vocabulary (guard against an empty enumeration)', () => {
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('claims exactly the kinds its members claim, plus the sticker', () => {
    const fromMembers = new Set(FAMILIES.flatMap((f) => kindsMatching(f.guard)));
    fromMembers.add('sticker');
    expect(kindsMatching(isSelfDrawingShape)).toEqual([...fromMembers].sort());
  });

  it('puts every member in exactly one family', () => {
    const twice = ALL.filter((k) => FAMILIES.filter((f) => f.guard(k)).length > 1);
    expect(twice).toEqual([]);
  });

  it('leaves the ordinary shapes alone', () => {
    // A regression here means a plain box lost its label, which is the
    // user-visible cost of a guard that over-claims.
    expect(isSelfDrawingShape('square')).toBe(false);
    expect(isSelfDrawingShape('circle')).toBe(false);
    expect(isSelfDrawingShape('frame')).toBe(false);
    expect(isSelfDrawingShape('icon')).toBe(false);
  });
});

describe('isChartShape', () => {
  it('is exactly the three chart kinds', () => {
    expect(kindsMatching(isChartShape)).toEqual(['bar-chart', 'line-chart', 'pie-chart']);
  });

  it('agrees with the three single-kind guards it is built from', () => {
    for (const k of ALL) {
      expect(isChartShape(k)).toBe(isPieShape(k) || isBarShape(k) || isLineShape(k));
    }
  });
});

describe('the single-kind guards', () => {
  // Each of these names one kind. Pinning the exact set catches a guard that
  // silently widens as much as one that stops matching.
  it.each([
    ['rail', isRailShape, ['timeline-rail']],
    ['rating', isRatingShape, ['rating']],
    ['pie', isPieShape, ['pie-chart']],
    ['bar', isBarShape, ['bar-chart']],
    ['line', isLineShape, ['line-chart']],
    ['code block', isCodeBlockShape, ['code-block']],
    ['checklist', isChecklistShape, ['checklist']],
  ] as const)('%s matches only its own kind', (_name, guard, expected) => {
    expect(kindsMatching(guard)).toEqual([...expected]);
  });

  it('progress covers both the bar and the ring', () => {
    expect(kindsMatching(isProgressShape)).toEqual(['progress-bar', 'progress-ring']);
  });
});
